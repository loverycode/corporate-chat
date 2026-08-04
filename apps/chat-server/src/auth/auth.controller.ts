import { Controller, Get, UseGuards, Req, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';


@Controller('auth')
export class AuthController{
    constructor(private readonly authService: AuthService, 
                private readonly jwtService: JwtService
    ){}
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async me(@Req() req){
        return req.user;
    }
    @Post('dev-login')
    devLogin(@Body() body: { userId: string; name: string }) {
        const token = this.jwtService.sign(
            { sub: body.userId, name: body.name, email: `${body.userId}@example.com`, role: 'USER' },
            { secret: process.env.JWT_SECRET, expiresIn: '4h' },
        );
        return { token };
    }
}
