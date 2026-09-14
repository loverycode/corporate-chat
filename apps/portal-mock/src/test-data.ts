export const TEST_USERS = [
    { id: 'b4bf0b67-6b40-4035-8ee7-0a8f0984ac99', name: 'Юрий Тестировщик', email: 'test@example.com', role: 'USER' },
    { id: '21be610f-8ec5-4225-8880-a80d7029c2ea', name: 'Андрей Проджект', email: 'user2@example.com', role: 'USER' },
    { id: 'c3d4e5f6-1a2b-4c3d-9e4f-5a6b7c8d9e0f', name: 'Мария Иванова', email: 'user3@example.com', role: 'USER' },
    { id: 'd4e5f6a7-2b3c-4d4e-8f5a-6b7c8d9e0f1a', name: 'Дмитрий Петров', email: 'user4@example.com', role: 'USER' },
    { id: 'e5f6a7b8-3c4d-4e5f-9a6b-7c8d9e0f1a2b', name: 'Анна Смирнова', email: 'user5@example.com', role: 'ADMIN' },
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
        'c3d4e5f6-1a2b-4c3d-9e4f-5a6b7c8d9e0f',
        'd4e5f6a7-2b3c-4d4e-8f5a-6b7c8d9e0f1a',
        'e5f6a7b8-3c4d-4e5f-9a6b-7c8d9e0f1a2b',
    ],
    'a1000000-0000-4000-8000-000000000002': [
        'b4bf0b67-6b40-4035-8ee7-0a8f0984ac99',
    ],
};