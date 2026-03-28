import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';

interface Session {
  id: string;
  ipAddress: string;
  browserFingerprint: string;
  lastActive: string;
  isCurrent: boolean;
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { token, user, logout } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'SESSIONS' | 'PASSWORD' | 'ACCOUNT'>('SESSIONS');

  const fetchSessions = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/auth/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setSessions(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchSessions();
  }, [token]);

  const handleRevokeSession = async (id: string) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/auth/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchSessions();
    } catch (e) { console.error(e); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return alert("Passwords do not match");
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Password changed successfully");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert(data.error);
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("ARE YOU ABSOLUTELY SURE? This will permanently delete your account, all rooms you own, and all your data. This action cannot be undone.")) return;
    
    const doubleCheck = window.prompt("Type 'DELETE' to confirm account deletion:");
    if (doubleCheck !== 'DELETE') return;

    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/auth/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Your account has been deleted.");
        logout();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <h2>User Settings</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
          <button onClick={() => setActiveTab('SESSIONS')} className={`small-action ${activeTab === 'SESSIONS' ? 'active' : ''}`} style={{ flex: 1 }}>Sessions</button>
          <button onClick={() => setActiveTab('PASSWORD')} className={`small-action ${activeTab === 'PASSWORD' ? 'active' : ''}`} style={{ flex: 1 }}>Password</button>
          {!user?.isGlobalAdmin && (
            <button onClick={() => setActiveTab('ACCOUNT')} className={`small-action ${activeTab === 'ACCOUNT' ? 'active' : ''}`} style={{ flex: 1, background: activeTab === 'ACCOUNT' ? '#ff4d4f' : 'transparent' }}>Account</button>
          )}
        </div>

        <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {activeTab === 'SESSIONS' && (
            <div>
              <p style={{ fontSize: '14px', color: '#999', marginBottom: '15px' }}>Manage your active login sessions across different devices and browsers.</p>
              {sessions.map(s => (
                <div key={s.id} style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginBottom: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: s.isCurrent ? '1px solid #1890ff' : 'none'
                }}>
                  <div style={{ fontSize: '13px' }}>
                    <div style={{ fontWeight: 'bold' }}>{s.browserFingerprint} {s.isCurrent && '(This Session)'}</div>
                    <div style={{ color: '#999' }}>IP: {s.ipAddress}</div>
                    <div style={{ color: '#999' }}>Last active: {new Date(s.lastActive).toLocaleString()}</div>
                  </div>
                  {!s.isCurrent && (
                    <button onClick={() => handleRevokeSession(s.id)} className="small-action" style={{ background: '#ff4d4f' }}>Revoke</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'PASSWORD' && (
            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Current Password</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
              </div>
              <button type="submit" className="small-action" style={{ width: '100%', padding: '12px' }}>Update Password</button>
            </form>
          )}

          {activeTab === 'ACCOUNT' && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ color: '#ff4d4f', fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>Danger Zone</div>
              <p style={{ marginBottom: '20px', color: '#ccc' }}>Once you delete your account, there is no going back. All your owned rooms and associated message history will be purged.</p>
              <button onClick={handleDeleteAccount} className="small-action" style={{ background: '#ff4d4f', padding: '12px 30px', fontSize: '16px' }}>Delete My Account</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
