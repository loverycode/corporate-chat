import type {Channel, Message} from './types';
const API_URL = 'http://127.0.0.1:3000';
const PORTAL_URL = 'http://127.0.0.1:3001';
let authToken: string | null = null;

export function setAuthToken(token: string) {
    authToken = token;
}

export function getAuthToken() {
    return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...options.headers,
        },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Request failed: ${res.status}`);
    }
    return res.json();
}

export const api = {
    getToken: (userId: string) => fetch(
        `${PORTAL_URL}/auth/token/${userId}`).then((r) => r.json()) as Promise<{ token: string }>,
    getChannels: () => request<Channel[]>('/channels'),
    getMessages: (channelId: string, cursor?: string)=> request<Message[]>(`/channels/${channelId}/messages${cursor ? `?cursor=${cursor}` : ''}`),
    sendMessage: (channelId: string, bodyMd: string, clientMessageId: string)=>
         request<Message>(`/channels/${channelId}/messages`,{
            method:'POST',
            body: JSON.stringify({bodyMd, clientMessageId}),
         })
};