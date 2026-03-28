import { useAuthStore } from '../store/useAuthStore';
import { useState } from 'react';

export default function RoomMembersModal({ roomContext, onClose, onMemberRemoved }: { roomContext: any, onClose: () => void, onMemberRemoved: () => void }) {
  const { user, token } = useAuthStore();
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if current user is owner or global admin
  const isPrivileged = user?.isGlobalAdmin || roomContext?.ownerId === user?.id;

  const removeMember = async (targetUserId: string) => {
    if (!window.confirm("Are you sure you want to remove this member from the room?")) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/rooms/${roomContext.id}/remove-member`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ targetUserId })
      });
      if (res.ok) {
        alert("Member removed.");
        onMemberRemoved(); // trigger a re-fetch of room context in parent
      } else {
        alert((await res.json()).error);
      }
    } catch (e) {
      console.error(e);
    }
    setIsProcessing(false);
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000}}>
      <div className="glass-panel" style={{ width: '400px', padding: '20px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>{roomContext?.name} - Members</h3>
          <button style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px' }} onClick={onClose}>✕</button>
        </div>
        
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {roomContext?.members?.map((m: any) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <span style={{ fontWeight: roomContext.ownerId === m.user.id ? 'bold' : 'normal' }}>
                  {m.user.username} {roomContext.ownerId === m.user.id ? '(Owner)' : ''}
                </span>
              </div>
              
              {isPrivileged && m.user.id !== roomContext.ownerId && m.user.id !== user?.id && (
                <button 
                  className="small-action" 
                  style={{ padding: '2px 8px', background: '#ff4d4f', fontSize: '10px' }} 
                  onClick={() => removeMember(m.user.id)}
                  disabled={isProcessing}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {(!roomContext?.members || roomContext.members.length === 0) && (
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>No members found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
