import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { ChannelList } from './components/ChannelList';
import { MessageList } from './components/MessageList';
import { connectSocket, disconnectSocket, getSocket } from './api/socket';
import { api, setAuthToken } from './api/client';
import { listenToPortal, sendReady, sendOpenObject, requestTokenRefresh } from './postMessage';
import { decodeToken } from './utils/decodeToken';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { createAppTheme } from './theme';
import { LocaleProvider } from './i18n/localeContext';

function App() {
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
    const [locale, setLocale] = useState<'ru' | 'en'>('ru');
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

    // ✅ Все useEffect – на верхнем уровне, без ранних return
    useEffect(() => {
        sendReady();
    }, []);

    useEffect(() => {
        const unsubscribe = listenToPortal({
            'portal:auth': ({ token }: { token: string }) => {
                const payload = decodeToken(token);
                setAuthToken(token);
                setCurrentUser({ id: payload.sub, name: payload.name });
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
    }, [currentUser]); // зависимость от currentUser – ок

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const channelParam = params.get('channel');
        const contextParam = params.get('context');
        if (channelParam) {
            setSelectedChannelId(channelParam);
        } else if (contextParam && currentUser) {
            api.createChannel('context', [currentUser.id], undefined, contextParam).then((ch) => {
                setSelectedChannelId(ch.id);
            });
        }
    }, [currentUser]); // зависит от currentUser

    useEffect(() => {
        if (!currentUser) return; // условие внутри хука, а не до него
        api.getOnlinePresence()
            .then((ids) => setOnlineUserIds(new Set(ids)))
            .catch(() => {});
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return; // условие внутри хука
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

        function handleUnreadChanged() {
            setRefreshTrigger((v) => v + 1);
        }

        socket.on('presence.changed', handlePresenceChanged);
        socket.on('unread.changed', handleUnreadChanged);

        return () => {
            socket.off('presence.changed', handlePresenceChanged);
            socket.off('unread.changed', handleUnreadChanged);
            disconnectSocket();
        };
    }, [currentUser]);

    const theme = createAppTheme(themeMode);

    if (!currentUser) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <LoginScreen onLogin={(id, name) => setCurrentUser({ id, name })} />
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
                <Box sx={{ display: 'flex', height: '100vh' }}>
                    <ChannelList
                        currentUser={currentUser}
                        selectedChannelId={selectedChannelId}
                        onSelectChannel={setSelectedChannelId}
                        refreshTrigger={refreshTrigger}
                        onlineUserIds={onlineUserIds}
                        onSelectMessage={handleSelectMessage}
                        themeMode={themeMode}
                        onToggleTheme={() => setThemeMode((m) => (m === 'light' ? 'dark' : 'light'))}
                        locale={locale}
                        onToggleLocale={() => setLocale((l) => (l === 'ru' ? 'en' : 'ru'))}
                    />

                    {selectedChannelId ? (
                        <MessageList
                            channelId={selectedChannelId}
                            currentUserId={currentUser.id}
                            targetMessageId={targetMessageId}
                            onTargetHandled={() => setTargetMessageId(null)}
                        />
                    ) : (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            Выберите канал
                        </Box>
                    )}
                </Box>
            </LocaleProvider>
        </ThemeProvider>
    );
}

export default App;