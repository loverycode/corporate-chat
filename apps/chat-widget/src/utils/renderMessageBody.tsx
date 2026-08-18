import type { ReactNode } from "react";
import type { ObjectRef } from "../api/types";

const OBJECT_LINK_PATTERN = /https?:\/\/[^\s/]+\/dashboard\/object\/([0-9a-fA-F-]{36})/g;
const MENTION_PATTERN = /<@([0-9a-fA-F-]{36})>/g;

interface Member{
    userId: string;
    name: string;
}

export function renderMessageBody(bodyMd: string, refs: ObjectRef[], members: Member[],): ReactNode[]{
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;
    OBJECT_LINK_PATTERN.lastIndex = 0;
    MENTION_PATTERN.lastIndex = 0;
    const matches:{start:number; end:number; type:'object' | 'mention'; id: string}[] = [];
    let m: RegExpExecArray | null;
    while ((m = OBJECT_LINK_PATTERN.exec(bodyMd))!== null){
        matches.push({start: m.index, end: m.index+m[0].length, type:'object',id: m[1]});
    }
    while ((m = MENTION_PATTERN.exec(bodyMd))!== null){
        matches.push({start: m.index, end: m.index+m[0].length, type:'mention',id: m[1]});
    }
    matches.sort((a, b)=>a.start - b.start);
    for (const match of matches){
        if (match.start > lastIndex){
            parts.push(<span key={key++}>{bodyMd.slice(lastIndex, match.start)}</span>)
        }
        if (match.type === 'object'){
            const ref = refs.find((r)=>r.objectId===match.id);
            parts.push(<ObjectCard key={key++} ref={ref}/>);
        }
        else{
            const member = members.find((m)=>m.userId===match.id);
            
            parts.push(
                <span key={key++} style={{fontWeight: 600 }}>
                    @{member?.name || 'Пользователь'}
                </span>,
            );
        }
        lastIndex=match.end;
    }
    if (lastIndex<bodyMd.length){
        parts.push(<span key={key++}>{bodyMd.slice(lastIndex)}</span>)
    }
    return parts;
}

function ObjectCard({ref}: {ref?: ObjectRef}){
    if (!ref){
        return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>[Объект недоступен]</span>;
    }
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fafafa', fontSize: '0.85em' }}>
             {ref.snapshotTypeName}: {ref.snapshotTitle}
        </span>
    );
}

