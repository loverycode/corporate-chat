import {type Channel, type Message, type Attachment, type ChannelMember, type SearchResult} from './types';
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
    getMembers: (channelId: string)=> request<{members: ChannelMember[]}>(`/channels/${channelId}`).then((ch)=>ch.members),
    sendMessage: (channelId: string, bodyMd: string, clientMessageId: string, attachmentIds: string[], replyToId?: string)=>
         request<Message>(`/channels/${channelId}/messages`,{method:'POST',body: JSON.stringify({bodyMd, clientMessageId, attachmentIds, replyToId}),}),
    uploadFile:(channelId: string, file: File)=>{
        const formData = new FormData();
        formData.append('file', file);
        return fetch(`${API_URL}/channels/${channelId}/attachments`, {
            method: 'POST', headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            body: formData,
        }).then((r) => r.json()) as Promise<Attachment>;
    },
    getAttachmentDownloadUrl: (attachmentId: string)=> `${API_URL}/attachments/${attachmentId}/download`,
    markRead:(channelId: string, messageId: string)=>request<{ok: boolean}>(`/channels/${channelId}/read-mark`, 
        { method: 'PUT', body: JSON.stringify({ messageId }),
    }),
    getUnreadSummary:()=>request<{total: number; perChannel: Record<string, number>}>('/unread-summary'),
    editMessage:(messageId: string, bodyMd: string)=>request<Message>(`/messages/${messageId}`, {method:'PATCH', body: JSON.stringify({bodyMd})}),
    deleteMessage: (messageId: string) =>request<{ ok: boolean }>(`/messages/${messageId}`, { method: 'DELETE' }),
    getPortalUsers: () => fetch(`${PORTAL_URL}/users`).then((r) => r.json()) as Promise<{ id: string; name: string }[]>,
    createChannel: (type: string, members: string[], title?: string, contextObjectId?: string) =>request<Channel>('/channels', { method: 'POST', body: JSON.stringify({ type, members, title, contextObjectId }) }),
    addReaction: (messageId: string, emoji: string)=>request<{ok: boolean}>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: 'PUT' }),
    removeReaction: (messageId: string, emoji: string)=>request<{ok: boolean}>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: 'DELETE' }),
    getOnlinePresence: () => request<string[]>('/presence'),
    search: (query: string, channelId?: string)=>request<SearchResult[]>(`/search?q=${encodeURIComponent(query)}${channelId ? `&channelId=${channelId}` : ''}`),
    getMessagePosition: (channelId: string, messageId: string) => request<{ newerCount: number }>(`/channels/${channelId}/messages/${messageId}/position`),
}
