import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function FriendsModal({ onClose }: { onClose: () => void }) {
  const { token, user } = useAuthStore();
  const [tab, setTab] = useState<'FRIENDS' | 'REQUESTS' | 'SEARCH' | 'BLOCKED'>('FRIENDS');
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [requestMessage, setRequestMessage] = useState('');

  const fetchFriends = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/users/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setFriends(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/users/pending-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setRequests(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchBlockedUsers = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/users/blocked`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setBlockedUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/users?search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setSearchResults(await res.json());
    } catch (e) { console.error(e); }
  };

  const sendRequest = async (id: string) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/users/${id}/friend-request`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ message: requestMessage })
      });
      if (res.ok) {
        alert('Request sent!');
        setRequestMessage('');
      } else {
        alert((await res.json()).error);
      }
    } catch (e) { console.error(e); }
  };

  const acceptRequest = async (id: string) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/users/${id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Friend added!');
        fetchRequests();
      } else {
        alert((await res.json()).error);
      }
    } catch (e) { console.error(e); }
  };

  const removeOrCancel = async (id: string) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/users/friends/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchFriends();
        fetchRequests();
      }
    } catch (e) { console.error(e); }
  };

  const blockUser = async (id: string) => {
    if (!window.confirm("Are you sure you want to block this user privately?")) return;
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/users/${id}/block`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('User has been blocked.');
        fetchFriends();
        fetchBlockedUsers();
      } else {
        alert((await res.json()).error);
      }
    } catch (e) { console.error(e); }
  };

  const unblockUser = async (id: string) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/users/${id}/unblock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('User has been unblocked.');
        fetchBlockedUsers();
      } else {
        alert((await res.json()).error);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (tab === 'FRIENDS') fetchFriends();
    if (tab === 'REQUESTS') fetchRequests();
    if (tab === 'BLOCKED') fetchBlockedUsers();
  }, [tab]);

  return createPortal(
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000}}>
      <div className="glass-panel" style={{ width: '400px', padding: '20px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Contacts & Friends</h3>
          <button style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px' }} onClick={onClose}>✕</button>
        </div>
        
        <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <button className="small-action" style={{ flex: '1 1 40%', opacity: tab === 'FRIENDS' ? 1 : 0.5 }} onClick={() => setTab('FRIENDS')}>Friends</button>
          <button className="small-action" style={{ flex: '1 1 40%', opacity: tab === 'REQUESTS' ? 1 : 0.5 }} onClick={() => setTab('REQUESTS')}>Requests</button>
          <button className="small-action" style={{ flex: '1 1 40%', opacity: tab === 'SEARCH' ? 1 : 0.5 }} onClick={() => setTab('SEARCH')}>Search</button>
          <button className="small-action" style={{ flex: '1 1 40%', opacity: tab === 'BLOCKED' ? 1 : 0.5 }} onClick={() => setTab('BLOCKED')}>Blocked</button>
        </div>

        {tab === 'FRIENDS' && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {friends.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.5)' }}>No friends to display.</p> : null}
            {friends.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span>{f.username}</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button className="small-action" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => removeOrCancel(f.id)}>Remove</button>
                  <button className="small-action" style={{ padding: '2px 8px', background: '#ff4d4f', fontSize: '10px' }} onClick={() => blockUser(f.id)}>Block</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'REQUESTS' && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {requests.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.5)' }}>No pending requests.</p> : null}
            {requests.map(r => (
              <div key={r.id} style={{ display: 'flex', flexDirection: 'column', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <strong>{r.username}</strong>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button className="small-action" style={{ padding: '2px 8px', background: '#52c41a', fontSize: '10px' }} onClick={() => acceptRequest(r.id)}>Accept</button>
                    <button className="small-action" style={{ padding: '2px 8px', background: '#ff4d4f', fontSize: '10px' }} onClick={() => removeOrCancel(r.id)}>Reject</button>
                  </div>
                </div>
                {r.message && <div style={{ fontSize: '11px', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', padding: '5px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>"{r.message}"</div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'SEARCH' && (
          <div>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
              <input 
                type="text" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search username..." 
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none' }}
              />
              <button type="submit" className="small-action">Search</button>
            </form>
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {searchResults.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.5)' }}>No results.</p> : null}
              {searchResults.map(s => (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <span>{s.username}</span>
                    <button className="small-action" style={{ padding: '2px 8px', background: '#0066cc', fontSize: '10px' }} onClick={() => sendRequest(s.id)}>Send Request</button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Optional message..." 
                    value={requestMessage} 
                    onChange={e => setRequestMessage(e.target.value)} 
                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', color: 'white' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'BLOCKED' && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {blockedUsers.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.5)' }}>No blocked users.</p> : null}
            {blockedUsers.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span>{b.username}</span>
                <button className="small-action" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => unblockUser(b.id)}>Unblock</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
