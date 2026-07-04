import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import {Injectable, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "src/users/users.service";


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){
    constructor(private readonly usersService : UsersService){
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.JWT_SECRET!,
        });
    }
    async validate(payload : {sub:string}){
                const user= await this.usersService.findById(payload.sub)
                if (!user){
                    throw new UnauthorizedException();
                }
                return user;
            }
}
