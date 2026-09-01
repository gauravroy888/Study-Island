import { createContext, useContext, useEffect, useState, useRef } from 'react';

const PresenceContext = createContext({ 
  onlineEmails: new Set(), 
  isOnline: () => false, 
  sendMessage: () => {}, 
  lastMessage: null 
});

/**
 * Clean Native WebSocket Presence & Realtime Bus Provider:
 * Connects to ws://localhost:3000 (server.js native WebSocket server)
 * Receives instant 0ms presence_sync events whenever any tab connects/disconnects,
 * and passes custom realtime broadcasts (e.g. timetable_update).
 */
export function PresenceProvider({ user, children }) {
  const [onlineEmails, setOnlineEmails] = useState(new Set());
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const userEmail = user?.email ? user.email.toLowerCase().trim() : null;

  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;
    let isComponentMounted = true;

    const connectWS = () => {
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? `${window.location.hostname}:3000`
          : window.location.host;

        ws = new WebSocket(`${wsProtocol}//${wsHost}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (userEmail) {
            ws.send(JSON.stringify({ type: 'identify', email: userEmail }));
          } else {
            ws.send(JSON.stringify({ type: 'identify', email: null }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'presence_sync' && Array.isArray(data.emails)) {
              if (isComponentMounted) {
                setOnlineEmails(new Set(data.emails.map(e => e.toLowerCase().trim())));
              }
            } else if (isComponentMounted) {
              setLastMessage(data);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (isComponentMounted) {
            reconnectTimer = setTimeout(connectWS, 2000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (e) {
        if (isComponentMounted) {
          reconnectTimer = setTimeout(connectWS, 3000);
        }
      }
    };

    connectWS();

    return () => {
      isComponentMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, [userEmail]);

  const isOnline = (email) => {
    if (!email) return false;
    return onlineEmails.has(email.toLowerCase().trim());
  };

  const sendMessage = (data) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  return (
    <PresenceContext.Provider value={{ onlineEmails, isOnline, sendMessage, lastMessage }}>
      {children}
    </PresenceContext.Provider>
  );
}

export const usePresence = () => useContext(PresenceContext);




