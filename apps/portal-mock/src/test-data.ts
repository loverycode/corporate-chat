export const TEST_USERS = [
    { id: 'b4bf0b67-6b40-4035-8ee7-0a8f0984ac99', name: 'Тест Тестов', email: 'test@example.com', role: 'USER' },
    { id: '21be610f-8ec5-4225-8880-a80d7029c2ea', name: 'Второй Пользователь', email: 'user2@example.com', role: 'USER' },
];

export const TEST_OBJECTS: Record<string, { title: string; typeName: string; icon: string }> = {
    'a1000000-0000-4000-8000-000000000001': {
        title: 'Проект ТД-123',
        typeName: 'Проект',
        icon: 'Apartment',
    },
    'a1000000-0000-4000-8000-000000000002': {
        title: 'Задача №042 — Согласовать договор',
        typeName: 'Задача',
        icon: 'Assignment',
    },
};

export const OBJECT_ACCESS: Record<string, string[]> = {
    'a1000000-0000-4000-8000-000000000001': [
        'b4bf0b67-6b40-4035-8ee7-0a8f0984ac99',
        '21be610f-8ec5-4225-8880-a80d7029c2ea',
    ],
    'a1000000-0000-4000-8000-000000000002': [
        'b4bf0b67-6b40-4035-8ee7-0a8f0984ac99',
    ],
};