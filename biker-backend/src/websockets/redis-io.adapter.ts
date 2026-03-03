import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

export class RedisIoAdapter extends IoAdapter {
    private pubClient: RedisClientType | null = null;
    private subClient: RedisClientType | null = null;

    constructor(app: INestApplicationContext) {
        super(app);
    }

    async connectToRedis(redisUrl: string) {
        this.pubClient = createClient({ url: redisUrl });
        this.subClient = this.pubClient.duplicate();
        await this.pubClient.connect();
        await this.subClient.connect();
    }

    createIOServer(port: number, options?: any): any {
        const server = super.createIOServer(port, options);
        if (this.pubClient && this.subClient) {
            server.adapter(createAdapter(this.pubClient, this.subClient));
        }
        return server;
    }
}
