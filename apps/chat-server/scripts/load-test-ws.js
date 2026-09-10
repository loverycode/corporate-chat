const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const SECRET = process.env.CHAT_JWT_SECRET || 'secret-key';
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const CONNECTIONS = parseInt(process.argv[2] || '500', 10);

let connected = 0;
let failed = 0;
const startTime = Date.now();

function makeToken(sub) {
    return jwt.sign({ sub, name: `LoadTest${sub}`, email: `${sub}@test.com`, role: 'USER' }, SECRET, { expiresIn: '10m' });
}

console.log(`Открываем ${CONNECTIONS} WebSocket-соединений...`);

for (let i = 0; i < CONNECTIONS; i++) {
    const userId = require('crypto').randomUUID();
    const socket = io(TARGET_URL, { auth: { token: makeToken(userId) }, reconnection: false });

    socket.on('connect', () => {
        connected++;
        if (connected + failed === CONNECTIONS) report();
    });

    socket.on('connect_error', (err) => {
        failed++;
        if (connected + failed === CONNECTIONS) report();
    });
}

function report() {
    const elapsed = Date.now() - startTime;
    console.log(`Результат: ${connected} подключено, ${failed} не удалось, за ${elapsed}мс`);
    process.exit(failed > 0 ? 1 : 0);
}

setTimeout(() => {
    console.log(`Таймаут. Итог на этот момент: ${connected} подключено, ${failed} не удалось`);
    process.exit(1);
}, 30000);