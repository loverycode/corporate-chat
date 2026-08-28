import {jwtDecode} from 'jwt-decode';

interface TokenPayload{
    sub: string;
    name: string;
    email: string;
    role: string;
    exp: number;
}

export function decodeToken(token: string): TokenPayload{
    return jwtDecode<TokenPayload>(token);
}