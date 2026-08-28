import { useEffect, useState } from 'react';
import {Box, List, ListItemButton, ListItemText, Typography, CircularProgress, Badge,
        IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
        Tabs, Tab, Checkbox} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '../api/client';
import type { Channel } from '../api/types';
import { SearchDialog } from './SearchDialog';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import { useTranslation } from '../i18n/localeContext';
import TranslateIcon from '@mui/icons-material/Translate';


export function ChannelList({currentUser,selectedChannelId,onSelectChannel,refreshTrigger, onlineUserIds, onSelectMessage, themeMode, onToggleTheme, locale, onToggleLocale}: {
    currentUser: { id: string; name: string }; selectedChannelId: string | null; onSelectChannel: (channelId: string) => void; refreshTrigger: number; onlineUserIds: Set<string>; onSelectMessage:(channelId: string, messageId: string)=>void;
    themeMode:'light' | 'dark'; onToggleTheme:()=>void; locale: 'ru'|'en'; onToggleLocale: () => void}) {
    const [channels, setChannels] = useState<Channel[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [tab, setTab] = useState<'direct' | 'group'>('direct');
    const [portalUsers, setPortalUsers] = useState<{ id: string; name: string }[]>([]);
    const [groupTitle, setGroupTitle] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [searchOpen, setSearchOpen] = useState(false);
    const {t}=useTranslation()
    function loadChannels() {
        api.getChannels().then(setChannels).catch((err) => setError(err.message));
    }

    useEffect(() => {
        loadChannels();
    }, [refreshTrigger]);

    function openDialog() {
        setDialogOpen(true);
        setTab('direct');
        setGroupTitle('');
        setSelectedUserIds([]);
        api.getPortalUsers().then((users) => setPortalUsers(users.filter((u) => u.id !== currentUser.id))).catch(() => {});
    }

    async function startDirectChat(userId: string) {
        const channel = await api.createChannel('direct', [currentUser.id, userId]);
        setDialogOpen(false);
        loadChannels();
        onSelectChannel(channel.id);
    }

    function toggleUser(userId: string) {
        setSelectedUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
        );
    }

    async function createGroup() {
        if (!groupTitle.trim() || selectedUserIds.length === 0) return;
        const channel = await api.createChannel('group', [currentUser.id, ...selectedUserIds], groupTitle.trim());
        setDialogOpen(false);
        loadChannels();
        onSelectChannel(channel.id);
    }

    return (
        <Box sx={{ width: 280, borderRight: 1, borderColor: 'divider', p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                    {currentUser.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => setSearchOpen(true)}>
                        <SearchIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={openDialog}>
                        <AddIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={onToggleTheme}>
                        <Brightness4Icon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={onToggleLocale}>
                        <TranslateIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>
            {error && <Typography color="error">{error}</Typography>}
            {!channels && !error && <CircularProgress size={24} />}
            {channels && (
                <List>
                    {channels.length === 0 && <Typography color="text.secondary">{t('noChannels')}</Typography>}
                    {channels.map((ch) => {
                        const otherMember = ch.type === 'direct' ? ch.members.find((m) => m.userId !== currentUser.id) : null;
                        const isOnline = otherMember && onlineUserIds.has(otherMember.userId);
                        return(
                        <ListItemButton key={ch.id} selected={ch.id === selectedChannelId} onClick={() => onSelectChannel(ch.id)}>
                            <ListItemText primary={ch.title || t('directDialog')} secondary={ch.type==='direct' ? (isOnline ? t('online') : t('offline')) : undefined}/>
                            {ch.unreadCount > 0 && <Badge badgeContent={ch.unreadCount} color="primary" />}
                        </ListItemButton>
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
                    {tab === 'direct' && (
                        <List>
                            {portalUsers.map((u) => (
                                <ListItemButton key={u.id} onClick={() => startDirectChat(u.id)}>
                                    <ListItemText primary={u.name} />
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                    {tab === 'group' && (
                        <Box>
                            <TextField
                                fullWidth
                                label={t('groupName')}
                                value={groupTitle}
                                onChange={(e) => setGroupTitle(e.target.value)}
                                sx={{ mb: 2, mt: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">{t('participants')}</Typography>
                            <List dense>
                                {portalUsers.map((u) => (
                                    <ListItemButton key={u.id} onClick={() => toggleUser(u.id)}>
                                        <Checkbox checked={selectedUserIds.includes(u.id)} size="small" />
                                        <ListItemText primary={u.name} />
                                    </ListItemButton>
                                ))}
                            </List>
                        </Box>
                    )}
                </DialogContent>
                {tab === 'group' && (
                    <DialogActions>
                        <Button onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
                        <Button
                            variant="contained"
                            onClick={createGroup}
                            disabled={!groupTitle.trim() || selectedUserIds.length === 0}
                        >
                            {t('create')}
                        </Button>
                    </DialogActions>
                )}
            </Dialog>
            <SearchDialog
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
                onSelectResult={(channelId, messageId) => {
                    onSelectMessage(channelId, messageId);
                    setSearchOpen(false);
                }}
            />
        </Box>
    );
}