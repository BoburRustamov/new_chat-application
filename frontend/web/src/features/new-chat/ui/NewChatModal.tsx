import { useState, useEffect } from 'react';
import { X, Search, Loader2, Users } from 'lucide-react';
import { apiClient } from '@/shared/api/client';
import type { User, PagedResponse } from '@/shared/types';
import { useChatStore } from '@/entities/chat/model/chatStore';
import { Button } from '@/shared/ui';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'search' | 'group'>('search');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');

  const { createPrivateChat, createGroupChat, selectChat } = useChatStore();

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setUsers([]);
      setSelectedUsers([]);
      setGroupName('');
      setMode('search');
    }
  }, [isOpen]);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setUsers([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await apiClient.get<PagedResponse<User>>(`/users/search?query=${encodeURIComponent(searchQuery)}`);
        setUsers(response.data.items);
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleUserSelect = async (user: User) => {
    if (mode === 'group') {
      if (selectedUsers.some((u) => u.id === user.id)) {
        setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
      } else {
        setSelectedUsers([...selectedUsers, user]);
      }
    } else {
      try {
        const chat = await createPrivateChat(user.id);
        selectChat(chat.id);
        onClose();
      } catch (error) {
        console.error('Failed to create chat:', error);
      }
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;

    try {
      const chat = await createGroupChat(
        groupName.trim(),
        undefined,
        selectedUsers.map((u) => u.id)
      );
      selectChat(chat.id);
      onClose();
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-[hsl(var(--background))] shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4">
          <h2 className="text-lg font-semibold">
            {mode === 'group' ? 'New Group' : 'New Chat'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Mode toggle */}
        <div className="flex border-b border-[hsl(var(--border))]">
          <button
            onClick={() => setMode('search')}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === 'search'
                ? 'border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                : 'text-[hsl(var(--muted-foreground))]'
            }`}
          >
            New Chat
          </button>
          <button
            onClick={() => setMode('group')}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === 'group'
                ? 'border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                : 'text-[hsl(var(--muted-foreground))]'
            }`}
          >
            New Group
          </button>
        </div>

        {/* Group name input */}
        {mode === 'group' && (
          <div className="border-b border-[hsl(var(--border))] p-4">
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-lg bg-[hsl(var(--secondary))] px-4 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
        )}

        {/* Selected users for group */}
        {mode === 'group' && selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-[hsl(var(--border))] p-4">
            {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-1 rounded-full bg-[hsl(var(--primary))] px-3 py-1 text-sm text-white"
              >
                <span>{user.displayName}</span>
                <button
                  onClick={() => setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id))}
                  className="ml-1 hover:text-white/80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-[hsl(var(--secondary))] py-2 pl-10 pr-4 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
        </div>

        {/* User list */}
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {searchQuery.length < 2 ? 'Type to search for users' : 'No users found'}
            </div>
          ) : (
            users.map((user) => {
              const isSelected = selectedUsers.some((u) => u.id === user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[hsl(var(--secondary))] ${
                    isSelected ? 'bg-[hsl(var(--secondary))]' : ''
                  }`}
                >
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-medium text-white">
                        {user.displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {user.isOnline && (
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[hsl(var(--background))] bg-green-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">@{user.username}</p>
                  </div>
                  {mode === 'group' && isSelected && (
                    <div className="h-5 w-5 rounded-full bg-[hsl(var(--primary))] text-center text-white">
                      ✓
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Create group button */}
        {mode === 'group' && (
          <div className="border-t border-[hsl(var(--border))] p-4">
            <Button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length === 0}
              className="w-full"
            >
              <Users className="mr-2 h-4 w-4" />
              Create Group ({selectedUsers.length} members)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
