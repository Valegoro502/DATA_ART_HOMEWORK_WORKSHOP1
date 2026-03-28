import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';

interface RoomExplorerModalProps {
  onClose: () => void;
  onJoined: () => void;
}

export default function RoomExplorerModal({ onClose, onJoined }: RoomExplorerModalProps) {
  const { token } = useAuthStore();
  const { setActiveChat } = useChatStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchPublicRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/rooms/public?search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setRooms(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPublicRooms();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const handleJoin = async (roomId: string) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        onJoined();
        setActiveChat(roomId, null);
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to join room");
      }
    } catch (e) {
      console.error(e);
      alert("Network error");
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ width: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>Explore Public Rooms</h2>
          <button className="small-action" onClick={onClose} style={{ fontSize: '18px' }}>✕</button>
        </div>

        <input 
          type="text" 
          placeholder="Search for rooms by name or description..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '12px', 
            borderRadius: '8px', 
            border: '1px solid rgba(255,255,255,0.1)', 
            background: 'rgba(255,255,255,0.05)', 
            color: 'white',
            marginBottom: '20px'
          }}
          autoFocus
        />

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
          {loading && <div style={{ textAlign: 'center', padding: '20px' }}>Searching...</div>}
          {!loading && rooms.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.5)' }}>No rooms found matching your search.</div>}
          
          {rooms.map(room => (
            <div 
              key={room.id} 
              className="glass-panel" 
              style={{ 
                padding: '15px', 
                marginBottom: '10px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 5px 0' }}># {room.name}</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                  {room.description || "No description provided."}
                </p>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '5px' }}>
                  👥 {room._count?.members || 0} members
                </div>
              </div>
              <button 
                className="small-action" 
                style={{ background: '#52c41a', padding: '8px 15px' }}
                onClick={() => handleJoin(room.id)}
              >
                Join
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
