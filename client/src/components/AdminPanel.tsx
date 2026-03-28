import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';

export default function AdminPanel() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'USERS' | 'ROOMS'>('USERS');
  const [users, setUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [presence, setPresence] = useState<Record<string, 'active' | 'afk' | 'offline'>>({});

  const fetchUsers = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        // Initialize presence from API response
        const initialPresence: Record<string, any> = {};
        data.forEach((u: any) => { initialPresence[u.id] = u.presence; });
        setPresence(initialPresence);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/admin/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setRooms(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'USERS') fetchUsers();
    else fetchRooms();
  }, [token, activeTab]);

  // Presence listener
  useEffect(() => {
    const handlePresence = (e: any) => {
      const { userId, status } = e.detail;
      setPresence(prev => ({ ...prev, [userId]: status }));
    };

    window.addEventListener('presence-update', handlePresence);
    return () => window.removeEventListener('presence-update', handlePresence);
  }, []);

  const handleBan = async (userId: string, type: 'PERMANENT' | 'PARTIAL') => {
    let durationHours: number | undefined;
    if (type === 'PARTIAL') {
      const input = window.prompt("Enter duration in HOURS:");
      if (input === null) return;
      durationHours = parseFloat(input);
      if (isNaN(durationHours) || durationHours <= 0) return alert("Invalid duration");
    }

    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/admin/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, type, durationHours })
      });
      if (res.ok) fetchUsers();
      else alert((await res.json()).error);
    } catch (e) { console.error(e); }
  };

  const handleUnban = async (userId: string) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/admin/unban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });
      if (res.ok) fetchUsers();
    } catch (e) { console.error(e); }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm("Are you sure you want to delete this room? This action is irreversible.")) return;
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchRooms();
      else alert("Failed to delete room");
    } catch (e) { console.error(e); }
  };

  return (
    <div className="chat-area" style={{ padding: '20px', overflowY: 'auto' }}>
      <div className="chat-header">
        <h3>Admin Panel</h3>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            className={`small-action ${activeTab === 'USERS' ? 'active' : ''}`} 
            onClick={() => setActiveTab('USERS')}
            style={{ padding: '10px 20px', background: activeTab === 'USERS' ? '#1890ff' : 'transparent' }}
          >
            Users
          </button>
          <button 
            className={`small-action ${activeTab === 'ROOMS' ? 'active' : ''}`} 
            onClick={() => setActiveTab('ROOMS')}
            style={{ padding: '10px 20px', background: activeTab === 'ROOMS' ? '#1890ff' : 'transparent' }}
          >
            Rooms
          </button>
        </div>
      </div>

      <div className="admin-content" style={{ marginTop: '20px' }}>
        {activeTab === 'USERS' ? (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                <th style={{ padding: '10px' }}>Username</th>
                <th style={{ padding: '10px' }}>Email</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        width: '10px', 
                        height: '10px', 
                        borderRadius: '50%', 
                        background: presence[u.id] === 'active' ? '#52c41a' : presence[u.id] === 'afk' ? '#faad14' : '#555',
                        boxShadow: presence[u.id] === 'active' ? '0 0 5px #52c41a' : 'none'
                      }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{u.username} {u.isGlobalAdmin && '(Admin)'}</span>
                        {u.globalBanType && (
                          <span style={{ fontSize: '10px', color: u.globalBanType === 'PERMANENT' ? '#ff4d4f' : '#faad14', fontWeight: 'bold' }}>
                            {u.globalBanType} BAN {u.globalBanUntil && `UNTIL ${new Date(u.globalBanUntil).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px' }}>{u.email}</td>
                  <td style={{ padding: '10px', textTransform: 'capitalize' }}>
                    <span style={{ color: presence[u.id] === 'active' ? '#52c41a' : presence[u.id] === 'afk' ? '#faad14' : '#999' }}>
                      {presence[u.id] || 'offline'}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {!u.isGlobalAdmin && (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {u.globalBanType ? (
                          <button className="small-action" onClick={() => handleUnban(u.id)}>Unban</button>
                        ) : (
                          <>
                            <button className="small-action" style={{ background: '#faad14', color: 'black' }} onClick={() => handleBan(u.id, 'PARTIAL')}>Partial</button>
                            <button className="small-action" style={{ background: '#ff4d4f' }} onClick={() => handleBan(u.id, 'PERMANENT')}>Permanent</button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                <th style={{ padding: '10px' }}>Room Name</th>
                <th style={{ padding: '10px' }}>Owner</th>
                <th style={{ padding: '10px' }}>Visibility</th>
                <th style={{ padding: '10px' }}>Members</th>
                <th style={{ padding: '10px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <td style={{ padding: '10px' }}>{r.name}</td>
                  <td style={{ padding: '10px' }}>{r.owner?.username || 'System'}</td>
                  <td style={{ padding: '10px' }}>{r.isPrivate ? 'Private' : 'Public'}</td>
                  <td style={{ padding: '10px' }}>{r._count?.members || 0}</td>
                  <td style={{ padding: '10px' }}>
                    <button className="small-action" style={{ background: '#ff4d4f' }} onClick={() => handleDeleteRoom(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

