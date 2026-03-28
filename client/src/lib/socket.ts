import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';

// In Docker setup, backend is at server:3000 but from browser we'll proxy or just connect directly?
// Actually if they hit localhost:80, we can proxy /api and /socket.io in dev,
// but let's just use window.location.hostname for the socket connection if we expose port 3000
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3000`;

class SocketService {
  public socket: Socket | null = null;
  private pingInterval: number | null = null;

  connect() {
    if (this.socket?.connected) return;

    const token = useAuthStore.getState().token;
    if (!token) return;

    this.socket = io(SOCKET_URL, {
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('Connected to WS');
      this.startHeartbeat();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WS');
      this.stopHeartbeat();
    });

    // Handle user presence updates
    this.socket.on('user:presence', ({ userId, status }) => {
      // Dispatch to store or event bus
      window.dispatchEvent(new CustomEvent('presence-update', { detail: { userId, status } }));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    
    // AFK logic
    let isAFK = false;
    let idleTimer: number;

    const resetIdle = () => {
      isAFK = false;
      this.socket?.emit('presence:ping', 'active');
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        isAFK = true;
        this.socket?.emit('presence:ping', 'afk');
      }, 60000); // 1 minute AFK
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('click', resetIdle);
    resetIdle();

    this.pingInterval = window.setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('presence:ping', isAFK ? 'afk' : 'active');
      }
    }, 30000);

    // store cleanup handlers logic here would be clean
  }

  private stopHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }
}

export const socketService = new SocketService();
