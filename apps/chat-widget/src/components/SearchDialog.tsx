import { useState } from "react";
import {Dialog, TextField, Typography,DialogTitle, DialogContent, List, ListItemButton,  ListItemText, CircularProgress } from '@mui/material';
import { api } from "../api/client";
import type { SearchResult } from "../api/types";
import { useTranslation } from "../i18n/localeContext";

function renderHighlightedText(text: string) {
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    const regex = /<mark>(.*?)<\/mark>/g;
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];
        const content = match[1];
        const startIndex = match.index;
        const endIndex = startIndex + fullMatch.length;
        
        if (startIndex > lastIndex) {
            const beforeText = text.substring(lastIndex, startIndex);
            const escaped = beforeText
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: escaped }} />);
        }
        parts.push(
            <mark key={key++} style={{ backgroundColor: '#cbd9ff' }}>
                {content}
            </mark>
        );
        
        lastIndex = endIndex;
    }
    if (lastIndex < text.length) {
        const afterText = text.substring(lastIndex);
        const escaped = afterText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: escaped }} />);
    }
    return <>{parts}</>;
}


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
            {results && !loading && (
                results.length > 0 ? (
                    <List>
                        {results.map((r )=>(
                            <ListItemButton key={r.id} onClick={()=>handleSelect(r)}>
                             <ListItemText primary={<span>{renderHighlightedText(r.headline)}</span>}
                                           secondary={new Date(r.createdAt).toLocaleString()}/>
                            </ListItemButton>
                        ))}
                    </List>
                ) : (
                    <Typography color="text.secondary">{t('nothingFound')}</Typography>
                )
            )}
        </DialogContent>
    </Dialog>
    );
}