import {io, Socket} from 'socket.io-client';
import { getAuthToken } from './client';

let socket: Socket | null = null;

export function connectSocket(): Socket{
    if (socket) return socket;
    socket = io('http://127.0.0.1:3000', {auth: {token: getAuthToken()},});
    return socket;
}

export function getSocket(): Socket | null{
    return socket;
}

export function disconnectSocket(){
    socket?.disconnect();
    socket=null;
}