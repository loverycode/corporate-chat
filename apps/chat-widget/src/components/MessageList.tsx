import {useEffect, useState} from 'react';
import {Box, Typography, CircularProgress, Button, Stack, Paper} from '@mui/material';
import type { Message } from '../api/types';
import { api } from '../api/client';
import { getSocket } from '../api/socket';
import { MessageInput } from './messageInput';

export function MessageList({channelId, currentUserId,}: {channelId:string; currentUserId: string;}){
    const [messages, setMessages]=useState<Message[] | null>(null);
    const [error, setError]=useState<string | null>(null);
    const [loadingMore, setLoadingMore]=useState(false);
    const [hasMore, setHasMore]=useState(true);

    useEffect(()=>{
        setMessages(null);
        setError(null);
        setHasMore(true);
        api.getMessages(channelId).then((data)=>{
            setMessages(data);
            if (data.length<30) setHasMore(false);
        }).catch((err)=>setError(err.message));
    }, [channelId]);

    useEffect(()=>{
        const socket = getSocket();
        if (!socket) return;

        function handleNewMessage(msg: Message){
            if (msg.channelId !== channelId) return;
            setMessages((prev)=>{
                if (!prev) return prev;
                if (prev.some((m)=>m.id===msg.id)) return prev;
                return [msg, ...prev];
            });
        }
        socket.on('message.created', handleNewMessage);
        return ()=>{
            socket.off('message.created', handleNewMessage);
        };
    }, [channelId]);

    async function handleLoadMore(){
        if (!messages || messages.length===0) return;
        setLoadingMore(true);
        try{
            const oldest = messages[messages.length-1];
            const older = await api.getMessages(channelId, oldest.id)
            setMessages([...messages, ...older]);
            if (older.length<30) setHasMore(false);
        }catch(err){
            setError(err instanceof Error ? err.message:'Ошибка загрузки');
        }
        finally{
            setLoadingMore(false);
        }
    }
    async function handleSend(text: string): Promise<boolean> {
        const clientMessageId = crypto.randomUUID();
        try {
            const message = await api.sendMessage(channelId, text, clientMessageId);
            setMessages((prev) => {
                if (!prev) return prev;
                if (prev.some((m) => m.id === message.id)) return prev;
                return [message, ...prev];
            });
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
            return false;
        }
    }
    return (
        <Box sx={{flex:1, display: 'flex', flexDirection:'column', p:2, height:'100vh'}}>
            <Box sx={{flex:1, overflow: 'auto', p:2}}>
                {error && <Typography color="error">{error}</Typography>}
                {!messages && !error && <CircularProgress size={24} />}
                {messages && (
                    <Stack spacing={1} sx={{flexDirection: 'column-reverse'}}>
                        {messages.map((msg)=>(
                            <Paper key={msg.id}
                                variant='outlined'
                                sx={{ p:1.5, maxWidth: '70%',
                                    alignSelf: msg.authorId===currentUserId ? 'flex-end':'flex-start',
                                    bgcolor: msg.authorId===currentUserId ? 'primary.main':'background.paper',
                                    color: msg.authorId===currentUserId ? 'primary.contrastText':'text.primary',
                                }}
                            >
                                <Typography variant="body2">{msg.bodyMd}</Typography>
                                <Typography variant='caption' sx={{opacity: 0.7, display:'block', mt:0.5}}>
                                    {new Date(msg.createdAt).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}
                                </Typography>
                            </Paper>
                        ))}
                        {hasMore && (
                            <Button onClick={handleLoadMore}
                                    disabled={loadingMore}
                                    size='small'
                                    sx={{alignSelf:'center'}}
                            >
                                {loadingMore ? <CircularProgress size={16}/> : 'Показать раньше'}
                            </Button>
                        )}
                    </Stack>
                )}
            </Box>
            <MessageInput onSend={handleSend}/>
        </Box>
    )
}