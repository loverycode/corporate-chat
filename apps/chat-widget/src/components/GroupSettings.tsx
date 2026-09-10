import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
    List, ListItemButton, ListItemText, Checkbox, IconButton, Typography, Divider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { api } from '../api/client';
import type { ChannelMember, Channel } from '../api/types';
import { useTranslation } from '../i18n/localeContext';
import { getSocket } from '../api/socket';
export function GroupSettings({ open, channel, currentUserId, onClose, onUpdated, onLeave}: {
    open: boolean;
    channel: Channel | null;
    currentUserId: string;
    onClose: () => void;
    onUpdated: () => void;
    onLeave?:()=>void;
}) {
    const { t } = useTranslation();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [portalUsers, setPortalUsers] = useState<{ id: string; name: string }[]>([]);
    const [members, setMembers]=useState<ChannelMember[]>([]);
    const [selectedNewUserIds, setSelectedNewUserIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const isOwner = members.find((m) => m.userId === currentUserId)?.role === 'owner';
    const existingMemberIds = new Set(members.map((m) => m.userId) ?? []);

    useEffect(() => {
        if (!channel) return;
        setTitle(channel.title || '');
        setDescription(channel.description || '');
        setSelectedNewUserIds([]);
        setMembers(channel.members || []);
        api.getPortalUsers().then((users) => setPortalUsers(users)).catch(() => {});
    }, [channel]);

    useEffect(() => {
        if (!channel) return;
        const socket = getSocket();
        if (!socket) return;

        function handleMemberRemoved(data: { channelId: string; userId: string; members: ChannelMember[] }) {
            if (data.channelId !== channel?.id) return;
            setMembers(data.members);
            
            if (data.userId === currentUserId) {
                onLeave?.();
                setTimeout(() => onClose(), 300);
            }
        }
        socket.on('member.removed', handleMemberRemoved)
        return () => {
            socket.off('member.removed', handleMemberRemoved);
        };
    }, [channel, currentUserId]);

    async function loadUsers(){
        if (!channel) return;
        try{
            const data = await api.getMembers(channel.id);
            setMembers(data);
        }catch(err){
            console.error(err);
        }
    }

    if (!channel) return null;

    async function handleSaveInfo() {
        if (!channel) return;
        setSaving(true);
        try {
            await api.updateChannel(channel.id, { title: title.trim(), description: description.trim() });
            onUpdated();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    }

    function toggleNewUser(userId: string) {
        setSelectedNewUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
        );
    }

    async function handleAddMembers() {
        if (!channel || selectedNewUserIds.length === 0) return;
        setSaving(true);
        try {
            await api.addChannelMembers(channel.id, selectedNewUserIds);
            setSelectedNewUserIds([]);
            await loadUsers();
            onUpdated();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    }

    async function handleRemoveMember(userId: string) {
        if (!channel) return;
        try {
            await api.removeChannelMember(channel.id, userId);
            if (userId===currentUserId){
                onUpdated();
                onLeave?.();
                setTimeout(() => onClose(), 300); 
            }
            else{
                await loadUsers();
                onUpdated();
            }
        } catch (err) {
            console.error(err);
        }
    }

    const availableToAdd = portalUsers.filter((u) => !existingMemberIds.has(u.id));

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{t('groupSettings')}</DialogTitle>
            <DialogContent>
                <TextField fullWidth label={t('groupName')} value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isOwner} sx={{ mb: 2, mt: 1 }}/>
                <TextField fullWidth multiline minRows={2} label={t('groupDescription')} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isOwner} sx={{ mb: 2 }}/>
                {isOwner && (
                    <Button variant="outlined" size="small" onClick={handleSaveInfo} disabled={saving} sx={{ mb: 2 }}>
                        {t('saveChanges')}
                    </Button>
                )}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    ({members.length}){t('participants')} 
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {members.map((m) => (
                        <ListItemButton key={m.userId} sx={{ opacity: 1 }}>
                            <ListItemText primary={m.user?.name || m.userId} secondary={m.role === 'owner' ? t('owner') : undefined}/>
                            {isOwner && m.userId !== currentUserId && (
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRemoveMember(m.userId); }}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            )}
                            {m.userId === currentUserId && (
                                <Button size="small" color="error" onClick={() => handleRemoveMember(currentUserId)}>
                                    {t('leaveGroup')}
                                </Button>
                            )}
                        </ListItemButton>
                    ))}
                </List>

                {isOwner && availableToAdd.length > 0 && (
                    <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('addParticipants')}</Typography>
                        <List dense sx={{ maxHeight: 150, overflow: 'auto' }}>
                            {availableToAdd.map((u) => (
                                <ListItemButton key={u.id} onClick={() => toggleNewUser(u.id)}>
                                    <Checkbox checked={selectedNewUserIds.includes(u.id)} size="small" />
                                    <ListItemText primary={u.name} />
                                </ListItemButton>
                            ))}
                        </List>
                        <Button variant="outlined" size="small" onClick={handleAddMembers} disabled={selectedNewUserIds.length === 0 || saving} sx={{ mt: 1 }}>
                            {t('add')}
                        </Button>
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('close')}</Button>
            </DialogActions>
        </Dialog>

    );
}