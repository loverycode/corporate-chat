const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const SECRET = process.env.CHAT_JWT_SECRET || 'secret-key';
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const CHANNEL_ID = process.argv[2];
const USER1 = process.argv[3];
const USER2 = process.argv[4];

function makeToken(sub) {
    return jwt.sign({ sub, name: 'LoadTest', email: 'x@test.com', role: 'USER' }, SECRET, { expiresIn: '10m' });
}

async function run() {
    const socket1 = io(TARGET_URL, { auth: { token: makeToken(USER1) } });
    const socket2 = io(TARGET_URL, { auth: { token: makeToken(USER2) } });

    await Promise.all([
        new Promise((resolve) => socket1.on('connect', resolve)),
        new Promise((resolve) => socket2.on('connect', resolve)),
    ]);

    const sendTime = Date.now();

    socket2.on('message.created', (msg) => {
        const latency = Date.now() - sendTime;
        console.log(`Задержка доставки: ${latency}мс`);
        process.exit(latency <= 1000 ? 0 : 1);
    });

    const token1 = makeToken(USER1);
    await fetch(`${TARGET_URL}/channels/${CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyMd: 'latency test', clientMessageId: require('crypto').randomUUID() }),
    });
}

run();
