import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { socketService } from '../lib/socket';
import FriendsModal from './FriendsModal';
import RoomExplorerModal from './RoomExplorerModal';
import SettingsModal from './SettingsModal';

export default function Sidebar() {
  const { user, token, logout } = useAuthStore();
  const { activeRoomId, activeRecipientId, setActiveChat } = useChatStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showRooms, setShowRooms] = useState(true);
  const [showContacts, setShowContacts] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomIsPrivate, setNewRoomIsPrivate] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [presence, setPresence] = useState<Record<string, 'active' | 'afk' | 'offline'>>({});

  const fetchFriends = async () => {
    try {
      const resFriends = await fetch(`http://${window.location.hostname}:3000/api/users/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resFriends.ok) setFriends(await resFriends.json());
    } catch (e) {
      console.error(e);
    }
  };

  const lastSeenKey = (id: string) => `lastSeen:${user?.id}:${id}`;
  const getLastSeen = (id: string): string => localStorage.getItem(lastSeenKey(id)) || new Date(0).toISOString();
  const markAsRead = (id: string) => localStorage.setItem(lastSeenKey(id), new Date().toISOString());

  const fetchRooms = async () => {
    try {
      const resRooms = await fetch(`http://${window.location.hostname}:3000/api/rooms/my-rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resRooms.ok) return;
      const roomList = await resRooms.json();
      setRooms(roomList);

      const counts: Record<string, number> = {};
      await Promise.all(roomList.map(async (r: any) => {
        const since = getLastSeen(r.id);
        try {
          const res = await fetch(
            `http://${window.location.hostname}:3000/api/rooms/${r.id}/unread-count?since=${encodeURIComponent(since)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.ok) {
            const { count } = await res.json();
            if (count > 0) counts[r.id] = count;
          }
        } catch (e) { /* ignore */ }
      }));
      setUnreadCounts(prev => ({ ...prev, ...counts }));

    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchFriends();
  }, [token]);

  const activeRoomRef = useRef(activeRoomId);
  const activeRecipientRef = useRef(activeRecipientId);
  useEffect(() => { activeRoomRef.current = activeRoomId; }, [activeRoomId]);
  useEffect(() => { activeRecipientRef.current = activeRecipientId; }, [activeRecipientId]);

  useEffect(() => {
    const tryRegister = (): (() => void) | null => {
      const socket = socketService.socket;
      if (!socket) return null;

      const handleNewMessage = (message: any) => {
        const curRoom = activeRoomRef.current;
        const curRecipient = activeRecipientRef.current;

        let key: string | null = null;
        if (message.roomId && message.roomId !== curRoom) {
          key = message.roomId;
        } else if (!message.roomId && message.senderId !== curRecipient) {
          key = message.senderId;
        }
        if (key) {
          setUnreadCounts(prev => ({ ...prev, [key!]: (prev[key!] || 0) + 1 }));
        }
      };

      socket.on('message:new', handleNewMessage);
      return () => { socket.off('message:new', handleNewMessage); };
    };

    let cleanup = tryRegister();
    let interval: any = null;
    if (!cleanup) {
      interval = setInterval(() => {
        const result = tryRegister();
        if (result) {
          cleanup = result;
          clearInterval(interval);
        }
      }, 300);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (cleanup) cleanup();
    };
  }, []);

  useEffect(() => {
    const handlePresence = (e: any) => {
      const { userId, status } = e.detail;
      setPresence(prev => ({ ...prev, [userId]: status === 'online' ? 'active' : status }));
    };

    window.addEventListener('presence-update', handlePresence);
    return () => window.removeEventListener('presence-update', handlePresence);
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/rooms`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          name: newRoomName,
          description: newRoomDescription,
          isPrivate: newRoomIsPrivate
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRooms([...rooms, data]);
        setActiveChat(data.id, null);
        setNewRoomName('');
        setNewRoomDescription('');
        setNewRoomIsPrivate(false);
        setIsCreating(false);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleRooms = () => {
    setShowRooms(!showRooms);
    if (!showRooms) setShowContacts(false);
  };

  const toggleContacts = () => {
    setShowContacts(!showContacts);
    if (!showContacts) setShowRooms(false);
  };

  return (
    <div className="sidebar glass-panel">
      <div className="sidebar-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <h3>Classic Chat</h3>
          <div style={{ display: 'flex', gap: '5px' }}>
             <button className="small-action" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
             <button className="small-action" onClick={logout} title="Logout">🚪</button>
          </div>
        </div>
        <div className="user-profile" style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
            <span style={{ fontWeight: 'bold' }}>{user?.username} {user?.isGlobalAdmin && '(Admin)'}</span>
            {user?.isGlobalAdmin && (
              <button 
                 className="small-action" 
                 style={{ background: '#722ed1', width: '100%' }} 
                 onClick={() => setActiveChat('ADMIN_PANEL', null)}>
                 Admin Panel
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="room-list">
        {/* Accordion My Rooms */}
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '5px' }}
          onClick={toggleRooms}
        >
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {showRooms ? '▼' : '▶'} My Rooms
          </h4>
          <div style={{ display: 'flex', gap: '5px' }} onClick={e => e.stopPropagation()}>
            <button className="small-action" onClick={() => setShowExplorer(true)}>Explore</button>
            <button className="small-action" onClick={() => setIsCreating(!isCreating)}>+</button>
          </div>
        </div>
        
        {showRooms && (
          <div style={{ maxHeight: '40vh', overflowY: 'auto', marginBottom: '15px' }}>
            {isCreating && (
              <form onSubmit={handleCreateRoom} style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Room Name..." 
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                  autoFocus
                />
                <textarea 
                  placeholder="Description (optional)" 
                  value={newRoomDescription}
                  onChange={e => setNewRoomDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', resize: 'none', height: '60px', fontSize: '12px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={newRoomIsPrivate}
                    onChange={e => setNewRoomIsPrivate(e.target.checked)}
                  />
                  Private Room
                </label>
                <button type="submit" className="small-action" style={{ width: '100%' }}>Create</button>
              </form>
            )}

            {rooms.length === 0 && <div style={{ fontSize: '12px', opacity: 0.5, textAlign: 'center', padding: '10px' }}>No rooms joined</div>}
            {rooms.map(r => (
              <div 
                key={r.id} 
                className={`room-item ${activeRoomId === r.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveChat(r.id, null);
                  markAsRead(r.id);
                  setUnreadCounts(prev => { const n = {...prev}; delete n[r.id]; return n; });
                }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span># {r.name}</span>
                {unreadCounts[r.id] > 0 && (
                  <span style={{ background: '#ff4d4f', color: '#fff', borderRadius: '50%', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', padding: '0 4px' }}>
                    {unreadCounts[r.id] > 99 ? '99+' : unreadCounts[r.id]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Accordion My Contacts */}
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', marginBottom: '10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '5px' }}
          onClick={toggleContacts}
        >
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {showContacts ? '▼' : '▶'} My Contacts
          </h4>
          <button className="small-action" onClick={e => { e.stopPropagation(); setShowFriendsModal(true); }}>Manage</button>
        </div>

        {showContacts && (
          <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
            {friends.length === 0 && <div style={{ fontSize: '12px', opacity: 0.5, textAlign: 'center', padding: '10px' }}>No contacts added</div>}
            {friends.map(f => (
              <div 
                key={f.id} 
                className={`room-item ${activeRecipientId === f.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveChat(null, f.id);
                  setUnreadCounts(prev => { const n = {...prev}; delete n[f.id]; return n; });
                }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: presence[f.id] === 'active' ? '#52c41a' : presence[f.id] === 'afk' ? '#faad14' : '#555' 
                  }} />
                  <span>@ {f.username}</span>
                </div>
                {unreadCounts[f.id] > 0 && (
                  <span style={{ background: '#ff4d4f', color: '#fff', borderRadius: '50%', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', padding: '0 4px' }}>
                    {unreadCounts[f.id] > 99 ? '99+' : unreadCounts[f.id]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {showFriendsModal && (
        <FriendsModal onClose={() => {
          setShowFriendsModal(false);
          fetchFriends();
        }} />
      )}

      {showExplorer && (
        <RoomExplorerModal 
          onClose={() => setShowExplorer(false)} 
          onJoined={fetchRooms}
        />
      )}
    </div>
  );
}

