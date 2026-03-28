import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { socketService } from '../lib/socket';
import RoomMembersModal from './RoomMembersModal';

export default function ChatArea() {
  const { user, token } = useAuthStore();
  const { activeRoomId, activeRecipientId } = useChatStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [roomContext, setRoomContext] = useState<any>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRoomContext = async () => {
    if (!activeRoomId) return;
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/rooms/${activeRoomId}/context`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setRoomContext(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setRoomContext(null);
    setIsBlocked(false);
    setMessages([]);
    setHasMore(false);
    setReplyTo(null);
    if (activeRoomId) {
      fetch(`http://${window.location.hostname}:3000/api/rooms/${activeRoomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(data);
            setHasMore(data.length >= 50);
          }
        });
        
      fetchRoomContext();
    } else if (activeRecipientId) {
      fetch(`http://${window.location.hostname}:3000/api/users/${activeRecipientId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data.messages && Array.isArray(data.messages)) {
            setMessages(data.messages);
            setIsBlocked(data.isBlocked);
            setHasMore(data.messages.length >= 50);
          }
        });
    }
  }, [activeRoomId, activeRecipientId, token]);

  // Smart Auto-scroll
  useEffect(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // threshold: 100px from bottom
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    if (isNearBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Infinite scroll: load older messages when scrolled to top
  const handleScroll = async () => {
    if (!scrollRef.current || isLoadingMore || !hasMore || messages.length === 0) return;
    if (scrollRef.current.scrollTop > 50) return; // only near top

    const oldestId = messages[0]?.id;
    if (!oldestId) return;

    setIsLoadingMore(true);
    const prevHeight = scrollRef.current.scrollHeight;

    try {
      let url = '';
      if (activeRoomId) {
        url = `http://${window.location.hostname}:3000/api/rooms/${activeRoomId}/messages?cursor=${oldestId}&limit=50`;
      } else if (activeRecipientId) {
        url = `http://${window.location.hostname}:3000/api/users/${activeRecipientId}/messages?cursor=${oldestId}&limit=50`;
      }
      if (!url) return;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const older = activeRoomId ? data : data.messages;

      if (Array.isArray(older) && older.length > 0) {
        setMessages(prev => [...older, ...prev]);
        setHasMore(older.length >= 50);
        // Restore scroll position after prepend
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight;
          }
        });
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoadingMore(false);
  };

  // Listen for real-time new messages via socket
  useEffect(() => {
    const socket = socketService.socket;
    if (!socket) return;

    const handleNewMessage = (message: any) => {
      // Only add if it belongs to the current active chat
      const isCurrentRoom = activeRoomId && message.roomId === activeRoomId;
      const isCurrentDM = activeRecipientId && !message.roomId && (
        message.senderId === activeRecipientId || message.recipientId === activeRecipientId
      );
      if (isCurrentRoom || isCurrentDM) {
        setMessages(prev => {
          // Deduplicate: don't add if we already have this ID
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    };

    socket.on('message:new', handleNewMessage);
    return () => { socket.off('message:new', handleNewMessage); };
  }, [activeRoomId, activeRecipientId]);

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
    if ((!text.trim() && !attachment) || (!activeRoomId && !activeRecipientId) || isUploading) return;

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

      // Build body - omit null fields so Zod doesn't reject them
      const body: Record<string, any> = {};
      if (activeRoomId) body.roomId = activeRoomId;
      if (activeRecipientId) body.recipientId = activeRecipientId;
      if (text.trim()) body.content = text.trim();
      if (attachmentUrl) body.attachmentUrl = attachmentUrl;
      if (attachmentName) body.attachmentName = attachmentName;
      if (replyTo) body.replyToId = replyTo.id;

      const res = await fetch(`http://${window.location.hostname}:3000/api/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setIsUploading(false);
      if (res.ok) {
        // Do NOT add message here - the socket 'message:new' event will handle it
        // for both the sender and all other participants.
        setText('');
        setAttachment(null);
        setReplyTo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        const errMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data);
        alert('Send error: ' + errMsg);
      }
    } catch (e) {
      console.error(e);
      setIsUploading(false);
      alert('Network error — could not send message');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh messages or optimistically remove/update it
        if (data.message === 'Message softly deleted') {
          setMessages(messages.map(m => m.id === messageId ? { ...m, content: "An administrator has deleted this message.", attachmentUrl: null, attachmentName: null } : m));
        } else {
          setMessages(messages.filter(m => m.id !== messageId));
        }
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm("CRITICAL WARNING: Are you sure you want to completely delete this room? This action cannot be undone.")) return;
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/rooms/${activeRoomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Room deleted. Please refresh the page.");
        window.location.reload();
      } else {
        alert((await res.json()).error);
      }
    } catch (e) {
      console.error(e);
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

  if (!activeRoomId && !activeRecipientId) {
    return (
      <div className="chat-area empty-state">
        <div className="glass-panel help-text">
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>💬</div>
          <h2>Welcome to DataArt Chat</h2>
          <p style={{ marginTop: '10px', fontSize: '14px', opacity: 0.8 }}>
            Select a room from the sidebar or explore public rooms to start messaging!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area">
      <div className="chat-header glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{activeRoomId ? `Room Messages: ${roomContext?.name || ''}` : 'Private Conversation'}</h3>
        {activeRoomId && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="small-action" onClick={() => setShowMembers(true)}>Members</button>
            <button className="small-action" onClick={handleInvite}>Invite User</button>
            {(user?.isGlobalAdmin || roomContext?.ownerId === user?.id) && (
              <button className="small-action" style={{ background: '#ff4d4f' }} onClick={handleDeleteRoom}>Delete Room</button>
            )}
          </div>
        )}
      </div>
      
      <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
        {isLoadingMore && (
          <div style={{ textAlign: 'center', padding: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Loading older messages...</div>
        )}
        {hasMore && !isLoadingMore && messages.length > 0 && (
          <div style={{ textAlign: 'center', padding: '8px', color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>↑ Scroll up for older messages</div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.senderId === user?.id ? 'mine' : 'theirs'}`}>
            <div className="message-sender" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{msg.sender.username}</span>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                {!isBlocked && (
                  <button
                    onClick={() => setReplyTo(msg)}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '11px', padding: '0 4px' }}
                    title="Reply"
                  >↩</button>
                )}
                {(user?.isGlobalAdmin || roomContext?.ownerId === user?.id || msg.senderId === user?.id) && (
                  <button 
                    onClick={() => handleDeleteMessage(msg.id)}
                    style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '12px', padding: '0 5px' }}
                    title="Delete Message"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            {msg.replyTo && (
              <div style={{ borderLeft: '3px solid rgba(255,255,255,0.3)', paddingLeft: '8px', marginBottom: '4px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontStyle: 'italic' }}>
                <strong>@{msg.replyTo.sender?.username}:</strong> {msg.replyTo.content?.substring(0, 80)}{(msg.replyTo.content?.length ?? 0) > 80 ? '...' : ''}
              </div>
            )}
            {msg.content && <div className="message-content" style={{ fontStyle: msg.content === "An administrator has deleted this message." ? 'italic' : 'normal', color: msg.content === "An administrator has deleted this message." ? '#ff4d4f' : 'inherit' }}>{msg.content}</div>}
            {renderAttachment(msg.attachmentUrl, msg.attachmentName)}
          </div>
        ))}
      </div>

      <div className="chat-input glass-panel" style={{ flexShrink: 0 }}>
        {replyTo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '6px 10px', background: 'rgba(255,255,255,0.06)', borderLeft: '3px solid #6be', borderRadius: '4px' }}>
            <div style={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
              <strong>Replying to @{replyTo.sender?.username}:</strong> {replyTo.content?.substring(0, 60) || '📎 Attachment'}{(replyTo.content?.length ?? 0) > 60 ? '...' : ''}
            </div>
            <button type="button" onClick={() => setReplyTo(null)} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: '0 5px' }}>✕</button>
          </div>
        )}
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
            placeholder={isBlocked ? "You cannot reply to this conversation" : "Type a message..."} 
            value={text} 
            onChange={e => setText(e.target.value)} 
            disabled={isUploading || isBlocked}
            style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #333', background: isBlocked ? '#111' : '#222', color: isBlocked ? '#555' : '#fff' }}
          />
          <button type="submit" disabled={isUploading || isBlocked || (!text.trim() && !attachment)}>
            {isUploading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>

      {showMembers && roomContext && (
        <RoomMembersModal 
          roomContext={roomContext} 
          onClose={() => setShowMembers(false)}
          onMemberRemoved={fetchRoomContext}
        />
      )}
    </div>
  );
}
