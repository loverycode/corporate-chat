import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactNode, ComponentType } from "react";
import type { ObjectRef } from "../api/types";
import { sendOpenObject } from "../postMessage";
import { Paper, Box, Typography } from '@mui/material';
import ApartmentIcon from '@mui/icons-material/Apartment';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderIcon from '@mui/icons-material/Folder';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import PersonIcon from '@mui/icons-material/Person';
import EventIcon from '@mui/icons-material/Event';
import LockIcon from '@mui/icons-material/Lock';

const OBJECT_ICON_MAP: Record<string, ComponentType<{ fontSize?: 'inherit' | 'small' }>> = {
    Apartment: ApartmentIcon,
    Assignment: AssignmentIcon,
    Description: DescriptionIcon,
    Folder: FolderIcon,
    BusinessCenter: BusinessCenterIcon,
    Person: PersonIcon,
    Event: EventIcon,
};
const DEFAULT_OBJECT_ICON = DescriptionIcon;

const PORTAL_PUBLIC_URLS = import.meta.env.VITE_PORTAL_PUBLIC_URLS 
    ? import.meta.env.VITE_PORTAL_PUBLIC_URLS.split(',').map((url: string) => url.trim())
    : [];

const buildObjectLinkPattern = () => {
    if (PORTAL_PUBLIC_URLS.length === 0) {
        return /(?!)/; 
    }
    const escapedDomains = PORTAL_PUBLIC_URLS.map((domain: string) => 
        domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    return new RegExp(
        `https?:\\/\\/(?:${escapedDomains.join('|')})\\/dashboard\\/object\\/([0-9a-fA-F-]{36})`,
        'g'
    );
};

const OBJECT_LINK_PATTERN = buildObjectLinkPattern();
const MENTION_PATTERN = /<@([0-9a-fA-F-]{36})>/g;
interface Member{
    userId: string;
    name: string;
}

function MarkdownText({text}:{text: string}){
    return(
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            p: ({children})=><span>{children}</span>,
            a: ({href, children})=>(
                <a href={href} target="_blank" rel="noreferrer noopener">
                    {children}
                </a>
            ),
            code:({children})=>(
                <code style={{ background: 'rgba(0,0,0,0.08)', padding: '2px 4px', borderRadius: 4, fontSize: '0.9em' }}>
                        {children}
                </code>
            ),
        }}
        >{text}</ReactMarkdown>
    );
}

export function renderMessageBody(bodyMd: string, refs: ObjectRef[], members: Member[], t: (key: string) => string): ReactNode[]{
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;
    OBJECT_LINK_PATTERN.lastIndex = 0;
    MENTION_PATTERN.lastIndex = 0;
    const matches:{start:number; end:number; type:'object' | 'mention'; id: string}[] = [];
    let m: RegExpExecArray | null;
    if (PORTAL_PUBLIC_URLS.length > 0) {
        while ((m = OBJECT_LINK_PATTERN.exec(bodyMd))!== null){
            matches.push({start: m.index, end: m.index+m[0].length, type:'object',id: m[1]});
        }
    }
    while ((m = MENTION_PATTERN.exec(bodyMd))!== null){
        matches.push({start: m.index, end: m.index+m[0].length, type:'mention',id: m[1]});
    }
    matches.sort((a, b)=>a.start - b.start);
    for (const match of matches){
        if (match.start > lastIndex){
            parts.push(<MarkdownText key={key++} text={bodyMd.slice(lastIndex, match.start)} />);        }
        if (match.type === 'object'){
            const ref = refs.find((r)=>r.objectId===match.id);
            parts.push(<ObjectCard key={key++} ref={ref} t={t as any}/>);
        }
        else{
            const member = members.find((m)=>m.userId===match.id);
            parts.push(
            <span key={key++} style={{ fontWeight: 700, textDecoration: 'underline' }}>
               @{member?.name || t('user') || 'Пользователь'}{' '}  
            </span>
            )
        }
        lastIndex=match.end;
    }
    if (lastIndex<bodyMd.length){
        parts.push(<MarkdownText key={key++} text={bodyMd.slice(lastIndex)} />);    }
    return parts;
}

function ObjectCard({ref, t}: {ref?: ObjectRef, t:(key: string)=>string}){
    if (!ref || !ref.snapshotTitle || !ref.snapshotTitle.trim() || ref.canRead === false){
        return (
            <Paper
                variant="outlined"
                sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, mb: 0.5, opacity: 0.7 }}
            >
                <LockIcon fontSize="small" />
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{t('objectUnavailable')}</Typography>
            </Paper>
        );
    }
    const IconComponent = OBJECT_ICON_MAP[ref.snapshotIcon ?? ''] ?? DEFAULT_OBJECT_ICON;
    return (
        <Paper
            variant="outlined"
            onClick={() => sendOpenObject(ref.objectId)}
            sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, mb: 0.5, cursor: 'pointer' }}
        >
            <IconComponent fontSize="small" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>{ref.snapshotTitle}</Typography>
                <Typography variant="caption" color="text.secondary">{ref.snapshotTypeName}</Typography>
            </Box>
        </Paper>
    );
}
