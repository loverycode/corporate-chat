import { useState } from "react";
import {Box, Button, Typography, Stack, CircularProgress, Alert} from '@mui/material';
import {api, setAuthToken} from '../api/client';
import { useTranslation } from "../i18n/localeContext";
const TEST_USERS = [
    { id: 'b4bf0b67-6b40-4035-8ee7-0a8f0984ac99', name: 'Юрий Тестировщик' },
    { id: '21be610f-8ec5-4225-8880-a80d7029c2ea', name: 'Андрей Проджект' },
    { id: 'c3d4e5f6-1a2b-4c3d-9e4f-5a6b7c8d9e0f', name: 'Мария Иванова' },
    { id: 'd4e5f6a7-2b3c-4d4e-8f5a-6b7c8d9e0f1a', name: 'Дмитрий Петров' },
    { id: 'e5f6a7b8-3c4d-4e5f-9a6b-7c8d9e0f1a2b', name: 'Анна Смирнова' },
];

export function LoginScreen({onLogin}: {onLogin: (userId: string, userName: string)=> void}){
    const [loading, setLoading]=useState<string| null>(null);
    const [error, setError]=useState<string | null>(null);
    const {t}=useTranslation();
    
async function handleLogin(userId: string, name: string){
    setLoading(userId);
    setError(null);
    try{
        const {token} = await api.getToken(userId);
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
                        {t('SelectUser')}
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