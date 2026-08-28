import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";
import { Box, TextField, IconButton, Chip, Stack, CircularProgress, List, ListItemButton, ListItemText, Popper, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { api } from "../api/client";
import type { Attachment } from "../api/types";
import { getSocket } from "../api/socket";
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from "../i18n/localeContext";

export function MessageInput({channelId, onSend, members, editingMessage, onCancelEdit, onEditSubmit, replyingTo, onCancelReply}: {
    channelId: string; onSend: (text: string, attachmentIds: string[]) => Promise<boolean>;
    members: { userId: string; name: string }[]; editingMessage: { id: string; bodyMd: string } | null;
    onCancelEdit: () => void; onEditSubmit: (messageId: string, text: string) => Promise<void>;
    replyingTo:{id:string; bodyMd: string; authorName: string} | null; onCancelReply:()=>void;}){
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<Attachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionAnchor, setMentionAnchor] = useState<HTMLElement | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingThrottleRef = useRef<number>(0);
    const {t}=useTranslation();

    useEffect(() => {
        if (editingMessage) {
            setText(editingMessage.bodyMd);
            inputRef.current?.focus();
        }
    }, [editingMessage]);

    function handleTextChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const value = e.target.value;
        setText(value);

        const now = Date.now();
        if (now - typingThrottleRef.current > 2000) {
            typingThrottleRef.current = now;
            getSocket()?.emit('typing', { channelId });
        }

        const cursorPos = e.target.selectionStart ?? value.length;
        const textBeforeCursor = value.slice(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@(\w*)$/);

        if (atMatch) {
            setMentionQuery(atMatch[1]);
            setMentionAnchor(e.target);
        } else {
            setMentionQuery(null);
        }
    }

    function selectMention(userId: string) {
        const cursorPos = inputRef.current?.selectionStart ?? text.length;
        const textBeforeCursor = text.slice(0, cursorPos);
        const newTextBefore = textBeforeCursor.replace(/@(\w*)$/, `<@${userId}> `);
        const textAfterCursor = text.slice(cursorPos);
        setText(newTextBefore + textAfterCursor);
        setMentionQuery(null);
    }

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const attachment = await api.uploadFile(channelId, file);
            setUploadedFiles((prev) => [...prev, attachment]);
        } catch (err) {
            console.log('Не удалось загрузить файл', err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    function removeFile(id: string) {
        setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    }

    async function handleSend() {
        console.log('handleSend called', { text, uploadedFiles, sending, editingMessage, replyingTo });
        const trimmed = text.trim();
        if ((!trimmed && uploadedFiles.length === 0) || sending) return;
        setSending(true);
        if (editingMessage) {
            await onEditSubmit(editingMessage.id, trimmed);
            setSending(false);
            setText('');
            onCancelEdit();
            return;
        }
        const success = await onSend(trimmed, uploadedFiles.map((f) => f.id));
        setSending(false);
        if (success) {
            setText('');
            setUploadedFiles([]);
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <Box sx={{ borderTop: 1, borderColor: 'divider', p: 2, position: 'relative' }}>
            {editingMessage && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">{t('editingMessage')}</Typography>
                    <IconButton size="small" onClick={() => { setText(''); onCancelEdit(); }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>
            )}
            {replyingTo && !editingMessage && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box>
                        <Typography variant="caption" color="text.primary" sx={{ fontWeight: 600, display: 'block' }}>
                            {t('replyTo')} {replyingTo.authorName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 300 }}>
                            {replyingTo.bodyMd}
                        </Typography>
                    </Box>
                    <IconButton size="small" onClick={onCancelReply}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>
            )}
                {mentionQuery !== null && (
                    <Popper open anchorEl={mentionAnchor} placement="top-start">
                        <List sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
                            {members
                                .filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
                                .map((m) => (
                                    <ListItemButton key={m.userId} onClick={() => selectMention(m.userId)}>
                                        <ListItemText primary={m.name} />
                                    </ListItemButton>
                                ))}
                        </List>
                    </Popper>
                )}
                {uploadedFiles.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                        {uploadedFiles.map((f) => (
                            <Chip key={f.id} label={f.fileName} onDelete={() => removeFile(f.id)} size="small" />
                        ))}
                    </Stack>
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
                    <IconButton onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <CircularProgress size={20} /> : <AttachFileIcon />}
                    </IconButton>
                    <TextField
                        fullWidth
                        multiline
                        maxRows={4}
                        size="small"
                        placeholder={t('writeMessage')}
                        value={text}
                        onChange={handleTextChange}
                        onKeyDown={handleKeyDown}
                        disabled={sending}
                        inputRef={inputRef}
                    />
                    <IconButton color="primary" onClick={handleSend} disabled={sending || (!text.trim() && uploadedFiles.length === 0)}>
                        <SendIcon />
                    </IconButton>
                </Box>
            </Box>

    );
}