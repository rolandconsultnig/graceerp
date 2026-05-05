import { useCallback, useEffect, useRef, useState } from 'react';
import { buildPortalChatWsUrl } from '../utils/portalChat';

/**
 * WebSocket room for one member thread: chat refresh pushes + WebRTC signaling relay.
 */
export function usePortalChat({ memberId, role, enabled, onRefresh }) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const listenersRef = useRef(new Set());
  const [wsConnected, setWsConnected] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const subscribeSignals = useCallback((cb) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  }, []);

  const sendSignal = useCallback((partial) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'portal-signal', ...partial }));
  }, []);

  const lastTypingSentRef = useRef(0);
  const sendTyping = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1600) return;
    lastTypingSentRef.current = now;
    ws.send(JSON.stringify({ type: 'typing' }));
  }, []);

  useEffect(() => {
    if (!enabled || !memberId) {
      setWsConnected(false);
      return undefined;
    }

    let stopped = false;
    let attempts = 0;

    function clearReconnect() {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function connect() {
      const url = buildPortalChatWsUrl(memberId, role);
      if (!url) {
        setWsConnected(false);
        return;
      }

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (stopped) return;
          attempts = 0;
          setWsConnected(true);
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (stopped) return;
          attempts += 1;
          const delay = Math.min(30000, 800 * 2 ** Math.min(attempts, 5));
          reconnectTimerRef.current = setTimeout(connect, delay);
        };

        ws.onerror = () => {};

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'chat:refresh') onRefreshRef.current?.();
            if (msg.type === 'portal-signal' || msg.type === 'typing') {
              listenersRef.current.forEach((fn) => {
                try {
                  fn(msg);
                } catch {
                  /* ignore listener errors */
                }
              });
            }
          } catch {
            /* ignore */
          }
        };
      } catch {
        setWsConnected(false);
      }
    }

    connect();

    return () => {
      stopped = true;
      clearReconnect();
      const w = wsRef.current;
      wsRef.current = null;
      try {
        w?.close();
      } catch {
        /* ignore */
      }
    };
  }, [memberId, role, enabled]);

  return { wsConnected, subscribeSignals, sendSignal, sendTyping };
}
