import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController{
    constructor(private readonly authService: AuthService){}
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async me(@Req() req){
        return req.user;
    }
}
