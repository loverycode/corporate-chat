import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomUUID } from 'crypto';

describe('Attachments (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let channelId: string;
  let attachmentId: string;

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
    await prisma.attachments.deleteMany({ where: { uploaderId: userId } });
    await prisma.messages.deleteMany({ where: { channelId } });
    await prisma.channelMembers.deleteMany({ where: { channelId } });
    await prisma.channels.deleteMany({ where: { id: channelId } });
    await prisma.usersCache.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('загружает файл - 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/channels/${channelId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('E2E test file'), 'test.txt')
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.uploaderId).toBe(userId);
    expect(res.body.fileName).toBe('test.txt');
    expect(res.body.mime).toBe('text/plain');
    expect(res.body.size).toBe(13);
    expect(res.body.storageKey).toContain(`channels/${channelId}/`);
    expect(res.body.thumbKey).toBeNull();
    attachmentId = res.body.id;
  });

  it('возвращает ошибку без авторизации - 401', async () => {
    await request(app.getHttpServer())
      .post(`/channels/${channelId}/attachments`)
      .attach('file', Buffer.from('E2E test file'), 'test.txt')
      .expect(401);
  });

  it('загружает изображение и создаёт миниатюру - 201', async () => {
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );

    const res = await request(app.getHttpServer())
      .post(`/channels/${channelId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', imageBuffer, 'test.png')
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.mime).toBe('image/png');
    expect(res.body.thumbKey).toContain('-thumb.jpg');

    attachmentId = res.body.id;
  });

  it('отклоняет опасное расширение - 400', async () => {
    await request(app.getHttpServer())
      .post(`/channels/${channelId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake executable'), 'virus.exe')
      .expect(400);
  });

  it('отклоняет слишком большой файл - 400', async () => {
    const largeBuffer = Buffer.alloc(50 * 1024 * 1024 + 1);

    await request(app.getHttpServer())
      .post(`/channels/${channelId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', largeBuffer, 'large.txt')
      .expect(400);
  });

  it('скачивает существующее вложение - 302', async () => {
    const res = await request(app.getHttpServer())
      .get(`/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${token}`)
      .expect(302);
    expect(res.headers.location).toBeDefined();
  });

  it('возвращает ошибку для несуществующего вложения - 404', async () => {
    await request(app.getHttpServer())
      .get(`/attachments/${randomUUID()}/download`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('возвращает ошибку без авторизации при скачивании - 401', async () => {
    await request(app.getHttpServer())
      .get(`/attachments/${attachmentId}/download`)
      .expect(401);
  });
});
