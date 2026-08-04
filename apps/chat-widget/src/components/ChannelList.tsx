import {useState, useEffect} from 'react';
import {Box, Typography, List, ListItemText, CircularProgress, ListItemButton} from '@mui/material';
import { api } from '../api/client';
import type { Channel } from '../api/types';

export function ChannelList({currentUser, selectedChannelId, onSelectChannel,}: {currentUser:{id: string; name: string}; 
                                                                                   selectedChannelId: string | null;
                                                                                   onSelectChannel: (channelId: string)=>void}){
    const [channels, setChannels]=useState<Channel[] | null>(null);
    const [error, setError]=useState<string | null>(null);

    useEffect(()=>{
        api.getChannels().then(setChannels).catch((err)=>setError(err.message));
    }, []);
    return(
        <Box sx={{width: 280, borderRight:1, borderColor: 'divider', p:2}}>
            <Typography variant="subtitle2" color="text.secondary" sx={{mb:1}}>
                {currentUser.name}
            </Typography>
            {error && <Typography color="error">{error}</Typography>}
            {!channels && !error && <CircularProgress size={24}/> }
            {channels && (
                <List>
                    {channels.length===0 && (
                        <Typography color="text.secondary">Нет каналов</Typography>
                    )}
                    {channels.map((ch)=>(
                        <ListItemButton key={ch.id}
                                        selected={ch.id===selectedChannelId}
                                        onClick={()=> onSelectChannel(ch.id)}>
                            <ListItemText primary={ch.title || 'Личный диалог'}/>
                        </ListItemButton>
                    ))}
                </List>
            )}

        </Box>
    )
}