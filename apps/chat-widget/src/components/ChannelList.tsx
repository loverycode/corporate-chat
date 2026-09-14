import { useEffect, useState, useRef } from 'react';
import { Box, List, ListItemButton, ListItemText, Typography, CircularProgress, Badge, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Tabs, Tab, Checkbox, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '../api/client';
import { getSocket } from '../api/socket';
import type { Channel, Message } from '../api/types';
import { SearchDialog } from './SearchDialog';
import { useTranslation } from '../i18n/localeContext';
import type { SxProps } from '@mui/material';

export function ChannelList({ currentUser, selectedChannelId, onSelectChannel, refreshTrigger, onlineUserIds, onSelectMessage, sx }: {
    currentUser: { id: string; name: string }; selectedChannelId: string | null; onSelectChannel: (channelId: string) => void; refreshTrigger: number; onlineUserIds: Set<string>; onSelectMessage: (channelId: string, messageId: string) => void;
    sx?: SxProps }) {
    const [channels, setChannels] = useState<Channel[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [tab, setTab] = useState<'direct' | 'group'>('direct');
    const [portalUsers, setPortalUsers] = useState<{ id: string; name: string }[]>([]);
    const [groupTitle, setGroupTitle] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [searchOpen, setSearchOpen] = useState(false);
    const [groupDescription, setGroupDescription] = useState('');
    const { t } = useTranslation();
    const loadSeqRef = useRef(0);

    function loadChannels() {
        const seq = ++loadSeqRef.current;
        api.getChannels().then((data) => {
            if (seq !== loadSeqRef.current) return; 
            setChannels(data);
        }).catch((err) => {
            if (seq !== loadSeqRef.current) return;
            setError(err.message);
        });
    }

    useEffect(() => { 
        loadChannels();
    }, [refreshTrigger]);

    useEffect(() => {
        let socket = getSocket();
        let cancelled = false;
        let pollId: ReturnType<typeof setInterval> | undefined;

        function handleMemberRemoved() { loadChannels(); }
        function handleChannelDeleted(payload: { channelId: string }) {
            setChannels((prev) => prev ? prev.filter((ch) => ch.id !== payload.channelId) : prev);
        }
        function handleNewMessage(msg: Message) {
            setChannels((prev) => {
                if (!prev) return prev;
                return prev.map((ch) => ch.id === msg.channelId ? { ...ch, lastMessage: msg } : ch)
                    .sort((a, b) => {
                        const aTime = new Date(a.lastMessage?.createdAt ?? 0).getTime();
                        const bTime = new Date(b.lastMessage?.createdAt ?? 0).getTime();
                        return bTime - aTime;
                    });
            });
        }
        function handleUnreadChanged() {
            loadChannels();
        }

        function attach(s: NonNullable<ReturnType<typeof getSocket>>) {
            s.on('member.removed', handleMemberRemoved);
            s.on('channel.deleted', handleChannelDeleted);
            s.on('message.created', handleNewMessage);
            s.on('unread.changed', handleUnreadChanged);
        }

        if (socket) {
            attach(socket);
        } else {
            pollId = setInterval(() => {
                socket = getSocket();
                if (socket) {
                    clearInterval(pollId);
                    if (!cancelled) attach(socket);
                }
            }, 200);
        }

        return () => {
            cancelled = true;
            if (pollId) clearInterval(pollId);
            if (socket) {
                socket.off('member.removed', handleMemberRemoved);
                socket.off('channel.deleted', handleChannelDeleted);
                socket.off('message.created', handleNewMessage);
                socket.off('unread.changed', handleUnreadChanged);
            }
        };
    }, []);

    function openDialog() {
        setDialogOpen(true);
        setTab('direct');
        setGroupTitle('');
        setSelectedUserIds([]);
        setGroupDescription('');
        api.getPortalUsers().then((users) => setPortalUsers(users.filter((u) => u.id !== currentUser.id))).catch(() => {});
    }

    async function startDirectChat(userId: string) {
        const channel = await api.createChannel('direct', [currentUser.id, userId]);
        setDialogOpen(false);
        loadChannels();
        onSelectChannel(channel.id);
    }

    function toggleUser(userId: string) {
        setSelectedUserIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
    }

    async function createGroup() {
        if (!groupTitle.trim() || selectedUserIds.length === 0) return;
        const channel = await api.createChannel('group', [currentUser.id, ...selectedUserIds], groupTitle.trim(), undefined, groupDescription.trim());
        setDialogOpen(false);
        loadChannels();
        onSelectChannel(channel.id);
    }

    return (
        <Box sx={{ width: { xs: '100%', sm: 280 }, maxWidth: 280, borderRight: 1, borderBottom: { xs: 1, sm: 0 }, borderColor: 'divider', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', height: { xs: '100vh', sm: '100vh' }, ...sx }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">{currentUser.name}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => setSearchOpen(true)}><SearchIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={openDialog}><AddIcon fontSize="small" /></IconButton>
                </Box>
            </Box>
            {error && <Typography color="error">{error}</Typography>}
            {!channels && !error && <CircularProgress size={24} />}
            {channels && (
                <List sx={{ p: 0 }}>
                    {channels.length === 0 && <Typography color="text.secondary">{t('noChannels')}</Typography>}
                    {channels.map((ch, index) => {
                        const otherMember = ch.type === 'direct' ? ch.members.find((m) => m.userId !== currentUser.id) : null;
                        const isOnline = otherMember && onlineUserIds.has(otherMember.userId);
                        const displayTitle = ch.type === 'direct' ? (otherMember?.user?.name || t('directDialog')) : (ch.title || t('group'));
                        const lastMessagePreview = ch.lastMessage ? ch.lastMessage.deletedAt ? t('messageDeleted') : (() => {
                            const prefix = ch.lastMessage?.authorId === currentUser.id ? `${t('you')}: ` : '';
                            const bodyText = ch.lastMessage.bodyMd?.trim() ?? '';
                            if (bodyText) {
                                const text = bodyText.length > 40 ? `${bodyText.slice(0, 40)}…` : bodyText;
                                return `${prefix}${text}`;
                            }
                            const files = ch.lastMessage.files ?? [];
                            if (files.length > 0) {
                                const hasImage = files.some((f) => f.mime?.startsWith('image/'));
                                const label = files.length > 1
                                    ? t('attachmentsCount').replace('{count}', String(files.length))
                                    : (hasImage ? t('attachmentImage') : t('attachmentFile'));
                                return `${prefix} ${label}`;
                            }
                            return prefix || null;
                        })() : null;
                        return (
                            <Box key={ch.id}>
                                <ListItemButton selected={ch.id === selectedChannelId} onClick={() => onSelectChannel(ch.id)} sx={{ alignItems: 'flex-start', gap: 1 }}>
                                    {ch.type === 'direct' && (
                                        <Box sx={{ position: 'relative', mt: 0.5 }}>
                                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: isOnline ? 'success.main' : 'action.disabled', border: '2px solid', borderColor: 'background.paper' }} />
                                        </Box>
                                    )}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{displayTitle}</Typography>
                                            {ch.unreadCount > 0 && <Badge badgeContent={ch.unreadCount} color="primary" />}
                                        </Box>
                                        {lastMessagePreview && (
                                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{lastMessagePreview}</Typography>
                                        )}
                                    </Box>
                                </ListItemButton>
                                {index < channels.length - 1 && <Divider />}
                            </Box>
                        );
                    })}
                </List>
            )}

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('newChat')}</DialogTitle>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
                    <Tab label={t('directDialog')} value="direct" />
                    <Tab label={t('group')} value="group" />
                </Tabs>
                <DialogContent>
                    {tab === 'direct' && <List>{portalUsers.map((u) => <ListItemButton key={u.id} onClick={() => startDirectChat(u.id)}><ListItemText primary={u.name} /></ListItemButton>)}</List>}
                    {tab === 'group' && (
                        <Box>
                            <TextField fullWidth label={t('groupName')} value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} sx={{ mb: 2, mt: 1 }} />
                            <TextField fullWidth label={t('groupDescription')} value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} sx={{ mb: 2, mt: 1 }} />
                            <Typography variant="caption" color="text.secondary">{t('participants')}</Typography>
                            <List dense>
                                {portalUsers.map((u) => <ListItemButton key={u.id} onClick={() => toggleUser(u.id)}><Checkbox checked={selectedUserIds.includes(u.id)} size="small" /><ListItemText primary={u.name} /></ListItemButton>)}
                            </List>
                        </Box>
                    )}
                </DialogContent>
                {tab === 'group' && (
                    <DialogActions>
                        <Button onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
                        <Button variant="contained" onClick={createGroup} disabled={!groupTitle.trim() || selectedUserIds.length === 0}>{t('create')}</Button>
                    </DialogActions>
                )}
            </Dialog>

            <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onSelectResult={(channelId, messageId) => { onSelectMessage(channelId, messageId); setSearchOpen(false); }} />
        </Box>
    );
}