import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomUUID } from 'crypto';

describe('Channels (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let secondUserId: string;
  let channelId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    prisma = moduleFixture.get(PrismaService);
    userId = randomUUID();
    secondUserId = randomUUID();
    await prisma.usersCache.createMany({
      data: [
        { id: userId, name: 'E2E Test User', email: `e2e-${userId}@test.com` },
        {
          id: secondUserId,
          name: 'E2E Second User',
          email: `e2e-${secondUserId}@test.com`,
        },
      ],
    });

    token = jwtService.sign(
      {
        sub: userId,
        name: 'E2E Test User',
        email: `e2e-${userId}@test.com`,
        role: 'USER',
      },
      { secret: process.env.CHAT_JWT_SECRET },
    );
  });

  afterAll(async () => {
    await prisma.messages.deleteMany({ where: { channelId } });
    await prisma.channelMembers.deleteMany({ where: { channelId } });
    await prisma.channels.deleteMany({ where: { id: channelId } });

    await prisma.usersCache.deleteMany({
      where: {
        id: { in: [userId, secondUserId] },
      },
    });
    await app.close();
  });

  it('создаёт group channel - 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'group',
        title: 'E2E Test Channel',
        members: [userId, secondUserId],
      })
      .expect(201);

    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'group',
        title: 'E2E Test Channel',
        createdBy: userId,
      }),
    );

    expect(res.body.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId,
          role: 'owner',
        }),
        expect.objectContaining({
          userId: secondUserId,
          role: 'member',
        }),
      ]),
    );
    channelId = res.body.id;
  });

  it('возвращает каналы пользователя - 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/channels')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: channelId,
          type: 'group',
          title: 'E2E Test Channel',
          unreadCount: expect.any(Number),
        }),
      ]),
    );
  });

  it('возвращает channel по id - 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/channels/${channelId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        id: channelId,
        type: 'group',
        title: 'E2E Test Channel',
        createdBy: userId,
      }),
    );
    expect(res.body.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId,
          role: 'owner',
        }),
      ]),
    );
  });

  it('возвращает 404 для несуществующего channel', async () => {
    const fakeChannelId = randomUUID();
    await request(app.getHttpServer())
      .get(`/channels/${fakeChannelId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('возвращает 403 если пользователь не является member channel', async () => {
    const thirdUserId = randomUUID();
    await prisma.usersCache.create({
      data: {
        id: thirdUserId,
        name: 'E2E Third User',
        email: `e2e-${thirdUserId}@test.com`,
      },
    });

    const thirdToken = jwtService.sign(
      {
        sub: thirdUserId,
        name: 'E2E Third User',
        email: `e2e-${thirdUserId}@test.com`,
        role: 'USER',
      },
      { secret: process.env.CHAT_JWT_SECRET },
    );

    await request(app.getHttpServer())
      .get(`/channels/${channelId}`)
      .set('Authorization', `Bearer ${thirdToken}`)
      .expect(403);

    await prisma.usersCache.delete({
      where: { id: thirdUserId },
    });
  });

  it('не создаёт group channel без title - 400', async () => {
    await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'group',
        members: [secondUserId],
      })
      .expect(400);
  });

  it('не создаёт group channel без members - 400', async () => {
    await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'group',
        title: 'Invalid Channel',
        members: [],
      })
      .expect(400);
  });

  it('создаёт direct channel - 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'direct',
        members: [userId, secondUserId],
      })
      .expect(201);

    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'direct',
        createdBy: userId,
      }),
    );

    expect(res.body.members).toHaveLength(2);

    await prisma.channelMembers.deleteMany({
      where: { channelId: res.body.id },
    });

    await prisma.channels.delete({
      where: { id: res.body.id },
    });
  });

  it('не создаёт direct channel с количеством участников не равным 2 - 400', async () => {
    await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'direct',
        members: [userId],
      })
      .expect(400);
  });

  it('не создаёт direct channel если текущий пользователь не является member - 403', async () => {
    const thirdUserId = randomUUID();

    await prisma.usersCache.create({
      data: {
        id: thirdUserId,
        name: 'E2E Third User',
        email: `e2e-${thirdUserId}@test.com`,
      },
    });

    await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'direct',
        members: [secondUserId, thirdUserId],
      })
      .expect(403);

    await prisma.usersCache.delete({
      where: { id: thirdUserId },
    });
  });

  it('возвращает существующий direct channel вместо создания нового', async () => {
    const first = await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'direct',
        members: [userId, secondUserId],
      })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'direct',
        members: [userId, secondUserId],
      })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    await prisma.channelMembers.deleteMany({
      where: { channelId: first.body.id },
    });

    await prisma.channels.delete({
      where: { id: first.body.id },
    });
  });

  it('требует авторизацию при создании channel - 401', async () => {
    await request(app.getHttpServer())
      .post('/channels')
      .send({
        type: 'group',
        title: 'Unauthorized Channel',
        members: [userId],
      })
      .expect(401);
  });

  it('требует авторизацию при получении channels - 401', async () => {
    await request(app.getHttpServer()).get('/channels').expect(401);
  });
});
