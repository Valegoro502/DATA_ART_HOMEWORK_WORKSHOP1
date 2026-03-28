import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';

export default function Sidebar() {
  const { user, token, logout } = useAuthStore();
  const { activeRoomId, setActiveChat } = useChatStore();
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch(`http://${window.location.hostname}:3000/api/rooms/my-rooms`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) setRooms(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchRooms();
  }, [token]);

  return (
    <div className="sidebar glass-panel">
      <div className="sidebar-header">
        <h3>Chats</h3>
        <div className="user-profile">
          <span>{user?.username}</span>
          <button className="small-action" onClick={logout}>Logout</button>
        </div>
      </div>
      <div className="room-list">
        <h4>My Rooms</h4>
        {rooms.map(r => (
          <div 
            key={r.id} 
            className={`room-item ${activeRoomId === r.id ? 'active' : ''}`}
            onClick={() => setActiveChat(r.id, null)}
          >
            # {r.name}
          </div>
        ))}
      </div>
    </div>
  );
}
