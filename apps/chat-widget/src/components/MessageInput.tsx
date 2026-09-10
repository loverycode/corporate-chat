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
    const [text, setText] = useState(editingMessage?.bodyMd ?? '');     const [sending, setSending] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<Attachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionAnchor, setMentionAnchor] = useState<HTMLElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingThrottleRef = useRef<number>(0);
    const [uploadProgress, setUploadProgress]=useState<number | null>(null);
    const uploadControllerRef = useRef<AbortController | null>(null);
    const dragCounterRef = useRef(0);
    const {t}=useTranslation();

    
    useEffect(() => {
        if (editingMessage) {
            inputRef.current?.focus();
        }
    }, [editingMessage]);

   function handlePaste(e: React.ClipboardEvent) {
            const clipboardData = e.clipboardData;
            if (!clipboardData) return;
            const files: File[] = [];
            const items = clipboardData.items;
            if (items && items.length > 0) {
                for (const item of items) {
                    if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
                        const file = item.getAsFile();
                        if (file) {
                            files.push(file);
                        }
                    }
                }
            }
            if (files.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
                for (const file of Array.from(clipboardData.files)) {
                    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                        files.push(file);
                    }
                }
            }
            if (files.length > 0) {
                e.preventDefault();
                processFiles(files);
            }
        }
  
    async function processFiles(files: File[]) {
        const validFiles = files.filter(file => {
            if (file.size > 50 * 1024 * 1024) { 
                console.warn('Файл слишком большой:', file.name);
                return false;
            }
            return true;
        }).slice(0, 10); 

        if (validFiles.length === 0) return;
        setUploading(true);
        setUploadProgress(0);
        const controller = new AbortController();
        uploadControllerRef.current = controller;
        try {
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i];
                const attachment = await api.uploadFile(channelId, file, (percent) => {
                    const totalProgress = ((i + (percent / 100)) / validFiles.length) * 100;
                    setUploadProgress(Math.round(totalProgress));
                },controller.signal);
                setUploadedFiles(prev => [...prev, attachment]);
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
            } 
            else {
                console.error('Не удалось загрузить файлы', err);
            }
        } finally {
            setUploading(false);
            setUploadProgress(null);
            uploadControllerRef.current = null;
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }
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
        const atMatch = textBeforeCursor.match(/@([\p{L}\p{N}_]*)$/u);

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
        const files = e.target.files;
        if (!files || files.length===0) return;
        await processFiles(Array.from(files));
    }
    function handleDragEnter(e: React.DragEvent) {
        e.preventDefault();
        if (!e.dataTransfer.types.includes('Files')) return;
        dragCounterRef.current += 1;
        setIsDragging(true);
    }
    function handleDragOver(e: React.DragEvent) {
        e.preventDefault();
    }
    function handleDragLeave(e: React.DragEvent) {
        e.preventDefault();
        if (!e.dataTransfer.types.includes('Files')) return;
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) {
            setIsDragging(false);
        }
    }
    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFiles(Array.from(files));
        }
    }
    function cancelUpload() {
        uploadControllerRef.current?.abort();
    }
    function removeFile(id: string) {
        setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    }

    async function handleSend() {
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
        <Box
            onPaste={handlePaste}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            sx={{ borderTop: 1, borderColor: 'divider', p: { xs: 1, sm: 2 }, position: 'relative', flexShrink: 0 }}
        > 
        {isDragging && (
                <Box sx={{position: 'absolute', inset: 0, display: "flex", alignItems:'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.1)', borderRadius: 2, zIndex: 10, pointerEvents: 'none'}}>
                    <Typography variant="h6" color="primary">
                        {t('dropFiles') || 'Перетащите файлы для загрузки'}
                    </Typography>
                </Box>
            )}
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
                <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, alignItems: 'flex-end' }}>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} multiple  accept="image/*,application/pdf,text/*,video/*,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"  />                    {uploading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                <CircularProgress size={24} variant="determinate" value={uploadProgress ?? 0} />
                                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>{uploadProgress}%</Typography>
                                </Box>
                            </Box>
                            <IconButton size="small" onClick={cancelUpload}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ) : (
                        <IconButton onClick={() => fileInputRef.current?.click()}>
                            <AttachFileIcon />
                        </IconButton>
                    )}
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
                        sx={{'& .MuiInputBase-root': {fontSize: { xs: '0.875rem', sm: '1rem' }}}}
                    />
                    <IconButton color="primary" onClick={handleSend} disabled={sending || (!text.trim() && uploadedFiles.length === 0)}>
                        <SendIcon />
                    </IconButton>
                </Box>
            </Box>

    );
}