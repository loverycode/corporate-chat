import { useEffect, useState } from 'react';
import {Box, List, ListItemButton, ListItemText, Typography, CircularProgress, Badge,
        IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
        Tabs, Tab, Checkbox} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../api/client';
import type { Channel } from '../api/types';

export function ChannelList({currentUser,selectedChannelId,onSelectChannel,refreshTrigger,}: {
    currentUser: { id: string; name: string }; selectedChannelId: string | null; onSelectChannel: (channelId: string) => void; refreshTrigger: number;}) {
    const [channels, setChannels] = useState<Channel[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [tab, setTab] = useState<'direct' | 'group'>('direct');
    const [portalUsers, setPortalUsers] = useState<{ id: string; name: string }[]>([]);
    const [groupTitle, setGroupTitle] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

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
                <IconButton size="small" onClick={openDialog}>
                    <AddIcon fontSize="small" />
                </IconButton>
            </Box>
            {error && <Typography color="error">{error}</Typography>}
            {!channels && !error && <CircularProgress size={24} />}
            {channels && (
                <List>
                    {channels.length === 0 && <Typography color="text.secondary">Нет каналов</Typography>}
                    {channels.map((ch) => (
                        <ListItemButton key={ch.id} selected={ch.id === selectedChannelId} onClick={() => onSelectChannel(ch.id)}>
                            <ListItemText primary={ch.title || 'Личный диалог'} />
                            {ch.unreadCount > 0 && <Badge badgeContent={ch.unreadCount} color="primary" />}
                        </ListItemButton>
                    ))}
                </List>
            )}

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Новый чат</DialogTitle>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
                    <Tab label="Личный диалог" value="direct" />
                    <Tab label="Группа" value="group" />
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
                                label="Название группы"
                                value={groupTitle}
                                onChange={(e) => setGroupTitle(e.target.value)}
                                sx={{ mb: 2, mt: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">Участники</Typography>
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
                        <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
                        <Button
                            variant="contained"
                            onClick={createGroup}
                            disabled={!groupTitle.trim() || selectedUserIds.length === 0}
                        >
                            Создать
                        </Button>
                    </DialogActions>
                )}
            </Dialog>
        </Box>
    );
}