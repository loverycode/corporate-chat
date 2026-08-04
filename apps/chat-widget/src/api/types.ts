export interface Channel{
    id: string;
    type: 'direct' | 'group' | 'context';
    title: string;
    contextObjectId: string | null;
    createdAt: string;
    createdBy: string;
    members: ChannelMember[];
}

export interface ChannelMember {
    channelId: string;
    userId: string;
    role: 'owner' | 'member';
    lastReadMessageId: string | null;
    muted: boolean;
    joinedAt: string;
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
}