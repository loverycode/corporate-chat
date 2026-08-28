import { useState } from "react";
import {Dialog, TextField, DialogTitle, DialogContent, List, ListItemButton,  ListItemText, Typography, CircularProgress } from '@mui/material';
import { api } from "../api/client";
import type { SearchResult } from "../api/types";
import { useTranslation } from "../i18n/localeContext";
export function SearchDialog({open, onClose, onSelectResult}:{open: boolean; onClose:()=>void; onSelectResult: (channelId: string, messageId: string)=>void;}){
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[] | null>(null);
    const [loading, setLoading] = useState(false);
    const debounceRef = useState<{ current: ReturnType<typeof setTimeout> | null }>({ current: null })[0];
    const {t}=useTranslation();

    function handleQueryChange(value: string){
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!value.trim()){
            setResults(null);
            return;
        }
        debounceRef.current = setTimeout(async ()=>{
            setLoading(true);
            try{
                const data = await api.search(value.trim());
                setResults(data);
            }catch{
                setResults([]);
            }finally{
                setLoading(false);
            }
        }, 400);
    }
    function handleSelect(result: SearchResult){
        onSelectResult(result.channelId, result.id);
        onClose();
        setQuery('');
        setResults(null);
    }
    return(
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>{t('searchTitle')}</DialogTitle>
        <DialogContent>
            <TextField fullWidth autoFocus placeholder={t('searchPlaceholder')}
            value={query} onChange={(e)=>handleQueryChange(e.target.value)} sx={{mb:2}}/>
            {loading && <CircularProgress size={20}/>}
            {results && results.length>0 && (
                <List>
                    {results.map((r)=>(
                        <ListItemButton key={r.id} onClick={()=>handleSelect(r)}>
                         <ListItemText primary={<span dangerouslySetInnerHTML={{ __html: r.headline }} />}
                                       secondary={new Date(r.createdAt).toLocaleString()}/>
                        </ListItemButton>
                    ))}
                </List>
            )}
        </DialogContent>
    </Dialog>
    );
}