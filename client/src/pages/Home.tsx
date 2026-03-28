import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { socketService } from '../lib/socket';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    socketService.connect();

    return () => {
      // Don't disconnect on unmount of home necessarily, but good for cleanup
      // socketService.disconnect();
    };
  }, [token, navigate]);

  if (!user) return null;

  return (
    <div className="home-layout">
      <Sidebar />
      <ChatArea />
    </div>
  );
}
