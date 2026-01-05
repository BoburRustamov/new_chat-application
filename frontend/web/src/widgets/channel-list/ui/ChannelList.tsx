import { useEffect } from 'react';
import { Search, Loader2, Plus } from 'lucide-react';
import { useChannelStore } from '@/entities/channel';
import { ChannelListItem } from './ChannelListItem';

interface ChannelListProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateClick: () => void;
  onChannelSelect: (channelId: string, chatId: string) => void;
}

export function ChannelList({
  searchQuery,
  onSearchChange,
  onCreateClick,
  onChannelSelect,
}: ChannelListProps) {
  const { channels, selectedChannelId, isLoading, loadUserChannels, selectChannel } =
    useChannelStore();

  useEffect(() => {
    loadUserChannels().catch((err) => console.error('Failed to load channels:', err));
  }, [loadUserChannels]);

  const filteredChannels = channels.filter((channel) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      channel.name.toLowerCase().includes(query) ||
      channel.username.toLowerCase().includes(query) ||
      channel.description?.toLowerCase().includes(query)
    );
  });

  const handleChannelClick = (channel: typeof channels[0]) => {
    selectChannel(channel.id);
    onChannelSelect(channel.id, channel.chatId);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header with Search and Create button */}
      <div className="flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg bg-[hsl(var(--secondary))] py-2 pl-10 pr-4 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <button
          onClick={onCreateClick}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90"
          title="Create Channel"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {searchQuery
              ? 'No channels match your search'
              : 'No channels yet. Create or discover channels!'}
          </div>
        ) : (
          filteredChannels.map((channel) => (
            <ChannelListItem
              key={channel.id}
              channel={channel}
              isSelected={selectedChannelId === channel.id}
              onClick={() => handleChannelClick(channel)}
            />
          ))
        )}
      </div>
    </div>
  );
}
