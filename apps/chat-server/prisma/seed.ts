import { PrismaClient, ChannelType, ChannelRole } from '@prisma/client';
const prisma = new PrismaClient();
const USERS = [
    { id: 'b4bf0b67-6b40-4035-8ee7-0a8f0984ac99', name: 'Тест Тестов', email: 'test@example.com' },
    { id: '21be610f-8ec5-4225-8880-a80d7029c2ea', name: 'Второй Пользователь', email: 'test2@example.com' },
    { id: 'c1a2b3c4-1111-4222-8333-444455556666', name: 'Третий Пользователь', email: 'user3@example.com' },
    { id: 'd2b3c4d5-2222-4333-8444-555566667777', name: 'Четвёртый Пользователь', email: 'user4@example.com' },
];

async function main() {
    for (const u of USERS) {
        await prisma.usersCache.upsert({ where: { id: u.id }, update: {}, create: u });
    }

    const existingChannel = await prisma.channels.findFirst({ where: { type: ChannelType.direct } });
    if (existingChannel) {
        console.log('Seed data already exists, skipping.');
        return;
    }

    const direct = await prisma.channels.create({
        data: {
            type: ChannelType.direct,
            title: '',
            createdBy: USERS[0].id,
            members: { create: [
                { userId: USERS[0].id, role: ChannelRole.member },
                { userId: USERS[1].id, role: ChannelRole.member },
            ] },
        },
    });

    const group = await prisma.channels.create({
        data: {
            type: ChannelType.group,
            title: 'Общий чат',
            description: 'Демонстрационная группа',
            createdBy: USERS[0].id,
            members: { create: USERS.map((u, i) => ({
                userId: u.id,
                role: i === 0 ? ChannelRole.owner : ChannelRole.member,
            })) },
        },
    });

    const sampleMessages = ['Привет!', 'Как дела?', 'Всё отлично, работаем над проектом', 'Отлично, продолжаем'];
    for (const [i, text] of sampleMessages.entries()) {
        await prisma.messages.create({
            data: {
                channelId: direct.id,
                authorId: USERS[i % 2].id,
                bodyMd: text,
                clientMessageId: `seed-${i}-${Date.now()}`,
            },
        });
    }

    console.log('Seed data created.');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
