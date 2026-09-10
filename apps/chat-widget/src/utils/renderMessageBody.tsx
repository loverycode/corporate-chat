import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactNode } from "react";
import type { ObjectRef } from "../api/types";
import { sendOpenObject } from "../postMessage";

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
            <span key={key++} style={{ color: '#3b5a7a', fontWeight: 600 }}>
               @{member?.name || t('user') || 'Пользователь'} 
            </span>
            );
        }
        lastIndex=match.end;
    }
    if (lastIndex<bodyMd.length){
        parts.push(<MarkdownText key={key++} text={bodyMd.slice(lastIndex)} />);    }
    return parts;
}

function ObjectCard({ref, t}: {ref?: ObjectRef, t:(key: string)=>string}){
    if (!ref || !ref.snapshotTitle || !ref.snapshotTitle.trim() || ref.canRead === false){
        return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>{t('objectUnavailable')}</span>;
    }
    return (
        <span  onClick={()=>sendOpenObject(ref.objectId)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fafafa', fontSize: '0.85em' }}>
             {ref.snapshotTypeName}: {ref.snapshotTitle}
        </span>
    );
}

