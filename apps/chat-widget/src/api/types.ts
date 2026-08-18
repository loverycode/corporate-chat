export interface Channel{
    id: string;
    type: 'direct' | 'group' | 'context';
    title: string;
    contextObjectId: string | null;
    createdAt: string;
    createdBy: string;
    members: ChannelMember[];
    unreadCount: number;
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
}

export interface Mention{
    id: string;               
    messageId: string;        
    mentionedUserId: string;   
}

