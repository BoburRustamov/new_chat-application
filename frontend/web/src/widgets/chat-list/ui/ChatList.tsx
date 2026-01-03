import { useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useChatStore } from '@/entities/chat/model/chatStore';
import { ChatListItem } from './ChatListItem';

interface ChatListProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ChatList({ searchQuery, onSearchChange }: ChatListProps) {
  const { chats, selectedChatId, isLoadingChats, loadChats, selectChat } = useChatStore();

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      chat.name?.toLowerCase().includes(query) ||
      chat.members.some(
        (m) =>
          m.displayName.toLowerCase().includes(query) ||
          m.username.toLowerCase().includes(query)
      )
    );
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg bg-[hsl(var(--secondary))] py-2 pl-10 pr-4 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingChats ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {searchQuery ? 'No chats match your search' : 'No chats yet. Start a new conversation!'}
          </div>
        ) : (
          filteredChats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isSelected={selectedChatId === chat.id}
              onClick={() => selectChat(chat.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
