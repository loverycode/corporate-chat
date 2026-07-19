import {Test, TestingModule} from '@nestjs/testing'
import { ChannelsService } from './channels.service'
import { ChannelRole, ChannelType } from '@prisma/client'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

describe('ChannelsService', ()=>{
    let service: ChannelsService;
    let prisma: {
        channels:{
            findFirst: jest.Mock;
            findMany: jest.Mock;
            findUnique: jest.Mock;
            create: jest.Mock;
        };
    };
    beforeEach(async ()=>{
        prisma={
            channels:{
                findFirst: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                create: jest.fn(),
            },
        };
        const module: TestingModule = await Test.createTestingModule({
            providers:[
                ChannelsService,
                {provide: PrismaService, useValue: prisma},
            ],
        }).compile();
        service = module.get<ChannelsService>(ChannelsService);
    });
    describe('validation', ()=>{
        it('direct: BadRequestException, если участников не 2', async () =>{
            await expect(
                service.create(
                    { type: ChannelType.direct, members: ['user-1'] } as any, 'user-1',
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('group: BadRequestException, если title отсутствует', async ()=>{
            await expect(
                service.create(
                    {type: ChannelType.group, members:['user-1', 'user-2']} as any, 'user-1',
                ),
            ).rejects.toThrow(BadRequestException);
        });
        it('group: BadRequestException, если участников нет', async ()=>{
            await expect(
                service.create(
                    {type: ChannelType.group, title:'Корпоративный', members:[]} as any, 'user-1',
                ),
            ).rejects.toThrow(BadRequestException);
        });
        it('group: BadRequestException, если отсутствует contextObjectId', async ()=>{
            await expect(
                service.create(
                    {type: ChannelType.context, members:['user-1']} as any, 'user-1',
                ),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('createDirect', ()=>{
        it('ForbiddenException, если текущий пользователь не в members', async ()=>{
            await expect(
                service.create(
                    {type: ChannelType.direct, members:['user-2','user-3']} as any, 'user-1',
                ),
            ).rejects.toThrow(ForbiddenException);
        });
        it('возвращает существующий канал, если он уже есть', async ()=>{
            const existingChannel={
                id: 'channel-1',
                type: ChannelType.direct,
                members: [{userId:'user-1', role: ChannelRole.member},
                        {userId:'user-2', role: ChannelRole.member}],
            };
            prisma.channels.findFirst.mockResolvedValue(existingChannel);

            const result = await service.create(
                {type: ChannelType.direct, members:['user-1', 'user-2']} as any, 'user-1',
            );

            expect(result).toBe(existingChannel);
            expect(prisma.channels.create).not.toHaveBeenCalled();
        });

        it('создаёт новый канал, если такой не существует', async () => {
            prisma.channels.findFirst.mockResolvedValue(null);
            prisma.channels.create.mockResolvedValue({ id: 'new-channel' });

            const result = await service.create(
                { type: ChannelType.direct, members: ['user-1', 'user-2'] } as any,
                'user-1',
            );

            expect(result).toEqual({ id: 'new-channel' });
            expect(prisma.channels.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: ChannelType.direct,
                        createdBy: 'user-1',
                        members: {
                            create: [
                                { userId: 'user-1', role: ChannelRole.member },
                                { userId: 'user-2', role: ChannelRole.member },
                            ],
                        },
                    }),
                }),
            );
        });
    });
    describe('createGroup (через create)', () => {
        it('создатель становится owner, остальные — member', async () => {
            prisma.channels.create.mockResolvedValue({ id: 'group-1' });

            await service.create(
                {
                type: ChannelType.group,
                title: 'Отдел продаж',
                members: ['user-2', 'user-3'],
                } as any,
                'user-1',
            );

            expect(prisma.channels.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        title: 'Отдел продаж',
                        members: {
                            create: expect.arrayContaining([
                                { userId: 'user-1', role: ChannelRole.owner },
                                { userId: 'user-2', role: ChannelRole.member },
                                { userId: 'user-3', role: ChannelRole.member },
                            ]),
                        },
                    }),
                }),
            );
        });
        it('не дублирует создателя, если он уже есть в members', async () => {
            prisma.channels.create.mockResolvedValue({ id: 'group-1' });

            await service.create(
                { type: ChannelType.group, title: 'Отдел продаж', members: ['user-1', 'user-2'], } as any,
                'user-1',
            );

            const callArg = prisma.channels.create.mock.calls[0][0];
            const createdMembers = callArg.data.members.create;
            expect(createdMembers).toHaveLength(2);
        });
    });

    describe('createContext (через create)', () => {
        it('возвращает существующий канал объекта, если он уже есть', async () => {
            const existing = { id: 'ctx-1', contextObjectId: 'obj-1' };
            prisma.channels.findFirst.mockResolvedValue(existing);

            const result = await service.create(
                {
                    type: ChannelType.context,
                    contextObjectId: 'obj-1',
                    members: ['user-1'],
                } as any, 'user-1',
            );

            expect(result).toBe(existing);
            expect(prisma.channels.create).not.toHaveBeenCalled();
        });

        it('создаёт новый канал с owner = создатель', async () => {
            prisma.channels.findFirst.mockResolvedValue(null);
            prisma.channels.create.mockResolvedValue({ id: 'ctx-new' });

            await service.create(
                {
                type: ChannelType.context,
                contextObjectId: 'obj-1',
                members: ['user-1', 'user-2'],
                } as any,
                'user-1',
            );

            expect(prisma.channels.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        contextObjectId: 'obj-1',
                        members: {
                            create: expect.arrayContaining([
                                { userId: 'user-1', role: ChannelRole.owner },
                                { userId: 'user-2', role: ChannelRole.member },
                            ]),
                        },
                    }),
                }),
            );
        });
    });

    describe('findById', () => {
        it('бросает NotFoundException, если канала нет', async () => {
            prisma.channels.findUnique.mockResolvedValue(null);
            await expect(service.findById('missing-id', 'user-1')).rejects.toThrow( NotFoundException,);
        });

        it('бросает ForbiddenException, если пользователь не участник', async () => {
            prisma.channels.findUnique.mockResolvedValue({
                id: 'channel-1',
                members: [{ userId: 'someone-else' }],
            });

            await expect(service.findById('channel-1', 'user-1')).rejects.toThrow( ForbiddenException,);
        });

        it('возвращает канал, если пользователь участник', async () => {
        const channel = {
            id: 'channel-1',
            members: [{ userId: 'user-1' }, { userId: 'user-2' }],
        };
        prisma.channels.findUnique.mockResolvedValue(channel);

        const result = await service.findById('channel-1', 'user-1');
        expect(result).toBe(channel);
        });
    });

    describe('findUserChannels', () => {
        it('сортирует каналы по времени последнего сообщения (новые сверху)', async () => {
            const older = {
                id: 'channel-old',
                createdAt: new Date('2026-01-01'),
                messages: [{ createdAt: new Date('2026-01-02') }],
            };
            const newer = {
                id: 'channel-new',
                createdAt: new Date('2026-01-01'),
                messages: [{ createdAt: new Date('2026-01-10') }],
            };
            prisma.channels.findMany.mockResolvedValue([older, newer]);

            const result = await service.findUserChannels('user-1');

            expect(result[0].id).toBe('channel-new');
            expect(result[1].id).toBe('channel-old');
        });

        it('использует createdAt канала, если сообщений ещё нет', async () => {
            const empty = {
                id: 'channel-empty',
                createdAt: new Date('2026-01-05'),
                messages: [],
            };
            const withMsg = {
                id: 'channel-with-msg',
                createdAt: new Date('2026-01-01'),
                messages: [{ createdAt: new Date('2026-01-03') }],
            };
            prisma.channels.findMany.mockResolvedValue([empty, withMsg]);
            const result = await service.findUserChannels('user-1');
            expect(result[0].id).toBe('channel-empty');
        });
    });
})