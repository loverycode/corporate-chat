import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy/jwt.strategy';
import { UsersService } from 'src/users/users.service';

@Module({
    imports:[AuthService, UsersService],
    controllers:[],
    providers:[JwtStrategy],
})
export class AuthModule{}