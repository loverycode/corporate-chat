import { useState, useEffect, useRef } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { ChannelList } from './components/ChannelList';
import { MessageList } from './components/MessageList';
import { connectSocket, disconnectSocket} from './api/socket';
import { api, setAuthToken } from './api/client';
import type {ChannelMember } from './api/types';
import { decodeToken } from './utils/decodeToken';
import { ThemeProvider, CssBaseline, Box, useMediaQuery } from '@mui/material';
import { createAppTheme } from './theme';
import { LocaleProvider, useTranslation } from './i18n/localeContext';
import { sendReady, sendUnreadCount, listenToPortal, requestTokenRefresh } from './postMessage';

function App() {
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(() => {
        return new URLSearchParams(window.location.search).get('channel');
    });    
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
    const [locale, setLocale] = useState<'ru' | 'en'>('ru');
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
    const { t } = useTranslation();
    const selectedChannelIdRef = useRef(selectedChannelId);
    useEffect(() => { selectedChannelIdRef.current = selectedChannelId; }, [selectedChannelId]);

    const updateUnreadCount = async () => {
        try {
            const summary = await api.getUnreadSummary();
            sendUnreadCount(summary.total);
        } catch (error) {
            if (error instanceof Error && error.message === 'Token expired') {
                requestTokenRefresh();
                setAuthToken(null);
                setCurrentUser(null);
            }
            setRefreshTrigger((v) => v + 1);
        }
    };

    useEffect(() => {
        sendReady();
    }, []);

    useEffect(() => {
        const unsubscribe = listenToPortal({
            'portal:auth': ({ token }: { token: string }) => {
                const payload = decodeToken(token);
                setAuthToken(token);
                setCurrentUser({ id: payload.sub, name: payload.name });
                setSelectedChannelId(null);
                setTargetMessageId(null);
                setRefreshTrigger((v) => v + 1);
                setTimeout(updateUnreadCount, 100);
            },
            'portal:open': async ({ channelId, contextObjectId, userId }: { channelId?: string; contextObjectId?: string; userId?: string }) => {
                if (channelId) {
                    return setSelectedChannelId(channelId);
                }
                if (!currentUser) return;
                if (contextObjectId) {
                    const channel = await api.createChannel('context', [currentUser.id], undefined, contextObjectId);
                    setSelectedChannelId(channel.id);
                    return;
                }
                if (userId) {
                    const channel = await api.createChannel('direct', [currentUser.id, userId]);
                    setSelectedChannelId(channel.id);
                    return;
                }
            },
            'portal:theme': ({ mode }: { mode: 'light' | 'dark' }) => {
                setThemeMode(mode);
            },
            'portal:locale': ({ locale }: { locale: 'ru' | 'en' }) => {
                setLocale(locale);
            },
        });
        return unsubscribe;
    }, [currentUser]); 

    useEffect(() => {
        const contextParam = new URLSearchParams(window.location.search).get('context');
        if (contextParam && currentUser && !selectedChannelId) {
            api.createChannel('context', [currentUser.id], undefined, contextParam).then((ch) => {
                setSelectedChannelId(ch.id);
            });
        }
    }, [currentUser, selectedChannelId]);

    useEffect(() => {
        if (!currentUser) return; 
        updateUnreadCount();
        api.getOnlinePresence()
            .then((ids) => setOnlineUserIds(new Set(ids)))
            .catch(() => {});
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return; 
        const socket = connectSocket();

        function handlePresenceChanged(data: { userId: string; online: boolean }) {
            setOnlineUserIds((prev) => {
                const next = new Set(prev);
                if (data.online) {
                    next.add(data.userId);
                } else {
                    next.delete(data.userId);
                }
                return next;
            });
        }

        function handleChannelCreated() {
            setRefreshTrigger(prev => prev + 1);
        }

        function handleChannelDeleted(data: { channelId: string }) {
            setRefreshTrigger(prev => prev + 1);
            if (selectedChannelIdRef.current === data.channelId) {
                setSelectedChannelId(null);
            }
        }

        function handleMemberRemoved(data:{channelId: string; userId: string; members:ChannelMember[]}){
            setRefreshTrigger(prev=>prev+1);
            if (data.userId===currentUser?.id){
                setSelectedChannelId(null);
                setTimeout(updateUnreadCount, 100);
            }
        }

        function handleMembersUpdated(){
            setRefreshTrigger(prev=>prev+1);
        }

        function handleUnreadChanged(){
            updateUnreadCount();
        }

        socket.on('presence.changed', handlePresenceChanged);
        socket.on('channel.created', handleChannelCreated);
        socket.on('channel.deleted', handleChannelDeleted);
        socket.on('member.removed', handleMemberRemoved);
        socket.on('members.updated', handleMembersUpdated);
        socket.on('unread.changed', handleUnreadChanged);

        return () => {
            socket.off('presence.changed', handlePresenceChanged);
            socket.off('channel.created', handleChannelCreated);
            socket.off('channel.deleted', handleChannelDeleted);
            socket.off('member.removed', handleMemberRemoved);
            socket.off('members.updated', handleMembersUpdated);
            socket.off('unread.changed', handleUnreadChanged);
            disconnectSocket();
        };
    }, [currentUser]); 

    const theme = createAppTheme(themeMode);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

    if (!currentUser) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {DEMO_MODE ? (
                    <LoginScreen onLogin={(id, name) => setCurrentUser({ id, name })} />
                ):
                (<Box sx={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    Ожидание авторизации портала…
                </Box>)}
            </ThemeProvider>
        );
    }

    function handleSelectMessage(channelId: string, messageId: string) {
        setSelectedChannelId(channelId);
        setTargetMessageId(messageId);
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <LocaleProvider locale={locale}>
                <Box sx={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden', flexDirection: { xs: 'column', sm: 'row' } }}>
                    {(!isMobile || !selectedChannelId) && (
                        <ChannelList
                            sx={isMobile ? { width: '100%' } : { width: 280 }}
                            currentUser={currentUser}
                            selectedChannelId={selectedChannelId}
                            onSelectChannel={setSelectedChannelId}
                            refreshTrigger={refreshTrigger}
                            onlineUserIds={onlineUserIds}
                            onSelectMessage={handleSelectMessage}
                        />
                    )}

                    {(!isMobile || selectedChannelId) && selectedChannelId ? (
                        <MessageList
                            key={selectedChannelId}
                            channelId={selectedChannelId}
                            currentUserId={currentUser.id}
                            targetMessageId={targetMessageId}
                            onTargetHandled={() => setTargetMessageId(null)}
                            onBack={isMobile ? () => setSelectedChannelId(null) : undefined}
                            onlineUserIds={onlineUserIds}
                        />
                    ) : !isMobile ? (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p:2, minWidth: 0}}>
                             {t('selectChannel')}
                        </Box>
                    ): null}
                </Box>
            </LocaleProvider>
        </ThemeProvider>
    );
}

export default App;