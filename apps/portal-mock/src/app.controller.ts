import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TEST_USERS } from './test-data';

@Controller()
export class AppController {
    constructor(private readonly jwtService: JwtService) {}

    @Get('users')
    getUsers() {
        return TEST_USERS;
    }

    @Get('auth/token/:userId')
    getToken(@Param('userId') userId: string) {
        const user = TEST_USERS.find((u) => u.id === userId);
        if (!user) {
            throw new NotFoundException('test user not found');
        }
        const token = this.jwtService.sign(
            { sub: user.id, name: user.name, email: user.email, role: user.role },
            { secret: process.env.CHAT_JWT_SECRET, expiresIn: '4h' },
        );
        return { token };
    }
}