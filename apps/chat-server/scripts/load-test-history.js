const jwt = require('jsonwebtoken');
const SECRET = process.env.CHAT_JWT_SECRET || 'secret-key';
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const CHANNEL_ID = process.argv[2]; 
const ITERATIONS = 20;

async function run() {
    const token = jwt.sign({ sub: require('crypto').randomUUID(), name: 'LoadTest', email: 'x@test.com', role: 'USER' }, SECRET, { expiresIn: '10m' });
    const durations = [];

    for (let i = 0; i < ITERATIONS; i++) {
        const start = Date.now();
        const res = await fetch(`${TARGET_URL}/channels/${CHANNEL_ID}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        await res.json();
        durations.push(Date.now() - start);
    }

    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    console.log(`История (${ITERATIONS} запросов): p50=${p50}мс, p95=${p95}мс, все=${durations.join(', ')}мс`);
}

run();