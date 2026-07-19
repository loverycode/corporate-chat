import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { CreateChannelDto } from "./create-channel.dto"
import { PrismaService } from "../prisma/prisma.service"
import { ChannelRole, ChannelType } from "@prisma/client";
@Injectable()
export class ChannelsService{
    constructor(private readonly prisma: PrismaService){}
    private validateCreateChannel(dto: CreateChannelDto){
        if (dto.type===ChannelType.direct){
            if (!dto.members || dto.members.length!==2){
            throw new BadRequestException('direct channel requires exactly 2 members')
            }
        }
        else if (dto.type===ChannelType.group){
            if ((!dto.members || dto.members.length === 0) || !dto.title){
                throw new BadRequestException('group channel requires members and title')
            }
        }
        else if (dto.type===ChannelType.context){
            if (!dto.contextObjectId){
                throw new BadRequestException('contextObjectId is requied!')
            }
            if (!dto.members || dto.members.length===0){
                throw new BadRequestException('context channel requires members');
            }
        }
    }
   async  create(dto: CreateChannelDto, currentUserId: string){
        this.validateCreateChannel(dto);
        switch (dto.type){
            case ChannelType.direct: 
                if (!dto.members.includes(currentUserId)){
                    throw new ForbiddenException('cannot create a direct channel you are not part of');
                }
                return this.createDirect(dto.members, currentUserId);
            case ChannelType.group: 
                return this.createGroup(dto, currentUserId);
            case ChannelType.context:
                return this.createContext(dto, currentUserId);
        }
    }
    async createDirect(members: string[], currentUserId: string){
            const [userA, userB] = members;
            const existing = await this.prisma.channels.findFirst({
                where:{
                    type: ChannelType.direct,
                    AND: [
                        {members: {some:{userId: userA}}},
                        {members: {some:{userId: userB}}},
                    ],
                },
                include: {members: true},
            });
            if (existing){
                return existing;
            }
            return this.prisma.channels.create({
                data:{
                    type: ChannelType.direct,
                    title: '',
                    createdBy: currentUserId,
                    members:{
                        create:[
                        {userId: userA, role: ChannelRole.member},
                        {userId: userB, role: ChannelRole.member},
                        ],
                    }
                },
                include:{members: true}
            });
    }
    async createGroup(dto: CreateChannelDto, currentUserId: string){
        const memberIds = Array.from(new Set([currentUserId, ...dto.members]));
        return this.prisma.channels.create({
            data:{
                type: ChannelType.group,
                title: dto.title!,
                createdBy: currentUserId,
                members: {
                    create: memberIds.map((userId)=>({
                        userId,
                        role: userId===currentUserId?ChannelRole.owner:ChannelRole.member,
                    })),
                },
            },
            include: {members: true},
        });
    }
    async createContext(dto: CreateChannelDto, currentUserId: string){
        const existing = await this.prisma.channels.findFirst({
            where: {
                type: ChannelType.context,
                contextObjectId: dto.contextObjectId
            },
            include:{members: true},
        });
        if (existing){
            return existing;
        }
        const memberIds = Array.from(new Set([currentUserId, ...dto.members]));
        return this.prisma.channels.create({
            data:{
                type: ChannelType.context,
                title: dto.title!,
                contextObjectId: dto.contextObjectId,
                createdBy: currentUserId,
                members: {
                    create: memberIds.map((userId)=>({
                        userId,
                        role: userId===currentUserId?ChannelRole.owner:ChannelRole.member,
                    })),
                },
            },
            include: {members: true},
        });
    }

    async findById(id: string, currentUserId: string){
        const channel=await this.prisma.channels.findUnique({
            where: {id},
            include:{members: {include: {user: true}}},
        });
        if (!channel) throw new NotFoundException('Channel not found');
        const isMember= channel.members.some((m)=>m.userId===currentUserId);
        if (!isMember) throw new ForbiddenException('not a member of this channel');

        return channel;

    }

    async findUserChannels(currentUserId: string){
        const channels = await this.prisma.channels.findMany({
            where:{
                members: {some:{userId: currentUserId}}
            },
            include: {
                messages: {orderBy: {createdAt: 'desc'}, take:1},
            },
        });
        return channels.map((channel)=>({...channel, lastMessage: channel.messages[0] ?? null})).sort(
            (a,b)=>{
                const aTime=(a.lastMessage?.createdAt ?? a.createdAt).getTime();
                const bTime=(b.lastMessage?.createdAt ?? b.createdAt).getTime();
                return bTime - aTime;
            }
        );
    }
}