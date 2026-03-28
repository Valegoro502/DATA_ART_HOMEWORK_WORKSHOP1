import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';

export default function AdminPanel() {
  const { token } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleBan = async (userId: string, type: 'PERMANENT' | 'PARTIAL') => {
    let durationHours: number | undefined;

    if (type === 'PARTIAL') {
      const input = window.prompt("Enter the duration of the partial ban in HOURS (e.g. 24 for 1 day):");
      if (input === null) return; // User cancelled
      const hours = parseFloat(input);
      if (isNaN(hours) || hours <= 0) {
        alert("Invalid duration. Please enter a valid number of hours.");
        return;
      }
      durationHours = hours;
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
    } catch (e) {
      console.error(e);
    }
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
      else alert((await res.json()).error);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="chat-area" style={{ padding: '20px', overflowY: 'auto' }}>
      <div className="chat-header">
        <h3>Admin Panel - User Management</h3>
      </div>
      <div className="admin-content" style={{ marginTop: '20px' }}>
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
                <td style={{ padding: '10px' }}>{u.username} {u.isGlobalAdmin && '(Admin)'}</td>
                <td style={{ padding: '10px' }}>{u.email}</td>
                <td style={{ padding: '10px' }}>
                  {u.globalBanType === 'PERMANENT' ? <span style={{ color: '#ff4d4f' }}>Permanently Banned</span>
                   : u.globalBanType === 'PARTIAL' ? (
                       <div style={{ color: '#faad14' }}>
                         Partially Banned<br/>
                         {u.globalBanUntil && <small>Until: {new Date(u.globalBanUntil).toLocaleString()}</small>}
                       </div>
                     )
                   : <span style={{ color: '#52c41a' }}>Active</span>}
                </td>
                <td style={{ padding: '10px' }}>
                  {!u.isGlobalAdmin && (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {u.globalBanType ? (
                        <button className="small-action" onClick={() => handleUnban(u.id)}>Unban</button>
                      ) : (
                        <>
                          <button className="small-action" style={{ background: '#faad14', color: 'black' }} onClick={() => handleBan(u.id, 'PARTIAL')}>Partial Ban</button>
                          <button className="small-action" style={{ background: '#ff4d4f' }} onClick={() => handleBan(u.id, 'PERMANENT')}>Perma Ban</button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
