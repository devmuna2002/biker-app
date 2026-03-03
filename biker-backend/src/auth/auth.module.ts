import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { User } from '../users/user.entity';
import { UserSession } from './user-session.entity';
import { Biker } from '../bikers/biker.entity';
@Module({
    imports: [
        TypeOrmModule.forFeature([User, UserSession, Biker]),
        PassportModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'dev-secret-change-me',
        }),
    ],
    providers: [AuthService, JwtStrategy],
    controllers: [AuthController],
    exports: [AuthService, JwtModule],
})
export class AuthModule { }
