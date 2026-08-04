import { useState } from "react";
import type { KeyboardEvent } from "react";
import {Box, TextField, IconButton} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

export function MessageInput({onSend}:{onSend:(text: string)=> Promise<boolean>}){
    const [text, setText]=useState('');
    const [sending, setSending]=useState(false);

    async function handleSend(){
        const trimmed = text.trim();
        if (!trimmed && sending) return;
        setSending(true);
        const success=await onSend(trimmed);
        setSending(false);
        if (success) setText(' ');
    }
    function handleKeyDown(e: KeyboardEvent){
        if (e.key==='Enter' && !e.shiftKey){
            e.preventDefault();
            handleSend();
        }
    }
    return (
        <Box sx={{ display: 'flex', gap: 1, p: 2, borderTop: 1, borderColor: 'divider' }}>
            <TextField fullWidth multiline maxRows={4} size="small"
                       placeholder="Написать сообщение..." 
                       value={text}
                       onChange={(e) => setText(e.target.value)}
                       onKeyDown={handleKeyDown}
                       disabled={sending}
            />
            <IconButton color="primary" onClick={handleSend} disabled={sending || !text.trim()}>
                <SendIcon />
            </IconButton>
        </Box>
    );
}