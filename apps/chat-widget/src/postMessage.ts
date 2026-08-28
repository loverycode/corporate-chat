const ALLOWED_PORTAL_ORIGIN = import.meta.env.VITE_PORTAL_ORIGIN || '*';

export function sendToPortal(type: string, payload?: Record<string, unknown>) {
    if (window.parent === window) return; 
    window.parent.postMessage({ type, ...payload }, ALLOWED_PORTAL_ORIGIN);
}

export function sendReady(){
    sendToPortal('chat:ready');
}

export function sendUnreadCount(total: number) {
    sendToPortal('chat:unread-count', { total });
}

export function sendOpenObject(objectId: string) {
    sendToPortal('chat:open-object', { objectId });
}

export function requestTokenRefresh() {
    sendToPortal('chat:token-expired');
}

type PortalMessageHandler = (data: any) => void;

export function listenToPortal(handlers: Record<string, PortalMessageHandler>) {
    function handleMessage(event: MessageEvent) {
        if (ALLOWED_PORTAL_ORIGIN !== '*' && event.origin !== ALLOWED_PORTAL_ORIGIN) {
            return; 
        }
        const { type, ...payload } = event.data || {};
        const handler = handlers[type];
        if (handler) handler(payload);
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
}