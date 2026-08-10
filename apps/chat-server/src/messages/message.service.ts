import { PrismaService } from "../prisma/prisma.service";
import { CreateMessageDto } from "./create-message.dto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MessagesGateway } from "./messages.gateway";
import { ObjectsService } from "src/objects/objects.service";

@Injectable()
export class MessagesService{
    constructor(private readonly prisma: PrismaService,
                private readonly gateway: MessagesGateway,
                private readonly objectsService: ObjectsService,
    ){}
    private async assertMember(channelId: string, userId: string){
        const membership = await this.prisma.channelMembers.findUnique({
            where:{channelId_userId: {channelId, userId}},
        });
        if (!membership){
            throw new ForbiddenException('not a member of a channel');
        }
    }

    async create(channelId: string, dto: CreateMessageDto, authorId: string){
        await this.assertMember(channelId, authorId);
        const existing = await this.prisma.messages.findUnique({
            where:{
                channelId_clientMessageId:{channelId, clientMessageId: dto.clientMessageId},
            }
        });
        if (existing){
            return existing;
        }
        if (dto.replyToId){
            const original = await this.prisma.messages.findUnique({
                where: {id: dto.replyToId},
            });
            if (!original || original.channelId!==channelId){
                throw new NotFoundException('reply target not found in this channel');
            }
        }
        const message = await this.prisma.messages.create({
            data:{
                channelId,
                authorId,
                bodyMd: dto.bodyMd,
                replyToId: dto.replyToId,
                clientMessageId: dto.clientMessageId,
            },
        });
        const objectIds = this.objectsService.extractObjectIds(dto.bodyMd);
        if (objectIds.length > 0) {
            const resolved = await this.objectsService.resolveObjects(objectIds, authorId);
            for (const id of objectIds) {
                const obj = resolved.get(id);
                if (obj?.exists && obj.canRead && obj.title && obj.typeName && obj.icon) {
                    await this.prisma.objectRefs.create({
                        data: {
                            messageId: message.id,
                            objectId: id,
                            snapshotTitle: obj.title,
                            snapshotTypeName: obj.typeName,
                            snapshotIcon: obj.icon,
                        },
                    });
                }
            }
        }
        const messageWithRefs = await this.prisma.messages.findUnique({
            where:{id: message.id},
            include:{refs: true},
        });
        this.gateway.emitMessageCreated(channelId, messageWithRefs);
        return messageWithRefs;
    }

    async findHistory(channelId: string, userId: string, cursor?: string, limit = 30){
        await this.assertMember(channelId, userId);
        return this.prisma.messages.findMany({
            where:{channelId},
            orderBy:[{createdAt: 'desc'}, {id: 'desc'}],
            take: limit, 
            include: {refs: true},
            ...(cursor ? {skip:1, cursor: {id: cursor}}:{})
        });
    }
}