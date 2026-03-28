import { create } from 'zustand';

interface ChatState {
  activeRoomId: string | null;
  activeRecipientId: string | null;
  setActiveChat: (roomId: string | null, recipientId: string | null) => void;
  // This can be expanded to store messages in memory, but simple is often better:
  // We can just fetch them in the component and listen to socket there.
}

export const useChatStore = create<ChatState>((set) => ({
  activeRoomId: null,
  activeRecipientId: null,
  setActiveChat: (roomId, recipientId) => set({ activeRoomId: roomId, activeRecipientId: recipientId })
}));
