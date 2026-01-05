import { apiClient } from './client';
import type {
  Channel,
  ChannelSearchResult,
  ChannelInviteLink,
  CreateChannelRequest,
  UpdateChannelRequest,
  GenerateInviteLinkRequest,
  User,
} from '../types';

export const channelApi = {
  // Get user's subscribed channels
  getUserChannels: () => apiClient.get<Channel[]>('/channels'),

  // Get channel by ID
  getChannel: (id: string) => apiClient.get<Channel>(`/channels/${id}`),

  // Get channel by username
  getChannelByUsername: (username: string) =>
    apiClient.get<Channel>(`/channels/username/${username}`),

  // Create a new channel
  createChannel: (data: CreateChannelRequest) =>
    apiClient.post<Channel>('/channels', data),

  // Update a channel
  updateChannel: (id: string, data: UpdateChannelRequest) =>
    apiClient.put<Channel>(`/channels/${id}`, data),

  // Delete a channel
  deleteChannel: (id: string) => apiClient.delete(`/channels/${id}`),

  // Subscribe to a channel
  subscribe: (id: string) => apiClient.post<Channel>(`/channels/${id}/subscribe`),

  // Unsubscribe from a channel
  unsubscribe: (id: string) => apiClient.delete(`/channels/${id}/subscribe`),

  // Get subscribers of a channel
  getSubscribers: (id: string, page = 1, pageSize = 50) =>
    apiClient.get<User[]>(`/channels/${id}/subscribers`, {
      params: { page, pageSize },
    }),

  // Add an admin
  addAdmin: (channelId: string, userId: string) =>
    apiClient.post(`/channels/${channelId}/admins/${userId}`),

  // Remove an admin
  removeAdmin: (channelId: string, userId: string) =>
    apiClient.delete(`/channels/${channelId}/admins/${userId}`),

  // Get all admins
  getAdmins: (channelId: string) =>
    apiClient.get<User[]>(`/channels/${channelId}/admins`),

  // Search public channels
  searchPublic: (query: string, page = 1, pageSize = 20) =>
    apiClient.get<ChannelSearchResult[]>('/channels/search', {
      params: { query, page, pageSize },
    }),

  // Get popular channels
  getPopular: (count = 20) =>
    apiClient.get<ChannelSearchResult[]>('/channels/popular', {
      params: { count },
    }),

  // Generate invite link
  generateInviteLink: (id: string, options?: GenerateInviteLinkRequest) =>
    apiClient.post<ChannelInviteLink>(`/channels/${id}/invite`, options || {}),

  // Get current invite link
  getInviteLink: (id: string) =>
    apiClient.get<ChannelInviteLink>(`/channels/${id}/invite`),

  // Revoke invite link
  revokeInviteLink: (id: string) => apiClient.delete(`/channels/${id}/invite`),

  // Join by invite code
  joinByInviteCode: (code: string) =>
    apiClient.post<Channel>(`/channels/join/${code}`),

  // Check if user can post
  canPost: (id: string) => apiClient.get<boolean>(`/channels/${id}/can-post`),
};
