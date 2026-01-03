import { useState, useRef, useEffect } from 'react';
import { X, Camera, Loader2, BellOff, Bell, UserMinus, LogOut, Trash2, Edit3, Users, UserPlus, Search } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useChatStore } from '@/entities/chat/model/chatStore';
import { useAuthStore } from '@/entities/user/model/authStore';
import { apiClient } from '@/shared/api/client';
import type { Chat, FileInfo, User, PagedResponse } from '@/shared/types';

interface ChatSettingsModalProps {
  chat: Chat;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'general' | 'members' | 'danger';

export function ChatSettingsModal({ chat, isOpen, onClose }: ChatSettingsModalProps) {
  const { user } = useAuthStore();
  const { updateChat, leaveChat } = useChatStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [chatName, setChatName] = useState(chat.name || '');
  const [chatDescription, setChatDescription] = useState(chat.description || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(chat.avatarUrl || null);
  const [pendingAvatar, setPendingAvatar] = useState<FileInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  const isAdmin = chat.members.find(m => m.userId === user?.id)?.role === 'Admin';
  const isOwner = chat.members.find(m => m.userId === user?.id)?.role === 'Owner';
  const canEdit = chat.type === 'Group' && (isAdmin || isOwner);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setChatName(chat.name || '');
      setChatDescription(chat.description || '');
      setAvatarPreview(chat.avatarUrl || null);
      setActiveTab('general');
      setError(null);
      setShowAddMember(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, chat]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    setIsLoading(true);
    try {
      const response = await apiClient.uploadFile<FileInfo>('/files/upload', file);
      setPendingAvatar(response.data);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      setError('Failed to upload avatar');
      setAvatarPreview(chat.avatarUrl || null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!canEdit) return;

    setIsSaving(true);
    setError(null);

    try {
      await apiClient.put(`/chats/${chat.id}`, {
        name: chatName,
        description: chatDescription,
        avatarFileId: pendingAvatar?.id,
      });

      updateChat(chat.id, {
        name: chatName,
        avatarUrl: pendingAvatar?.downloadUrl || chat.avatarUrl,
      });

      onClose();
    } catch (err) {
      console.error('Failed to update chat settings:', err);
      setError('Failed to update chat settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMute = async () => {
    setIsLoading(true);
    try {
      await apiClient.post(`/chats/${chat.id}/mute`, { muted: !isMuted });
      setIsMuted(!isMuted);
    } catch (err) {
      console.error('Failed to toggle mute:', err);
      setError('Failed to update notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveChat = async () => {
    if (!confirm('Are you sure you want to leave this chat?')) return;

    setIsLoading(true);
    try {
      await leaveChat(chat.id);
      onClose();
    } catch (err) {
      console.error('Failed to leave chat:', err);
      setError('Failed to leave chat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) return;

    setIsLoading(true);
    try {
      await apiClient.delete(`/chats/${chat.id}`);
      onClose();
    } catch (err) {
      console.error('Failed to delete chat:', err);
      setError('Failed to delete chat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    setIsLoading(true);
    try {
      await apiClient.delete(`/chats/${chat.id}/members/${memberId}`);
      updateChat(chat.id, {
        members: chat.members.filter(m => m.userId !== memberId),
      });
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError('Failed to remove member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiClient.get<PagedResponse<User>>(`/users/search?query=${encodeURIComponent(query)}`);
      // Filter out users who are already members
      const existingMemberIds = new Set(chat.members.map(m => m.userId));
      const filteredResults = response.data.items.filter(u => !existingMemberIds.has(u.id));
      setSearchResults(filteredResults);
    } catch (err) {
      console.error('Failed to search users:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    setAddingMemberId(userId);
    setError(null);
    try {
      await apiClient.post(`/chats/${chat.id}/members/${userId}`);
      // Refresh chat to get updated members list
      const response = await apiClient.get<Chat>(`/chats/${chat.id}`);
      updateChat(chat.id, { members: response.data.members });
      // Remove added user from search results
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Failed to add member:', err);
      setError('Failed to add member');
    } finally {
      setAddingMemberId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-lg bg-[hsl(var(--background))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4">
          <h2 className="text-lg font-semibold">Chat Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[hsl(var(--border))]">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            General
          </button>
          {chat.type === 'Group' && (
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'members'
                  ? 'border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              Members
            </button>
          )}
          <button
            onClick={() => setActiveTab('danger')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'danger'
                ? 'border-b-2 border-red-500 text-red-500'
                : 'text-[hsl(var(--muted-foreground))] hover:text-red-500'
            }`}
          >
            Danger Zone
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Avatar */}
              {chat.type === 'Group' && canEdit && (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center overflow-hidden">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Chat avatar" className="h-full w-full object-cover" />
                      ) : (
                        <Users className="h-10 w-10 text-white" />
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white hover:opacity-90"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{chat.name || 'Group Chat'}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      {chat.members.length} members
                    </p>
                  </div>
                </div>
              )}

              {/* Chat name (for groups only) */}
              {chat.type === 'Group' && canEdit && (
                <div>
                  <label className="block text-sm font-medium mb-1">Group Name</label>
                  <div className="relative">
                    <Edit3 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="text"
                      value={chatName}
                      onChange={(e) => setChatName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-transparent focus:border-[hsl(var(--ring))] outline-none"
                      placeholder="Enter group name"
                    />
                  </div>
                </div>
              )}

              {/* Notifications */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))]">
                <div className="flex items-center gap-3">
                  {isMuted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                  <div>
                    <p className="font-medium">Notifications</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      {isMuted ? 'Muted' : 'Enabled'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleMute}
                  disabled={isLoading}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </Button>
              </div>

              {/* Save button for groups */}
              {chat.type === 'Group' && canEdit && (
                <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full">
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Changes
                </Button>
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && chat.type === 'Group' && (
            <div className="space-y-4">
              {/* Add Member Button/Search */}
              {canEdit && (
                <div className="space-y-3">
                  {!showAddMember ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowAddMember(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => handleSearchUsers(e.target.value)}
                          placeholder="Search users by name or username..."
                          className="w-full pl-9 pr-4 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-transparent focus:border-[hsl(var(--ring))] outline-none text-sm"
                          autoFocus
                        />
                        {isSearching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
                        )}
                      </div>

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="max-h-40 overflow-y-auto space-y-1 border border-[hsl(var(--border))] rounded-lg p-2">
                          {searchResults.map((searchUser) => (
                            <div
                              key={searchUser.id}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-[hsl(var(--secondary))]"
                            >
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center overflow-hidden">
                                  {searchUser.avatarUrl ? (
                                    <img src={searchUser.avatarUrl} alt={searchUser.displayName} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="text-xs font-medium text-white">
                                      {searchUser.displayName.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{searchUser.displayName}</p>
                                  <p className="text-xs text-[hsl(var(--muted-foreground))]">@{searchUser.username}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleAddMember(searchUser.id)}
                                disabled={addingMemberId === searchUser.id}
                              >
                                {addingMemberId === searchUser.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <UserPlus className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                        <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-2">
                          No users found
                        </p>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddMember(false);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="w-full"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                  {chat.members.length} members
                </p>
                {chat.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-[hsl(var(--secondary))]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center overflow-hidden">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt={member.displayName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-sm font-medium text-white">
                              {member.displayName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        {member.isOnline && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-[hsl(var(--background))]" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {member.displayName}
                          {member.userId === user?.id && ' (You)'}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {member.role} {member.isOnline ? '• Online' : ''}
                        </p>
                      </div>
                    </div>
                    {(isAdmin || isOwner) && member.userId !== user?.id && member.role !== 'Owner' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        <UserMinus className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === 'danger' && (
            <div className="space-y-4">
              {chat.type === 'Group' && (
                <button
                  onClick={handleLeaveChat}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-4 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Leave Chat</p>
                    <p className="text-sm opacity-80">You won't receive messages from this chat anymore</p>
                  </div>
                </button>
              )}

              {(isOwner || chat.type === 'Private') && (
                <button
                  onClick={handleDeleteChat}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-4 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Delete Chat</p>
                    <p className="text-sm opacity-80">This will permanently delete the chat and all messages</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
