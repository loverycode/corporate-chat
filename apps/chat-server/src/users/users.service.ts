import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService){}
    async findAll(){
        return this.prisma.usersCache.findMany();
    }
    async findById(id: string){
        return this.prisma.usersCache.findUnique({
            where: {id}
        });
    }

}
