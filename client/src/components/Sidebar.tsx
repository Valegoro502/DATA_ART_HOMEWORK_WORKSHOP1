import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import FriendsModal from './FriendsModal';

export default function Sidebar() {
  const { user, token, logout } = useAuthStore();
  const { activeRoomId, activeRecipientId, setActiveChat } = useChatStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showContacts, setShowContacts] = useState(true);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    const fetchRoomsAndFriends = async () => {
      try {
        const resRooms = await fetch(`http://${window.location.hostname}:3000/api/rooms/my-rooms`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resRooms.ok) setRooms(await resRooms.json());

        const resFriends = await fetch(`http://${window.location.hostname}:3000/api/users/friends`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resFriends.ok) setFriends(await resFriends.json());

      } catch (e) {
        console.error(e);
      }
    };
    fetchRoomsAndFriends();
  }, [token]);

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
        body: JSON.stringify({ name: newRoomName }),
      });
      const data = await res.json();
      if (res.ok) {
        setRooms([...rooms, data]);
        setActiveChat(data.id, null);
        setNewRoomName('');
        setIsCreating(false);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="sidebar glass-panel">
      <div className="sidebar-header">
        <h3>Chats</h3>
        <div className="user-profile">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span>{user?.username}</span>
            {user?.isGlobalAdmin && (
              <button 
                 className="small-action" 
                 style={{ background: '#722ed1' }} 
                 onClick={() => setActiveChat('ADMIN_PANEL', null)}>
                 Admin Panel
              </button>
            )}
          </div>
          <button className="small-action" onClick={logout}>Logout</button>
        </div>
      </div>
      <div className="room-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4>My Rooms</h4>
          <button className="small-action" onClick={() => setIsCreating(!isCreating)}>+</button>
        </div>
        
        {isCreating && (
          <form onSubmit={handleCreateRoom} style={{ marginBottom: '15px' }}>
            <input 
              type="text" 
              placeholder="Room Name..." 
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '5px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              autoFocus
            />
            <button type="submit" className="small-action" style={{ width: '100%' }}>Create</button>
          </form>
        )}

        {rooms.map(r => (
          <div 
            key={r.id} 
            className={`room-item ${activeRoomId === r.id ? 'active' : ''}`}
            onClick={() => setActiveChat(r.id, null)}
          >
            # {r.name}
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '10px' }}>
          <h4 style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => setShowContacts(!showContacts)}>
            {showContacts ? '▼' : '▶'} My Contacts
          </h4>
          <button className="small-action" onClick={() => setShowFriendsModal(true)}>Manage</button>
        </div>

        {showContacts && friends.map(f => (
          <div 
            key={f.id} 
            className={`room-item ${activeRecipientId === f.id ? 'active' : ''}`}
            onClick={() => setActiveChat(null, f.id)}
          >
            @ {f.username}
          </div>
        ))}
      </div>

      {showFriendsModal && <FriendsModal onClose={() => setShowFriendsModal(false)} />}
    </div>
  );
}
