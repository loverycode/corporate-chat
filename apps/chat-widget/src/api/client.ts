import {type Channel, type Message, type Attachment, type ChannelMember, type SearchResult} from './types';
import { requestTokenRefresh } from '../postMessage';
const API_URL = import.meta.env.VITE_API_URL;
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL;
const PORTAL_ORIGIN = import.meta.env.VITE_PORTAL_ORIGIN;
if (!API_URL) {
    throw new Error('VITE_API_URL is not configured');
}
if (!PORTAL_URL) {
    throw new Error('VITE_PORTAL_URL is not configured');
}
if (!PORTAL_ORIGIN) {
    throw new Error('VITE_PORTAL_ORIGIN is not configured');
}


let authToken: string | null = null;

export function setAuthToken(token: string | null) {
    authToken = token;
    (window as any).authToken = token;
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
        if (res.status === 401) {
            requestTokenRefresh();
        }
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || `Request failed: ${res.status}`);
    }
    return res.json();
}

async function fetchAttachmentBlob(path: string): Promise<Blob> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: {
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
    });
    if (!res.ok) {
        if (res.status === 401) {
            requestTokenRefresh();
        }
        throw new Error(`Failed to load attachment: ${res.status}`);
    }
    return res.blob();
}

export const api = {
    getToken: (userId: string) => fetch(
        `${PORTAL_URL}/auth/token/${userId}`).then((r) => r.json()) as Promise<{ token: string }>,
    getChannels: () => request<Channel[]>('/channels'),
    getChannel: (channelId: string) => request<any>(`/channels/${channelId}`),
    getMessages: (channelId: string, cursor?: string)=> request<Message[]>(`/channels/${channelId}/messages${cursor ? `?cursor=${cursor}` : ''}`),
    getMembers: (channelId: string)=> request<{members: ChannelMember[]}>(`/channels/${channelId}`).then((ch)=>ch.members),
    sendMessage: (channelId: string, bodyMd: string, clientMessageId: string, attachmentIds: string[], replyToId?: string)=>
         request<Message>(`/channels/${channelId}/messages`,{method:'POST',body: JSON.stringify({bodyMd, clientMessageId, attachmentIds, replyToId}),}),
    uploadFile:(channelId: string, file: File, onProgress?:(percent: number)=>void, signal?: AbortSignal): Promise<Attachment>=>{
        return new Promise((resolve, reject)=>{
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('file', file);
            xhr.open('POST', `${API_URL}/channels/${channelId}/attachments`);
            if (authToken) {
                xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
            }
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    onProgress(Math.round((event.loaded / event.total) * 100));
                }
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            };
            xhr.onerror = () => reject(new Error('Upload failed'));
            xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
            if (signal) {
                signal.addEventListener('abort', () => xhr.abort());
            }
            xhr.send(formData);
        });
    },
    getAttachmentDownloadUrl: (attachmentId: string)=> `${API_URL}/attachments/${attachmentId}/download`,
    getAttachmentBlob: (attachmentId: string) => fetchAttachmentBlob(`/attachments/${attachmentId}/download`),
    getAttachmentThumbnailBlob: (attachmentId: string) => fetchAttachmentBlob(`/attachments/${attachmentId}/thumbnail`),
    markRead:(channelId: string, messageId: string)=>request<{ok: boolean}>(`/channels/${channelId}/read-mark`, 
        { method: 'PUT', body: JSON.stringify({ messageId }),
    }),
    getUnreadSummary:()=>request<{total: number; perChannel: Record<string, number>}>('/unread-summary'),
    editMessage:(messageId: string, bodyMd: string)=>request<Message>(`/messages/${messageId}`, {method:'PATCH', body: JSON.stringify({bodyMd})}),
    deleteMessage: (messageId: string) =>request<{ ok: boolean }>(`/messages/${messageId}`, { method: 'DELETE' }),
    getPortalUsers: () => fetch(`${PORTAL_URL}/users`).then((r) => r.json()) as Promise<{ id: string; name: string }[]>,
    createChannel: (type: string, members: string[], title?: string, contextObjectId?: string, description?:string) =>request<Channel>('/channels', { method: 'POST', body: JSON.stringify({ type, members, title, contextObjectId, description }) }),
    addReaction: (messageId: string, emoji: string)=>request<{ok: boolean}>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: 'PUT' }),
    removeReaction: (messageId: string, emoji: string)=>request<{ok: boolean}>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: 'DELETE' }),
    getOnlinePresence: () => request<string[]>('/presence'),
    search: (query: string, channelId?: string)=>request<SearchResult[]>(`/search?q=${encodeURIComponent(query)}${channelId ? `&channelId=${channelId}` : ''}`),
    getMessagePosition: (channelId: string, messageId: string) => request<{ newerCount: number }>(`/channels/${channelId}/messages/${messageId}/position`),
    updateChannel: (channelId: string, data: { title?: string; description?: string }) => request<Channel>(`/channels/${channelId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    addChannelMembers: (channelId: string, userIds: string[]) => request<Channel>(`/channels/${channelId}/members`, { method: 'POST', body: JSON.stringify({ userIds }) }),
    removeChannelMember: (channelId: string, userId: string) => request<{ ok: boolean }>(`/channels/${channelId}/members/${userId}`, { method: 'DELETE' }),
    deleteChannel: (channelId: string) => request<{ ok: boolean }>(`/channels/${channelId}`, { method: 'DELETE' }),
}
