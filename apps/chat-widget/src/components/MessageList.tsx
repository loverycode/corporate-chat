import { useEffect, useState, useRef } from 'react';
import { Box, Typography, CircularProgress, Button, Stack, Paper, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import type { ChannelMember, Message } from '../api/types';
import { api } from '../api/client';
import { getSocket } from '../api/socket';
import { MessageInput } from './MessageInput';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { renderMessageBody } from '../utils/renderMessageBody';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplyIcon from '@mui/icons-material/Reply';
function getTypingLabel(userIds: Set<string>, members: { userId: string; name: string }[]): string {
    const names = Array.from(userIds).map((id) => members.find((m) => m.userId === id)?.name || 'Кто-то');
    if (names.length === 1) return `${names[0]} печатает…`;
    return `${names.join(', ')} печатают…`;
}

export function MessageList({ channelId, currentUserId }: { channelId: string; currentUserId: string }) {
    const [messages, setMessages] = useState<Message[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [members, setMembers] = useState<ChannelMember[]>([]);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const lastReadIdRef = useRef<string | null>(null);

    const simpleMembers = members.map((m) => ({ userId: m.userId, name: m.user?.name || m.userId }));
    const mentionedMembers = simpleMembers.filter((m) => m.userId !== currentUserId);

    const [editingMessage, setEditingMessage] = useState<{ id: string; bodyMd: string } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; messageId: string } | null>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [replyingTo, setReplyingTo] = useState<{id: string; bodyMd: string; authorName: string} | null>(null);

    useEffect(() => {
        setMessages(null);
        setError(null);
        setHasMore(true);
        lastReadIdRef.current = null;

        api.getMessages(channelId).then((data) => {
            setMessages(data);
            if (data.length < 30) setHasMore(false);
        }).catch((err) => setError(err.message));

        api.getMembers(channelId).then((data) => {
            setMembers(data);
            const own = data.find((m) => m.userId === currentUserId);
            lastReadIdRef.current = own?.lastReadMessageId ?? null;
        }).catch(() => {});
    }, [channelId]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        function handleNewMessage(msg: Message) {
            if (msg.channelId !== channelId) return;
            setMessages((prev) => {
                if (!prev) return prev;
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [msg, ...prev];
            });
        }
        function handleUpdated(msg: Message) {
            if (msg.channelId !== channelId) return;
            setMessages((prev) => prev?.map((m) => (m.id === msg.id ? msg : m)) ?? prev);
        }
        function handleDeleted(data: { id: string; channelId: string }) {
            if (data.channelId !== channelId) return;
            setMessages((prev) =>
                prev?.map((m) => (m.id === data.id ? { ...m, bodyMd: '', files: [], deletedAt: new Date().toISOString() } : m)) ?? prev,
            );
        }

        socket.on('message.created', handleNewMessage);
        socket.on('message.updated', handleUpdated);
        socket.on('message.deleted', handleDeleted);
        return () => {
            socket.off('message.created', handleNewMessage);
            socket.off('message.updated', handleUpdated);
            socket.off('message.deleted', handleDeleted);
        };
    }, [channelId]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        function handleTyping(data: { channelId: string; userId: string }) {
            if (data.channelId !== channelId) return;
            setTypingUsers((prev) => new Set(prev).add(data.userId));

            const existing = typingTimeouts.current.get(data.userId);
            if (existing) clearTimeout(existing);
            typingTimeouts.current.set(
                data.userId,
                setTimeout(() => {
                    setTypingUsers((prev) => {
                        const next = new Set(prev);
                        next.delete(data.userId);
                        return next;
                    });
                }, 3000),
            );
        }

        socket.on('typing', handleTyping);
        return () => { socket.off('typing', handleTyping); };
    }, [channelId]);

    useEffect(() => {
        if (messages && messages.length > 0) {
            api.markRead(channelId, messages[0].id).catch(() => {});
        }
    }, [channelId, messages?.[0]?.id]);

    async function handleLoadMore() {
        if (!messages || messages.length === 0) return;
        setLoadingMore(true);
        try {
            const oldest = messages[messages.length - 1];
            const older = await api.getMessages(channelId, oldest.id);
            setMessages([...messages, ...older]);
            if (older.length < 30) setHasMore(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        } finally {
            setLoadingMore(false);
        }
    }

    async function handleSend(text: string, attachmentIds: string[]): Promise<boolean> {
        const clientMessageId = crypto.randomUUID();
        try {
            const message = await api.sendMessage(channelId, text, clientMessageId, attachmentIds, replyingTo?.id);
            setMessages((prev) => {
                if (!prev) return prev;
                if (prev.some((m) => m.id === message.id)) return prev;
                return [message, ...prev];
            });
            setReplyingTo(null);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
            return false;
        }
    }

    async function handleEditSubmit(messageId: string, text: string) {
        try {
            const updated = await api.editMessage(messageId, text);
            setMessages((prev) => prev?.map((m) => (m.id === messageId ? updated : m)) ?? prev);
        } catch (err) {
            console.error(err);
        }
    }

    async function handleDelete(messageId: string) {
        try {
            await api.deleteMessage(messageId);
            setMessages((prev) =>
                prev?.map((m) => (m.id === messageId ? { ...m, bodyMd: '', files: [], deletedAt: new Date().toISOString() } : m)) ?? prev,
            );
        } catch (err) {
            console.error(err);
        }
    }
    function handleStartReply() {
       if (!contextMenu) return;
       const message = messages?.find((m)=>m.id === contextMenu.messageId);
       if (!message) return;
       const authorName = simpleMembers.find((m)=>m.userId===message.authorId)?.name || 'Пользователь';
       setReplyingTo({id:message.id, bodyMd: message.bodyMd, authorName});
    }

    function openMessageMenu(msg: Message, mouseX: number, mouseY: number) {
        if (msg.deletedAt) return;
        setContextMenu({ mouseX, mouseY, messageId: msg.id });
    }
    function handleContextMenu(event: React.MouseEvent, msg: Message) {
        event.preventDefault();
        openMessageMenu(msg, event.clientX, event.clientY);
    }
    function handleTouchStart(event: React.TouchEvent, msg: Message) {
        if (msg.authorId !== currentUserId || msg.deletedAt) return;
        const touch = event.touches[0];
        longPressTimer.current = setTimeout(() => openMessageMenu(msg, touch.clientX, touch.clientY), 500);
    }
    function clearLongPress() {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }
    function handleCloseContextMenu() {
        setContextMenu(null);
    }
    function handleStartEdit() {
        if (!contextMenu) return;
        const message = messages?.find((m) => m.id === contextMenu.messageId);
        setContextMenu(null);
        if (!message) return;
        setEditingMessage({ id: message.id, bodyMd: message.bodyMd });
    }
    function handleContextDelete() {
        if (!contextMenu) return;
        const messageId = contextMenu.messageId;
        setContextMenu(null);
        handleDelete(messageId);
    }

    function scrollToMessage(messageId: string) {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'background-color 0.3s';
            el.style.backgroundColor = 'rgba(59, 90, 122, 0.15)';
            setTimeout(() => { el.style.backgroundColor = ''; }, 1500);
        }
    }

    const boundaryIndex = messages && lastReadIdRef.current
        ? messages.findIndex((m) => m.id === lastReadIdRef.current)
        : -1;

    return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', minHeight: 48 }}>
                {typingUsers.size > 0 && (
                    <Typography variant="caption" color="text.secondary">
                        {getTypingLabel(typingUsers, simpleMembers)}
                    </Typography>
                )}
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {error && <Typography color="error">{error}</Typography>}
                {!messages && !error && <CircularProgress size={24} />}
                {messages && (
                    <Stack spacing={1} sx={{ flexDirection: 'column-reverse' }}>
                        {messages.map((msg, index) => (
                            <Box key={msg.id} sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Paper
                                    variant="outlined"
                                    onContextMenu={(event) => handleContextMenu(event, msg)}
                                    onTouchStart={(event) => handleTouchStart(event, msg)}
                                    onTouchEnd={clearLongPress}
                                    onTouchMove={clearLongPress}
                                    onTouchCancel={clearLongPress}
                                    id={`msg-${msg.id}`}
                                    sx={{
                                        p: 1.5,
                                        maxWidth: '70%',
                                        alignSelf: msg.authorId === currentUserId ? 'flex-end' : 'flex-start',
                                        bgcolor: msg.authorId === currentUserId ? 'primary.main' : 'background.paper',
                                        color: msg.authorId === currentUserId ? 'primary.contrastText' : 'text.primary',
                                        cursor: msg.authorId === currentUserId && !msg.deletedAt ? 'context-menu' : 'default',
                                        userSelect: 'none',
                                    }}
                                >
                                    {msg.files && msg.files.length > 0 && (
                                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                                            {msg.files.map((att) =>
                                                att.mime.startsWith('image/') ? (
                                                    <a key={att.id} href={api.getAttachmentDownloadUrl(att.id)} target="_blank" rel="noreferrer">
                                                        <img
                                                            src={api.getAttachmentDownloadUrl(att.id)}
                                                            alt={att.fileName}
                                                            style={{ maxWidth: 200, maxHeight: 200, borderRadius: 4, display: 'block' }}
                                                        />
                                                    </a>
                                                ) : (
                                                    
                                                    <a key={att.id}
                                                        href={api.getAttachmentDownloadUrl(att.id)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ textDecoration: 'none' }}
                                                    >
                                                        <Paper variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <InsertDriveFileIcon fontSize="small" />
                                                            <Box>
                                                                <Typography variant="body2">{att.fileName}</Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {(att.size / 1024).toFixed(1)} КБ
                                                                </Typography>
                                                            </Box>
                                                        </Paper>
                                                    </a>
                                                ),
                                            )}
                                        </Stack>
                                    )}
                                    {msg.deletedAt ? (
                                        <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.6 }}>
                                            Сообщение удалено
                                        </Typography>
                                    ) : (
                                        <>
                                        {msg.replyTo && (
                                                <Box
                                                    onClick={() => scrollToMessage(msg.replyTo!.id)}
                                                    sx={{ borderLeft: 3, borderColor: msg.authorId === currentUserId ? 'primary.contrastText' : 'primary.main',
                                                        pl: 1, mb: 1, cursor: 'pointer', opacity: 0.8,}}
                                                >
                                                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                                                        {simpleMembers.find((m) => m.userId === msg.replyTo!.authorId)?.name || 'Пользователь'}
                                                    </Typography>
                                                    <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                                                        {msg.replyTo.deletedAt ? 'Сообщение удалено' : msg.replyTo.bodyMd}
                                                    </Typography>
                                                </Box>
                                            )}
                                            <Typography variant="body2" component="div">
                                                {renderMessageBody(msg.bodyMd, msg.refs || [], mentionedMembers)}
                                            </Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Typography>
                                            {msg.editedAt && (
                                                <Typography variant="caption" sx={{ opacity: 0.6, fontStyle: 'italic' }}>
                                                    (изменено)
                                                </Typography>
                                            )}
                                        </>
                                    )}
                                </Paper>
                                {index === boundaryIndex && boundaryIndex > 0 && (
                                    <Divider sx={{ my: 1, '&::before, &::after': { borderColor: 'primary.main' } }}>
                                        <Typography variant="caption" color="primary">Новые сообщения</Typography>
                                    </Divider>
                                )}
                            </Box>
                        ))}
                        {hasMore && (
                            <Button onClick={handleLoadMore} disabled={loadingMore} size="small" sx={{ alignSelf: 'center' }}>
                                {loadingMore ? <CircularProgress size={16} /> : 'Показать раньше'}
                            </Button>
                        )}
                    </Stack>
                )}
                <Menu
                    open={Boolean(contextMenu)}
                    onClose={handleCloseContextMenu}
                    anchorReference="anchorPosition"
                    anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
                >
                    <MenuItem onClick={handleStartReply}>
                        <ListItemIcon><ReplyIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Ответить</ListItemText>
                    </MenuItem>
                    {contextMenu && messages?.find((m)=>m.id===contextMenu.messageId)?.authorId===currentUserId &&(
                            <>
                            <MenuItem onClick={handleStartEdit}>
                                <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Изменить</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={handleContextDelete}>
                                <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Удалить</ListItemText>
                            </MenuItem>
                            </>
                    )}
                </Menu>
            </Box>
            <MessageInput
                channelId={channelId}
                onSend={handleSend}
                members={mentionedMembers}
                editingMessage={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
                onEditSubmit={handleEditSubmit}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
            />
        </Box>
    );
}