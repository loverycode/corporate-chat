import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomUUID } from 'crypto';

describe('Messages (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
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
    token = jwtService.sign(
      {
        sub: userId,
        name: 'E2E Test User',
        email: 'e2e@test.com',
        role: 'USER',
      },
      { secret: process.env.CHAT_JWT_SECRET },
    );
    const res = await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'group', title: 'E2E Test Channel', members: [userId] });
    channelId = res.body.id;
  });
  afterAll(async () => {
    await prisma.messages.deleteMany({ where: { channelId } });
    await prisma.channelMembers.deleteMany({ where: { channelId } });
    await prisma.channels.deleteMany({ where: { id: channelId } });
    await prisma.usersCache.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('отклоняет запрос без токена - 401', () => {
    return request(app.getHttpServer())
      .get(`/channels/${channelId}/messages`)
      .expect(401);
  });
  it('создаёт сообщение - 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bodyMd: 'тестовое сообщение', clientMessageId: randomUUID() })
      .expect(201);
    expect(res.body.bodyMd).toBe('тестовое сообщение');
  });
  it('защита от дублей - повторный запрос с тем же clientMessageId возвращает тот же id', async () => {
    const clientMessageId = randomUUID();
    const first = await request(app.getHttpServer())
      .post(`/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bodyMd: 'дубль тест', clientMessageId });
    const second = await request(app.getHttpServer())
      .post(`/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bodyMd: 'дубль тест', clientMessageId });
    expect(first.body.id).toBe(second.body.id);
  });
  it('не даёт доступ к чужому каналу - 403', async () => {
    const strangerToken = jwtService.sign(
      {
        sub: randomUUID(),
        name: 'Stranger',
        email: 'stranger@test.com',
        role: 'USER',
      },
      { secret: process.env.CHAT_JWT_SECRET },
    );
    return request(app.getHttpServer())
      .get(`/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(403);
  });
  it('подгружает историю с курсором', async () => {
    const res = await request(app.getHttpServer())
      .get(`/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
