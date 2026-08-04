import { useState } from "react";
import {Box, Button, Typography, Stack, CircularProgress, Alert} from '@mui/material';
import {api, setAuthToken} from '../api/client';

const TEST_USERS = [
    { id: 'b4bf0b67-6b40-4035-8ee7-0a8f0984ac99', name: 'Тест Тестов' },
    { id: '21be610f-8ec5-4225-8880-a80d7029c2ea', name: 'Второй Пользователь' },
];

export function LoginScreen({onLogin}: {onLogin: (userId: string, userName: string)=> void}){
    const [loading, setLoading]=useState<string| null>(null);
    const [error, setError]=useState<string | null>(null);

    async function handleLogin(userId: string, name: string){
        setLoading(userId);
        setError(null);
        try{
            const {token} = await api.devLogin(userId, name);
            setAuthToken(token);
            onLogin(userId, name);
        }catch(err){
            setError( err instanceof Error ? err.message : 'Ошибка входа');
        }finally{
            setLoading(null);
        }
    }
        return(
            <Box
                sx={{
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent:'center',
                    bgcolor:'background.default',
                }}
            >
                <Stack spacing={2} sx={{minWidth:280}}>
                    <Typography variant="h6" align="center">
                        Выберите пользователя
                    </Typography>
                    {error && <Alert severity="error">{error}</Alert>}
                    {TEST_USERS.map((user)=>(
                        <Button
                            key={user.id}
                            variant="contained"
                            onClick={()=>handleLogin(user.id, user.name)}
                            disabled={loading!==null}
                        >
                            {loading===user.id ? <CircularProgress size={20} color='inherit'/> : user.name}
                        </Button>
                    ))}
                </Stack>
            </Box>
        );
}