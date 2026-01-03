import { create } from 'zustand';
import type { Chat, Message, PagedResponse, TypingEvent, SendMessageRequest } from '@/shared/types';
import { apiClient } from '@/shared/api/client';
import { signalRService } from '@/shared/api/signalr';

interface ChatState {
  chats: Chat[];
  selectedChatId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, TypingEvent[]>;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  error: string | null;

  // Actions
  loadChats: () => Promise<void>;
  selectChat: (chatId: string | null) => void;
  loadMessages: (chatId: string, page?: number) => Promise<void>;
  sendMessage: (request: SendMessageRequest) => Promise<void>;
  createPrivateChat: (userId: string) => Promise<Chat>;
  createGroupChat: (name: string, description: string | undefined, memberIds: string[]) => Promise<Chat>;

  // Real-time actions
  connectSignalR: () => Promise<void>;
  disconnectSignalR: () => Promise<void>;
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  markAsRead: (chatId: string, messageId?: string) => void;

  // Chat management
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  leaveChat: (chatId: string) => Promise<void>;
  removeChat: (chatId: string) => void;

  // Internal actions
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  setTypingUser: (event: TypingEvent) => void;
  removeTypingUser: (event: TypingEvent) => void;
  updateUserStatus: (userId: string, isOnline: boolean, lastSeenAt?: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  selectedChatId: null,
  messages: {},
  typingUsers: {},
  isLoadingChats: false,
  isLoadingMessages: false,
  connectionStatus: 'disconnected',
  error: null,

  loadChats: async () => {
    set({ isLoadingChats: true, error: null });
    try {
      const response = await apiClient.get<Chat[]>('/chats');
      set({ chats: response.data, isLoadingChats: false });
    } catch (error) {
      set({ error: 'Failed to load chats', isLoadingChats: false });
      throw error;
    }
  },

  selectChat: (chatId) => {
    set({ selectedChatId: chatId });
    if (chatId) {
      const state = get();
      if (!state.messages[chatId]) {
        state.loadMessages(chatId);
      }
      signalRService.joinChat(chatId);
    }
  },

  loadMessages: async (chatId, page = 1) => {
    set({ isLoadingMessages: true });
    try {
      const response = await apiClient.get<PagedResponse<Message>>(`/messages/chat/${chatId}?page=${page}`);
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: page === 1
            ? response.data.items
            : [...(state.messages[chatId] || []), ...response.data.items],
        },
        isLoadingMessages: false,
      }));
    } catch (error) {
      set({ isLoadingMessages: false });
      throw error;
    }
  },

  sendMessage: async (request) => {
    try {
      await signalRService.sendMessage(request);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  },

  createPrivateChat: async (userId) => {
    const response = await apiClient.post<Chat>('/chats/private', { otherUserId: userId });
    const chat = response.data;
    set((state) => ({
      chats: [chat, ...state.chats.filter((c) => c.id !== chat.id)],
    }));
    return chat;
  },

  createGroupChat: async (name, description, memberIds) => {
    const response = await apiClient.post<Chat>('/chats/group', { name, description, memberIds });
    const chat = response.data;
    set((state) => ({
      chats: [chat, ...state.chats],
    }));
    return chat;
  },

  connectSignalR: async () => {
    set({ connectionStatus: 'connecting' });
    try {
      // Set up event handlers before connecting
      signalRService.onMessage((message) => {
        get().addMessage(message);
      });

      signalRService.onMessageEdited((message) => {
        get().updateMessage(message);
      });

      signalRService.onMessageDeleted((event) => {
        get().removeMessage(event.chatId, event.messageId);
      });

      signalRService.onTyping((event) => {
        get().setTypingUser(event);
      });

      signalRService.onStoppedTyping((event) => {
        get().removeTypingUser(event);
      });

      signalRService.onUserStatusChanged((event) => {
        get().updateUserStatus(event.userId, event.isOnline, event.lastSeenAt);
      });

      // Reaction events - update the message with new reaction data
      signalRService.onReactionAdded((message) => {
        get().updateMessage(message);
      });

      signalRService.onReactionRemoved((message) => {
        get().updateMessage(message);
      });

      // Pin events - update the message's isPinned status
      signalRService.onMessagePinned((message) => {
        get().updateMessage(message);
      });

      signalRService.onMessageUnpinned((message) => {
        get().updateMessage(message);
      });

      // Forward event - message is already added via ReceiveMessage for target chat
      // This event is sent to the caller as confirmation
      signalRService.onMessageForwarded((message) => {
        // Optionally show a toast or update UI to confirm forward succeeded
        console.log('Message forwarded successfully:', message.id);
      });

      signalRService.onConnected(() => {
        set({ connectionStatus: 'connected' });
      });

      signalRService.onDisconnected(() => {
        set({ connectionStatus: 'disconnected' });
      });

      signalRService.onReconnecting(() => {
        set({ connectionStatus: 'reconnecting' });
      });

      await signalRService.start();
      set({ connectionStatus: 'connected' });
    } catch (error) {
      set({ connectionStatus: 'disconnected', error: 'Failed to connect to chat' });
      throw error;
    }
  },

  disconnectSignalR: async () => {
    await signalRService.stop();
    set({ connectionStatus: 'disconnected' });
  },

  startTyping: (chatId) => {
    signalRService.startTyping(chatId);
  },

  stopTyping: (chatId) => {
    signalRService.stopTyping(chatId);
  },

  markAsRead: (chatId, messageId) => {
    signalRService.markAsRead(chatId, messageId);
    // Update local unread count
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      ),
    }));
  },

  updateChat: (chatId, updates) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, ...updates } : chat
      ),
    }));
  },

  leaveChat: async (chatId) => {
    await apiClient.delete(`/chats/${chatId}/leave`);
    get().removeChat(chatId);
  },

  removeChat: (chatId) => {
    set((state) => {
      const newChats = state.chats.filter((chat) => chat.id !== chatId);
      const newMessages = { ...state.messages };
      delete newMessages[chatId];
      return {
        chats: newChats,
        messages: newMessages,
        selectedChatId: state.selectedChatId === chatId ? null : state.selectedChatId,
      };
    });
  },

  addMessage: (message) => {
    set((state) => {
      const chatMessages = state.messages[message.chatId] || [];
      // Check if message already exists
      if (chatMessages.some((m) => m.id === message.id)) {
        return state;
      }

      // Update chat's last message and move to top
      const updatedChats = state.chats.map((chat) =>
        chat.id === message.chatId
          ? { ...chat, lastMessage: message, updatedAt: message.createdAt }
          : chat
      );
      // Sort chats by last message time
      updatedChats.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.updatedAt;
        const bTime = b.lastMessage?.createdAt || b.updatedAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      return {
        messages: {
          ...state.messages,
          [message.chatId]: [...chatMessages, message],
        },
        chats: updatedChats,
      };
    });
  },

  updateMessage: (message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [message.chatId]: (state.messages[message.chatId] || []).map((m) =>
          m.id === message.id ? message : m
        ),
      },
    }));
  },

  removeMessage: (chatId, messageId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, content: undefined } : m
        ),
      },
    }));
  },

  setTypingUser: (event) => {
    set((state) => {
      const chatTyping = state.typingUsers[event.chatId] || [];
      if (chatTyping.some((t) => t.userId === event.userId)) {
        return state;
      }
      return {
        typingUsers: {
          ...state.typingUsers,
          [event.chatId]: [...chatTyping, event],
        },
      };
    });
  },

  removeTypingUser: (event) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [event.chatId]: (state.typingUsers[event.chatId] || []).filter(
          (t) => t.userId !== event.userId
        ),
      },
    }));
  },

  updateUserStatus: (userId, isOnline, lastSeenAt) => {
    set((state) => ({
      chats: state.chats.map((chat) => ({
        ...chat,
        members: chat.members.map((member) =>
          member.userId === userId
            ? { ...member, isOnline, lastSeenAt: lastSeenAt || member.lastSeenAt }
            : member
        ),
      })),
    }));
  },
}));
