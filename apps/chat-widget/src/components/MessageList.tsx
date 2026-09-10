import { useEffect, useState, useRef } from 'react';
import { Box, Typography, CircularProgress, Button, Stack, Paper, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Popover, Chip, IconButton, Dialog, DialogContent } from '@mui/material';
import type { Channel, ChannelMember, Message, Reaction, Attachment } from '../api/types';
import { api } from '../api/client';
import { getSocket } from '../api/socket';
import { MessageInput } from './MessageInput';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { renderMessageBody } from '../utils/renderMessageBody';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReplyIcon from '@mui/icons-material/Reply';
import {REACTION_EMOJIS} from '../utils/reactionEmojis';
import { useTranslation } from "../i18n/localeContext";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EmojiPicker from 'emoji-picker-react';       
import type { TranslationKey } from '../i18n/translations';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { GroupSettings } from './GroupSettings';
import DownloadIcon from '@mui/icons-material/Download';

function getTypingLabel(userIds: Set<string>, members: { userId: string; name: string }[],  t: (key: TranslationKey) => string): string {
    const names = Array.from(userIds).map((id) => members.find((m) => m.userId === id)?.name ||  t('someone'));
    if (names.length === 1) return`${names[0]} ${t('typing')}`;
    return `${names.join(', ')} ${t('typingPlural')}`;
}

function AttachmentThumbnail({ att, onOpen }: { att: Attachment; onOpen: () => void }) {
    const [src, setSrc] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;
        setSrc(null);
        setFailed(false);
        const loadBlob = att.thumbKey
            ? api.getAttachmentThumbnailBlob(att.id)
            : api.getAttachmentBlob(att.id);
        loadBlob
            .then((blob) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setSrc(objectUrl);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [att.id, att.thumbKey]);

    if (failed) {
        return (
            <Paper variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <InsertDriveFileIcon fontSize="small" />
                <Typography variant="body2" noWrap>{att.fileName}</Typography>
            </Paper>
        );
    }
    if (!src) {
        return (
            <Box sx={{ width: 160, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
                <CircularProgress size={20} />
            </Box>
        );
    }
    return (
        <Box
            component="img"
            src={src}
            alt={att.fileName}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onOpen(); }}
            sx={{ maxWidth: '100%', width: 'auto', maxHeight: 200, borderRadius: 1, display: 'block', cursor: 'pointer' }}
        />
    );
}

export function MessageList({ channelId, currentUserId, targetMessageId, onTargetHandled, onBack, onlineUserIds }: { 
    channelId: string; 
    currentUserId: string; 
    targetMessageId?: string | null; 
    onTargetHandled?:()=>void; 
    onBack?: ()=>void;
    onlineUserIds: Set<string>;
}) {
    const { t } = useTranslation();
    
    const [messages, setMessages] = useState<Message[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [members, setMembers] = useState<ChannelMember[]>([]);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const lastReadIdRef = useRef<string | null>(null);
    const [channelTitle, setChannelTitle] = useState<string | null>(null);
    const [memberCount, setMemberCount] = useState<number>(0);
    const [channelType, setChannelType] = useState<string>('');
    const loadingRef = useRef<{ channelId: string; timestamp: number }>({ channelId: '', timestamp: 0 });
    const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
    const simpleMembers = members.map((m) => ({ userId: m.userId, name: m.user?.name || m.userId }));
    const mentionedMembers = simpleMembers.filter((m) => m.userId !== currentUserId);
    const [editingMessage, setEditingMessage] = useState<{ id: string; bodyMd: string } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; messageId: string } | null>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [replyingTo, setReplyingTo] = useState<{id: string; bodyMd: string; authorName: string} | null>(null);
    const [reactionPickerAnchor, setReactionPickerAnchor] = useState<{ el: HTMLElement; messageId: string } | null>(null);
    const [fullPickerOpen, setFullPickerOpen] = useState(false);
    const [channel, setChannel] = useState<Channel | null>(null);
    const getChannelTitle = (channel: Channel, userId: string): string => {
        if (channel.type === 'direct') {
            const otherMember = channel.members?.find(
                (m: ChannelMember) => m.userId !== userId,
            );
            return otherMember?.user?.name || 'Чат';
        }
        return channel.title || 'Чат';
    };

    useEffect(() => {
        let cancelled = false;
        const currentChannelId = channelId;
        loadingRef.current = { channelId: currentChannelId, timestamp: Date.now() };
        const loadAllData = async () => {
            const channel = await api.getChannel(currentChannelId);
            if (cancelled || loadingRef.current.channelId !== currentChannelId) return;
            setChannel(channel);
            setChannelType(channel.type);
            setMemberCount(channel.members?.length || 0);
            setChannelTitle(getChannelTitle(channel, currentUserId));
            setMembers(channel.members || []);
            const own = channel.members?.find((m: ChannelMember) => m.userId === currentUserId);
            lastReadIdRef.current = own?.lastReadMessageId ?? null;

            const messagesData = await api.getMessages(currentChannelId);
            if (cancelled || loadingRef.current.channelId !== currentChannelId) return;
            setMessages(messagesData);
            setHasMore(messagesData.length >= 30);
        };

        loadAllData();

        return () => {
            cancelled = true;
        };
    }, [channelId, currentUserId]);

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

        function handleReactionChanged(data: { messageId: string; reactions: Reaction[] }) {
            setMessages((prev) =>
                prev?.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m)) ?? prev,
            );
        }

        function handleChannelUpdated(channel: Channel) {
            if (channel.id !== channelId) return;
            setChannel(channel);
            setChannelType(channel.type);
            setMemberCount(channel.members?.length || 0);
            setChannelTitle(getChannelTitle(channel, currentUserId));
            if (channel.members) {
                setMembers(channel.members);
            }
        }

        socket.on('message.created', handleNewMessage);
        socket.on('message.updated', handleUpdated);
        socket.on('message.deleted', handleDeleted);
        socket.on('reaction.changed', handleReactionChanged);
        socket.on('channel.updated', handleChannelUpdated);
        return () => {
            socket.off('message.created', handleNewMessage);
            socket.off('message.updated', handleUpdated);
            socket.off('message.deleted', handleDeleted);
            socket.off('reaction.changed', handleReactionChanged);
            socket.off('channel.updated', handleChannelUpdated);
        };
    }, [channelId, currentUserId]);

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

    const latestMessageId = messages?.[0]?.id;
    useEffect(() => {
        if (!latestMessageId) return;
        api.markRead(channelId, latestMessageId).catch(() => {});
    }, [channelId, latestMessageId]);

    useEffect(() => {
        if (!targetMessageId || !messages) return;

        async function loadUntilFound() {
            if (messages!.some((m) => m.id === targetMessageId)) {
                scrollToMessage(targetMessageId!);
                onTargetHandled?.();
                return;
            }
            try {
                const { newerCount } = await api.getMessagePosition(channelId, targetMessageId!);
                const neededBatches = Math.ceil((newerCount + 1) / 30);
                let currentMessages = messages!;
                for (let i = 0; i < neededBatches; i++) {
                    if (currentMessages.some((m) => m.id === targetMessageId)) break;
                    const oldest = currentMessages[currentMessages.length - 1];
                    const older = await api.getMessages(channelId, oldest.id);
                    if (older.length === 0) break; 
                    currentMessages = [...currentMessages, ...older];
                }

                setMessages(currentMessages);
                if (currentMessages.length < 30 * (neededBatches + 1)) setHasMore(true); 
                setTimeout(() => scrollToMessage(targetMessageId!), 100); 
            } catch (err) {
                console.error('Не удалось найти сообщение', err);
            } finally {
                onTargetHandled?.();
            }
        }
        loadUntilFound();
    }, [targetMessageId]);

     useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        function handleReconnect(){
            api.getMessages(channelId).then((data)=>{
                setMessages((prev)=>{
                    if(!prev) return data;
                    const existindIds = new Set(data.map((m)=>m.id));
                    const olderNotInFresh = prev.filter((m)=>!existindIds.has(m.id) && data.every((d)=>new Date(d.createdAt)>new Date(m.createdAt)));
                    return [...data, ...olderNotInFresh];
                });
            }).catch(()=>{});
        }
        socket.on('connect', handleReconnect);
            return () => { socket.off('connect', handleReconnect); };
        }, [channelId]);

    async function handleLoadMore() {
        if (!messages || messages.length === 0) return;
        setLoadingMore(true);
        try {
            const oldest = messages[messages.length - 1];
            const older = await api.getMessages(channelId, oldest.id);
            setMessages([...messages, ...older]);
            if (older.length < 30) setHasMore(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('loadError'));
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
            setError(err instanceof Error ? err.message :  t('sendError'));
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
       const authorName = simpleMembers.find((m)=>m.userId===message.authorId)?.name || t('user');
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

    async function handleToggleReaction(messageId: string, emoji: string){
        const message = messages?.find((m)=>m.id===messageId);
        const alreadyReacted = message?.reactions.some((r)=>r.userId===currentUserId && r.emoji===emoji);
        try{
            if (alreadyReacted){
                await api.removeReaction(messageId, emoji);
            }
            else{
                 await api.addReaction(messageId, emoji);

            }
        }catch(err){
            console.error(err);
        }
    }
    function pickReaction(emoji: string) {
        if (!reactionPickerAnchor) return;
        handleToggleReaction(reactionPickerAnchor.messageId, emoji);
        setReactionPickerAnchor(null);
    }
    function handleMessageClick(event: React.MouseEvent<HTMLElement>, msg: Message) {
        if (msg.deletedAt) return;
        setReactionPickerAnchor({ el: event.currentTarget, messageId: msg.id});
    }
    function isOnline(): boolean{
        if (channelType !== 'direct') return false;
        const otherMember = members.find((m) => m.userId !== currentUserId);
        return otherMember ?  onlineUserIds.has(otherMember.userId) : false;
    }
    function openGroupSettings() {
        if (channel?.type==='group'){
            setGroupSettingsOpen(true);
        }
    }
    async function openAttachment(att: Attachment) {
        try {
            const blob = await api.getAttachmentBlob(att.id);
            const objectUrl = URL.createObjectURL(blob);
            window.open(objectUrl, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        } catch (err) {
            console.error('Не удалось открыть вложение', err);
        }
    }

    async function handleDownloadAttachment(att: Attachment) {
        try {
            const blob = await api.getAttachmentBlob(att.id);
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = att.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
        } catch (err) {
            console.error('Не удалось скачать вложение', err);
        }
    }
    const boundaryIndex = messages && lastReadIdRef.current
        ? messages.findIndex((m) => m.id === lastReadIdRef.current)
        : -1;



    return (
    <Box sx={{ flex: 1, display: 'flex', minWidth:0, flexDirection: 'column', height: '100vh', overflow:'hidden' }}>
        <Box sx={{display: 'flex', alignItems: 'center', justifyContent:'space-between', pr: 1.5, pl:1.5, borderBottom: 1, borderColor:'divider', minHeight: 56, width: '100%', flexShrink:0}}>
            <Box sx={{ p: { xs: 1, sm: 1.5 }, display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
                {onBack && (
                    <IconButton onClick={onBack} sx={{ minWidth: 44, minHeight: 44, display: { xs: 'flex', sm: 'none' } }}>
                        <ArrowBackIcon />
                    </IconButton>
                )}
                <Box sx={{minWidth:0 }}>
                        <Typography variant="subtitle1" noWrap sx={{fontSize:{xs:'0.9rem', sm:'1rem'}, fontWeight: 500, lineHeight: 1,}}>
                            {channelTitle || 'Чат'}
                        </Typography>
                        {channelType==='direct' && !typingUsers.size && (
                            <Typography variant="caption" color="text.secondary">
                                {isOnline() ? t('online') : t('offline')}
                            </Typography>
                        )}
                        {channelType === 'group' && typingUsers.size===0 && (
                            <Typography variant="caption" color="text.secondary">
                                {memberCount} {t('participants')}
                            </Typography>
                        )}
                        {typingUsers.size > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                {getTypingLabel(typingUsers, simpleMembers, t)}
                            </Typography>
                        )}
                </Box>
            </Box>
            {channelType === 'group' && (
                <IconButton size="small" onClick={openGroupSettings}>
                    <MoreVertIcon fontSize="small" />
                </IconButton>
            )}
            </Box>
            <Box sx={{ flex: 1, minWidth:0, overflow: 'auto', p:{xs:1, sm:2 },}}>
                {error && <Typography color="error">{error}</Typography>}
                {!messages && !error && <CircularProgress size={24} />}
                {messages && (
                    <Stack spacing={1} sx={{ flexDirection: 'column-reverse' }}>
                        {messages.map((msg, index) => (
                            <Box key={msg.id} sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Paper
                                    variant="outlined"
                                    onClick={(event) => handleMessageClick(event, msg)}
                                    onContextMenu={(event) => handleContextMenu(event, msg)}
                                    onTouchStart={(event) => handleTouchStart(event, msg)}
                                    onTouchEnd={clearLongPress}
                                    onTouchMove={clearLongPress}
                                    onTouchCancel={clearLongPress}
                                    id={`msg-${msg.id}`}
                                    sx={{
                                        p: { xs: 1, sm: 1.5 },
                                        maxWidth: { xs: '85%', sm: '80%', md: '65%'},
                                        alignSelf: msg.authorId === currentUserId ? 'flex-end' : 'flex-start',
                                        bgcolor: msg.authorId === currentUserId ? 'primary.main' : 'background.paper',
                                        color: msg.authorId === currentUserId ? 'primary.contrastText' : 'text.primary',
                                        cursor: msg.authorId === currentUserId && !msg.deletedAt ? 'context-menu' : 'default',
                                        userSelect: 'none',
                                    }}
                                >
                                    {msg.files && msg.files.length > 0 && (
                                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                                            {msg.files.map((att) => (
                                                att.mime.startsWith('image/') ? (
                                                    <Box key={att.id} sx={{ position: 'relative', display: 'inline-block' }}>
                                                        <AttachmentThumbnail att={att} onOpen={() => openAttachment(att)} />
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => { e.stopPropagation(); handleDownloadAttachment(att); }}
                                                            sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
                                                        >
                                                            <DownloadIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                ) : (
                                                    <Paper
                                                        key={att.id}
                                                        variant="outlined"
                                                        onClick={(e) => { e.stopPropagation(); openAttachment(att); }}
                                                        sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                                                    >
                                                        <InsertDriveFileIcon fontSize="small" />
                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                            <Typography variant="body2" noWrap>{att.fileName}</Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {(att.size / 1024).toFixed(1)} КБ
                                                            </Typography>
                                                        </Box>
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => { e.stopPropagation(); handleDownloadAttachment(att); }}
                                                        >
                                                            <DownloadIcon fontSize="small" />
                                                        </IconButton>
                                                    </Paper>
                                                )
                                            ))}
                                        </Stack>
                                    )}
                                    {msg.deletedAt ? (
                                        <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.6 }}>
                                             {t('messageDeleted')}
                                        </Typography>
                                    ) : (
                                        <>
                                        {msg.replyTo && (
                                                <Box
                                                    onClick={() => scrollToMessage(msg.replyTo!.id)}
                                                    sx={{ borderLeft: 3, borderColor: msg.authorId === currentUserId ? 'primary.contrastText' : 'primary.main',
                                                        pl: 1, mb: 1, cursor: 'pointer', opacity: 0.8,}}
                                                >
                                                    <Typography sx={{fontSize: { xs: '0.75rem', sm: '0.875rem' },  fontWeight: { xs: 400, sm: 500 }}}>
                                                        {simpleMembers.find((m) => m.userId === msg.replyTo!.authorId)?.name || t('user')}
                                                    </Typography>
                                                    <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                                                        {msg.replyTo.deletedAt ? t('messageDeleted') : msg.replyTo.bodyMd}
                                                    </Typography>
                                                </Box>
                                            )}
                                            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
                                                {members.find((m) => m.userId === msg.authorId && m.userId!==currentUserId)?.user?.name || ''}                                            
                                            </Typography>
                                            <Typography variant="body2" component="div">
                                                {renderMessageBody(msg.bodyMd, msg.refs || [], mentionedMembers, t as any)}
                                            </Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display:'flex', justifyContent:'flex-end' }}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Typography>
                                            {!msg.deletedAt && (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1, alignItems: 'center' }}>
                                                    {Object.entries(
                                                        msg.reactions.reduce<Record<string, string[]>>((acc, r) => {
                                                            (acc[r.emoji] ||= []).push(r.userId);
                                                            return acc;
                                                        }, {}),
                                                    ).map(([emoji, userIds]) => {
                                                        const isOwn = msg.authorId === currentUserId;
                                                        const isMyReaction = userIds.includes(currentUserId);
                                                        return(
                                                        <Chip
                                                            key={emoji}
                                                            size="small"
                                                            label={`${emoji} ${userIds.length}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleReaction(msg.id, emoji);
                                                            }}
                                                            sx={{ 
                                                                bgcolor: isMyReaction ? (isOwn ? 'primary.contrastText' : 'primary.main') : (isOwn ? 'rgba(255,255,255,0.15)' : 'action.hover'),
                                                                color: isMyReaction ? (isOwn ? 'primary.main' : 'primary.contrastText') : 'inherit',
                                                                border: isOwn ? '1px solid rgba(255,255,255,0.4)' : undefined,
                                                                cursor: 'pointer' 
                                                            }}
                                                        />
                                                    )})}
                                                </Box>
                                            )}
                                            {msg.editedAt && (
                                                <Typography variant="caption" sx={{ opacity: 0.6, fontStyle: 'italic', justifyContent:'right' }}>
                                                    {t('edited')}
                                                </Typography>
                                            )}
                                        </>
                                    )}
                                </Paper>
                                {index === boundaryIndex && boundaryIndex > 0 && (
                                    <Divider sx={{ my: 1, '&::before, &::after': { borderColor: 'primary.main' } }}>
                                        <Typography variant="caption" color="primary">{t('newMessages')}</Typography>
                                    </Divider>
                                )}
                            </Box>
                        ))}
                        {hasMore && (
                            <Button onClick={handleLoadMore} disabled={loadingMore} size="medium"  sx={{ py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' }, alignSelf: 'center' }}>
                                {loadingMore ? <CircularProgress size={16} /> : t('showEarlier')}
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
                        <ListItemText>{t('reply')}</ListItemText>
                    </MenuItem>
                    {contextMenu && messages?.find((m)=>m.id===contextMenu.messageId)?.authorId===currentUserId &&(
                            <>
                            <MenuItem onClick={handleStartEdit}>
                                <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>{t('edit')}</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={handleContextDelete}>
                                <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>{t('delete')}</ListItemText>
                            </MenuItem>
                            </>
                    )}
                </Menu>
                <Popover
                    open={Boolean(reactionPickerAnchor)}
                    anchorEl={reactionPickerAnchor?.el}
                    onClose={() => setReactionPickerAnchor(null)}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center'}}
                    transformOrigin={{ vertical: 'bottom', horizontal: 'center'}}
                >
                    <Box sx={{ p: 1, display: 'flex', gap: 0.5 }}>
                        {REACTION_EMOJIS.map((emoji) => (
                            <IconButton key={emoji} size="small" onClick={() => pickReaction(emoji)}>
                                <span style={{ fontSize: 20 }}>{emoji}</span>
                            </IconButton>
                        ))}
                        <IconButton size="small" onClick={() => setFullPickerOpen(true)}>
                            <ExpandMoreIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Popover>
                <Dialog
                    open={fullPickerOpen}
                    onClose={() => setFullPickerOpen(false)}
                    maxWidth="xs"
                    fullWidth
                >
                    <DialogContent sx={{ p: 0 }}>
                        <EmojiPicker
                            onEmojiClick={(emojiData) => {
                                const emoji = emojiData.emoji;
                                if (reactionPickerAnchor) {
                                    handleToggleReaction(reactionPickerAnchor.messageId, emoji);
                                }
                                setFullPickerOpen(false);
                                setReactionPickerAnchor(null);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            </Box>
            <MessageInput
                key={editingMessage?.id ?? 'new-message'}
                channelId={channelId}
                onSend={handleSend}
                members={mentionedMembers}
                editingMessage={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
                onEditSubmit={handleEditSubmit}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
            />
            <GroupSettings
                open={groupSettingsOpen}
                channel={channel}
                currentUserId={currentUserId}
                onClose={() => {
                    setGroupSettingsOpen(false)
                }}
                onUpdated={() => {
                    
                }}
                onLeave={()=>{
                    
                    setGroupSettingsOpen(false);
                    onBack?.();
                }}
            />
        </Box>
    );
}