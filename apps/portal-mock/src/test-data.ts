export const TEST_USERS = [
    { id: 'b4bf0b67-6b40-4035-8ee7-0a8f0984ac99', name: 'Тест Тестов', email: 'test@example.com', role: 'USER' },
    { id: '21be610f-8ec5-4225-8880-a80d7029c2ea', name: 'Второй Пользователь', email: 'user2@example.com', role: 'USER' },
];

export const TEST_OBJECTS: Record<string, { title: string; type: string; url: string; thumbnailUrl: string | null }> = {
    'deal-001': {
        title: 'Сделка №001 — Поставка оборудования',
        type: 'deal',
        url: 'https://portal.example.com/deals/001',
        thumbnailUrl: null,
    },
    'task-042': {
        title: 'Задача №042 — Согласовать договор',
        type: 'task',
        url: 'https://portal.example.com/tasks/042',
        thumbnailUrl: null,
    },
};