import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { socketService } from '../lib/socket';

export default function ChatArea() {
  const { user, token } = useAuthStore();
  const { activeRoomId } = useChatStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!text.trim() && !attachment) || !activeRoomId || isUploading) return;

    try {
      let attachmentUrl = null;
      let attachmentName = null;

      if (attachment) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', attachment);

        const uploadRes = await fetch(`http://${window.location.hostname}:3000/api/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const uploadData = await uploadRes.json();
        setIsUploading(false);

        if (!uploadRes.ok) {
          alert(uploadData.error || 'Failed to upload file');
          return;
        }

        attachmentUrl = uploadData.url;
        attachmentName = uploadData.filename;
      }

      const res = await fetch(`http://${window.location.hostname}:3000/api/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          roomId: activeRoomId, 
          content: text.trim() ? text : null,
          attachmentUrl,
          attachmentName
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages([...messages, data]);
        socketService.socket?.emit('chat:send', { roomId: activeRoomId, message: data });
        setText('');
        setAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (e) {
      console.error(e);
      setIsUploading(false);
    }
  };

  const renderAttachment = (url?: string, name?: string) => {
    if (!url) return null;
    const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
    const isVideo = url.match(/\.(mp4|webm|ogg)$/i);
    
    // Convert relative URL from backend to absolute for loading if necessary
    const fullUrl = `http://${window.location.hostname}:3000${url}`;

    if (isImage) {
      return <img src={fullUrl} alt={name} style={{ maxWidth: '250px', maxHeight: '250px', display: 'block', marginTop: '5px', borderRadius: '4px', objectFit: 'contain' }} />;
    }
    if (isVideo) {
      return <video src={fullUrl} controls style={{ maxWidth: '300px', display: 'block', marginTop: '5px', borderRadius: '4px' }} />;
    }
    return (
      <div style={{ marginTop: '5px' }}>
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" download={name} style={{ color: '#6be', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
          📎 {name || 'Download File'}
        </a>
      </div>
    );
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
            {msg.content && <div className="message-content">{msg.content}</div>}
            {renderAttachment(msg.attachmentUrl, msg.attachmentName)}
          </div>
        ))}
      </div>

      <div className="chat-input glass-panel" style={{ flexShrink: 0 }}>
        {attachment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '5px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
            <span style={{ fontSize: '14px' }}>📎 {attachment.name}</span>
            <button type="button" onClick={() => setAttachment(null)} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: '0 5px' }}>✕</button>
          </div>
        )}
        <form onSubmit={handleSend} style={{ display: 'flex', width: '100%', gap: '10px', alignItems: 'center' }}>
          <button 
            type="button" 
            className="small-action" 
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            📎
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => setAttachment(e.target.files?.[0] || null)} 
            style={{ display: 'none' }} 
          />
          <input 
            type="text" 
            placeholder="Type a message..." 
            value={text} 
            onChange={e => setText(e.target.value)} 
            disabled={isUploading}
            style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }}
          />
          <button type="submit" disabled={isUploading || (!text.trim() && !attachment)}>
            {isUploading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
