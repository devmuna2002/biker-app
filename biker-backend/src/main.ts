import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpErrorFilter } from './common/http-exception.filter';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { RedisIoAdapter } from './websockets/redis-io.adapter';
import { json, urlencoded } from 'express';
import * as morgan from 'morgan';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bodyParser: false });

    app.use(morgan('dev'));

    const bodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';
    app.use(json({ limit: bodyLimit }));
    app.use(urlencoded({ extended: true, limit: bodyLimit }));

    app.enableCors({
        origin: '*',
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    });

    app.use(new RequestContextMiddleware().use);
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );
    app.useGlobalFilters(new HttpErrorFilter());

    if (process.env.REDIS_URL) {
        const adapter = new RedisIoAdapter(app);
        await adapter.connectToRedis(process.env.REDIS_URL);
        app.useWebSocketAdapter(adapter);
    }

    const port = Number(process.env.PORT || 3003);
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
