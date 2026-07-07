import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy/jwt.strategy';
import { UsersModule } from 'src/users/users.module';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';

@Module({
    imports:[UsersModule, PassportModule],
    controllers:[AuthController],
    providers:[JwtStrategy, AuthService],
})
export class AuthModule{}