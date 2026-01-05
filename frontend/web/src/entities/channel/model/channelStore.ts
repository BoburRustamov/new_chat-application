import { create } from 'zustand';
import type {
  Channel,
  ChannelSearchResult,
  ChannelInviteLink,
  CreateChannelRequest,
  UpdateChannelRequest,
  GenerateInviteLinkRequest,
  User,
} from '@/shared/types';
import { channelApi } from '@/shared/api/channelApi';

interface ChannelState {
  channels: Channel[];
  selectedChannelId: string | null;
  selectedChannel: Channel | null;
  searchResults: ChannelSearchResult[];
  popularChannels: ChannelSearchResult[];
  subscribers: Record<string, User[]>;
  admins: Record<string, User[]>;
  inviteLinks: Record<string, ChannelInviteLink | null>;
  canPost: Record<string, boolean>;
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;

  // Actions
  loadUserChannels: () => Promise<void>;
  selectChannel: (channelId: string | null) => void;
  loadChannel: (channelId: string) => Promise<Channel>;
  loadChannelByUsername: (username: string) => Promise<Channel | null>;

  // CRUD
  createChannel: (data: CreateChannelRequest) => Promise<Channel>;
  updateChannel: (id: string, data: UpdateChannelRequest) => Promise<Channel>;
  deleteChannel: (id: string) => Promise<void>;

  // Subscription
  subscribe: (channelId: string) => Promise<Channel>;
  unsubscribe: (channelId: string) => Promise<void>;

  // Discovery
  searchChannels: (query: string) => Promise<void>;
  loadPopularChannels: () => Promise<void>;

  // Admin management
  loadAdmins: (channelId: string) => Promise<void>;
  addAdmin: (channelId: string, userId: string) => Promise<void>;
  removeAdmin: (channelId: string, userId: string) => Promise<void>;

  // Subscribers
  loadSubscribers: (channelId: string, page?: number) => Promise<void>;

  // Invite links
  generateInviteLink: (channelId: string, options?: GenerateInviteLinkRequest) => Promise<ChannelInviteLink>;
  getInviteLink: (channelId: string) => Promise<ChannelInviteLink | null>;
  revokeInviteLink: (channelId: string) => Promise<void>;
  joinByInviteCode: (code: string) => Promise<Channel>;

  // Permissions
  checkCanPost: (channelId: string) => Promise<boolean>;

  // Internal
  updateSubscriberCount: (channelId: string, count: number) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: string) => void;
  clearSearch: () => void;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  selectedChannelId: null,
  selectedChannel: null,
  searchResults: [],
  popularChannels: [],
  subscribers: {},
  admins: {},
  inviteLinks: {},
  canPost: {},
  isLoading: false,
  isSearching: false,
  error: null,

  loadUserChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await channelApi.getUserChannels();
      set({ channels: response.data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load channels', isLoading: false });
      throw error;
    }
  },

  selectChannel: (channelId) => {
    const channel = channelId
      ? get().channels.find((c) => c.id === channelId) || null
      : null;
    set({ selectedChannelId: channelId, selectedChannel: channel });
  },

  loadChannel: async (channelId) => {
    set({ isLoading: true });
    try {
      const response = await channelApi.getChannel(channelId);
      const channel = response.data;

      set((state) => ({
        channels: state.channels.some((c) => c.id === channelId)
          ? state.channels.map((c) => (c.id === channelId ? channel : c))
          : [...state.channels, channel],
        selectedChannel:
          state.selectedChannelId === channelId ? channel : state.selectedChannel,
        isLoading: false,
      }));

      return channel;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loadChannelByUsername: async (username) => {
    set({ isLoading: true });
    try {
      const response = await channelApi.getChannelByUsername(username);
      const channel = response.data;

      set((state) => ({
        channels: state.channels.some((c) => c.id === channel.id)
          ? state.channels.map((c) => (c.id === channel.id ? channel : c))
          : [...state.channels, channel],
        isLoading: false,
      }));

      return channel;
    } catch {
      set({ isLoading: false });
      return null;
    }
  },

  createChannel: async (data) => {
    set({ isLoading: true });
    try {
      const response = await channelApi.createChannel(data);
      const channel = response.data;

      set((state) => ({
        channels: [channel, ...state.channels],
        isLoading: false,
      }));

      return channel;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  updateChannel: async (id, data) => {
    try {
      const response = await channelApi.updateChannel(id, data);
      const channel = response.data;

      set((state) => ({
        channels: state.channels.map((c) => (c.id === id ? channel : c)),
        selectedChannel:
          state.selectedChannelId === id ? channel : state.selectedChannel,
      }));

      return channel;
    } catch (error) {
      throw error;
    }
  },

  deleteChannel: async (id) => {
    try {
      await channelApi.deleteChannel(id);
      get().removeChannel(id);
    } catch (error) {
      throw error;
    }
  },

  subscribe: async (channelId) => {
    try {
      const response = await channelApi.subscribe(channelId);
      const channel = response.data;

      set((state) => ({
        channels: state.channels.some((c) => c.id === channelId)
          ? state.channels.map((c) => (c.id === channelId ? channel : c))
          : [channel, ...state.channels],
        selectedChannel:
          state.selectedChannelId === channelId ? channel : state.selectedChannel,
      }));

      return channel;
    } catch (error) {
      throw error;
    }
  },

  unsubscribe: async (channelId) => {
    try {
      await channelApi.unsubscribe(channelId);

      set((state) => ({
        channels: state.channels.filter((c) => c.id !== channelId),
        selectedChannelId:
          state.selectedChannelId === channelId ? null : state.selectedChannelId,
        selectedChannel:
          state.selectedChannelId === channelId ? null : state.selectedChannel,
      }));
    } catch (error) {
      throw error;
    }
  },

  searchChannels: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }

    set({ isSearching: true });
    try {
      const response = await channelApi.searchPublic(query);
      set({ searchResults: response.data, isSearching: false });
    } catch (error) {
      set({ isSearching: false });
      throw error;
    }
  },

  loadPopularChannels: async () => {
    set({ isLoading: true });
    try {
      const response = await channelApi.getPopular();
      set({ popularChannels: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loadAdmins: async (channelId) => {
    try {
      const response = await channelApi.getAdmins(channelId);
      set((state) => ({
        admins: { ...state.admins, [channelId]: response.data },
      }));
    } catch (error) {
      throw error;
    }
  },

  addAdmin: async (channelId, userId) => {
    try {
      await channelApi.addAdmin(channelId, userId);
      await get().loadAdmins(channelId);
    } catch (error) {
      throw error;
    }
  },

  removeAdmin: async (channelId, userId) => {
    try {
      await channelApi.removeAdmin(channelId, userId);
      set((state) => ({
        admins: {
          ...state.admins,
          [channelId]: (state.admins[channelId] || []).filter(
            (a) => a.id !== userId
          ),
        },
      }));
    } catch (error) {
      throw error;
    }
  },

  loadSubscribers: async (channelId, page = 1) => {
    try {
      const response = await channelApi.getSubscribers(channelId, page);
      set((state) => ({
        subscribers: {
          ...state.subscribers,
          [channelId]:
            page === 1
              ? response.data
              : [...(state.subscribers[channelId] || []), ...response.data],
        },
      }));
    } catch (error) {
      throw error;
    }
  },

  generateInviteLink: async (channelId, options) => {
    try {
      const response = await channelApi.generateInviteLink(channelId, options);
      const inviteLink = response.data;

      set((state) => ({
        inviteLinks: { ...state.inviteLinks, [channelId]: inviteLink },
      }));

      return inviteLink;
    } catch (error) {
      throw error;
    }
  },

  getInviteLink: async (channelId) => {
    try {
      const response = await channelApi.getInviteLink(channelId);
      const inviteLink = response.data;

      set((state) => ({
        inviteLinks: { ...state.inviteLinks, [channelId]: inviteLink },
      }));

      return inviteLink;
    } catch {
      set((state) => ({
        inviteLinks: { ...state.inviteLinks, [channelId]: null },
      }));
      return null;
    }
  },

  revokeInviteLink: async (channelId) => {
    try {
      await channelApi.revokeInviteLink(channelId);
      set((state) => ({
        inviteLinks: { ...state.inviteLinks, [channelId]: null },
      }));
    } catch (error) {
      throw error;
    }
  },

  joinByInviteCode: async (code) => {
    set({ isLoading: true });
    try {
      const response = await channelApi.joinByInviteCode(code);
      const channel = response.data;

      set((state) => ({
        channels: state.channels.some((c) => c.id === channel.id)
          ? state.channels.map((c) => (c.id === channel.id ? channel : c))
          : [channel, ...state.channels],
        isLoading: false,
      }));

      return channel;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  checkCanPost: async (channelId) => {
    try {
      const response = await channelApi.canPost(channelId);
      const canPost = response.data;

      set((state) => ({
        canPost: { ...state.canPost, [channelId]: canPost },
      }));

      return canPost;
    } catch {
      return false;
    }
  },

  updateSubscriberCount: (channelId, count) => {
    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === channelId ? { ...c, subscriberCount: count } : c
      ),
      selectedChannel:
        state.selectedChannel?.id === channelId
          ? { ...state.selectedChannel, subscriberCount: count }
          : state.selectedChannel,
    }));
  },

  addChannel: (channel) => {
    set((state) => ({
      channels: state.channels.some((c) => c.id === channel.id)
        ? state.channels.map((c) => (c.id === channel.id ? channel : c))
        : [channel, ...state.channels],
    }));
  },

  removeChannel: (channelId) => {
    set((state) => ({
      channels: state.channels.filter((c) => c.id !== channelId),
      selectedChannelId:
        state.selectedChannelId === channelId ? null : state.selectedChannelId,
      selectedChannel:
        state.selectedChannelId === channelId ? null : state.selectedChannel,
    }));
  },

  clearSearch: () => {
    set({ searchResults: [] });
  },
}));
