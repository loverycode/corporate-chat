import { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { LoginScreen } from './components/LoginScreen';
import { ChannelList } from './components/ChannelList';
import { MessageList } from './components/MessageList';
import { connectSocket, disconnectSocket, getSocket } from './api/socket';

function App() {
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        if (currentUser) {
            connectSocket();
        }
        return () => {
            disconnectSocket();
        };
    }, [currentUser]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        function handleUnreadChanged() {
            setRefreshTrigger((v) => v + 1);
        }
        socket.on('unread.changed', handleUnreadChanged);
        return () => { socket.off('unread.changed', handleUnreadChanged); };
    }, [currentUser]);

    if (!currentUser) {
        return <LoginScreen onLogin={(id, name) => setCurrentUser({ id, name })} />;
    }

    return (
        <Box sx={{ display: 'flex', height: '100vh' }}>
            <ChannelList
                currentUser={currentUser}
                selectedChannelId={selectedChannelId}
                onSelectChannel={setSelectedChannelId}
                refreshTrigger={refreshTrigger}
            />
            {selectedChannelId ? (
                <MessageList channelId={selectedChannelId} currentUserId={currentUser.id} />
            ) : (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Выберите канал
                </Box>
            )}
        </Box>
    );
}

export default App;