export interface Channel{
    id: string;
    type: 'direct' | 'group' | 'context';
    title: string;
    contextObjectId: string | null;
    createdAt: string;
    createdBy: string;
    members: ChannelMember[];
    unreadCount: number;
    description: string | null;
    lastMessage?: Message | null;
}

export interface ChannelMember {
    channelId: string;
    userId: string;
    role: 'owner' | 'member';
    lastReadMessageId: string | null;
    muted: boolean;
    joinedAt: string;
    user?: {
        id: string;
        name: string;
        email: string;
    };
}

export interface Message {
    id: string;
    channelId: string;
    authorId: string;
    bodyMd: string;
    replyToId: string | null;
    clientMessageId: string;
    createdAt: string;
    editedAt: string | null;
    deletedAt: string | null;
    files: Attachment[];
    refs:  ObjectRef[];
    mentions: Mention[];
    replyTo: { id: string; bodyMd: string; authorId: string; deletedAt: string | null } | null;
    reactions: Reaction[];
}

export interface Attachment {
    id: string;
    fileName: string;
    mime: string;
    size: number;
    thumbKey: string | null;
}

export interface ObjectRef {
    id: string;
    messageId: string;  
    objectId: string;  
    snapshotTitle: string;  
    snapshotTypeName: string;  
    snapshotIcon: string;  
    canRead?: boolean;
}

export interface Mention{
    id: string;               
    messageId: string;        
    mentionedUserId: string;   
}

export interface Reaction {
    id: string;
    messageId: string;
    userId: string;
    emoji: string;
    createdAt: string;
}

export interface SearchResult {
    id: string;
    channelId: string;
    authorId: string;
    bodyMd: string;
    createdAt: Date;
    headline: string;
}
 