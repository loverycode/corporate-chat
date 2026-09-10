import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.CHAT_JWT_SECRET!,
      algorithms: ['HS256'], 
    });
  }
  async validate(payload: {
    sub: string;
    name: string;
    email: string;
    role: string;
  }) {
    return this.usersService.upsertFromToken(payload);
  }
}
