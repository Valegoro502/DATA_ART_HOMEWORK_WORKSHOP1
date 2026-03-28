import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { socketService } from '../lib/socket';

export default function ChatArea() {
  const { user, token } = useAuthStore();
  const { activeRoomId } = useChatStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeRoomId) return;

    fetch(`http://${window.location.hostname}:3000/api/rooms/${activeRoomId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
      });

    // We should listen to a chat specific event from socket here. For simplicity:
    // This requires backend emit something like io.to(roomId).emit('message:new', message)
  }, [activeRoomId, token]);

  // Auto-scroll logic could be here:
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInvite = async () => {
    const username = window.prompt("Enter the username to invite to this room:");
    if (!username) return;

    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/rooms/${activeRoomId}/invite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (res.ok) alert("User invited successfully!");
      else alert(data.error || "Failed to invite user");
    } catch (e) {
      console.error(e);
      alert("Network error");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeRoomId) return;

    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ roomId: activeRoomId, content: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages([...messages, data]);
        socketService.socket?.emit('chat:send', { roomId: activeRoomId, message: data });
        setText('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!activeRoomId) {
    return (
      <div className="chat-area empty-state">
        <div className="glass-panel help-text">
          Select a room or start a conversation
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area">
      <div className="chat-header glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Room Messages</h3>
        <button className="small-action" onClick={handleInvite}>Invite User</button>
      </div>
      
      <div className="chat-messages" ref={scrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.senderId === user?.id ? 'mine' : 'theirs'}`}>
            <div className="message-sender">{msg.sender.username}</div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
      </div>

      <div className="chat-input glass-panel">
        <form onSubmit={handleSend} style={{ display: 'flex', width: '100%', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Type a message..." 
            value={text} 
            onChange={e => setText(e.target.value)} 
            style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
