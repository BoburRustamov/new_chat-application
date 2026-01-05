import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Megaphone, Users, ArrowLeft, TrendingUp } from 'lucide-react';
import { useChannelStore } from '@/entities/channel';
import type { ChannelSearchResult } from '@/shared/types';

export function ChannelDiscoveryPage() {
  const navigate = useNavigate();
  const {
    searchResults,
    popularChannels,
    isSearching,
    isLoading,
    searchChannels,
    loadPopularChannels,
    subscribe,
    clearSearch,
  } = useChannelStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  useEffect(() => {
    loadPopularChannels().catch(console.error);
    return () => clearSearch();
  }, [loadPopularChannels, clearSearch]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.trim()) {
        searchChannels(query).catch(console.error);
      } else {
        clearSearch();
      }
    },
    [searchChannels, clearSearch]
  );

  const handleSubscribe = async (channel: ChannelSearchResult) => {
    setSubscribingId(channel.id);
    try {
      const subscribedChannel = await subscribe(channel.id);
      navigate(`/chat/${subscribedChannel.chatId}`);
    } catch (error) {
      console.error('Failed to subscribe:', error);
    } finally {
      setSubscribingId(null);
    }
  };

  const displayChannels = searchQuery.trim() ? searchResults : popularChannels;
  const title = searchQuery.trim() ? 'Search Results' : 'Popular Channels';

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--background))]">
      {/* Header */}
      <div className="border-b border-[hsl(var(--border))] p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full p-2 hover:bg-[hsl(var(--secondary))]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold">Discover Channels</h1>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Search public channels..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg bg-[hsl(var(--secondary))] py-2.5 pl-10 pr-4 outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[hsl(var(--muted-foreground))]" />
          )}
        </div>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          {!searchQuery.trim() && <TrendingUp className="h-4 w-4" />}
          <span>{title}</span>
        </div>

        {isLoading && !isSearching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : displayChannels.length === 0 ? (
          <div className="py-8 text-center text-[hsl(var(--muted-foreground))]">
            {searchQuery.trim()
              ? 'No channels found matching your search'
              : 'No public channels available'}
          </div>
        ) : (
          <div className="space-y-2">
            {displayChannels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center gap-4 rounded-lg border border-[hsl(var(--border))] p-4 transition-colors hover:bg-[hsl(var(--secondary))]"
              >
                {/* Avatar */}
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
                  {channel.avatarUrl ? (
                    <img
                      src={channel.avatarUrl}
                      alt={channel.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <Megaphone className="h-7 w-7 text-white" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium">{channel.name}</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    @{channel.username}
                  </p>
                  {channel.description && (
                    <p className="mt-1 truncate text-sm text-[hsl(var(--muted-foreground))]">
                      {channel.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                    <Users className="h-3 w-3" />
                    <span>
                      {channel.subscriberCount.toLocaleString()} subscribers
                    </span>
                  </div>
                </div>

                {/* Subscribe Button */}
                <button
                  onClick={() => handleSubscribe(channel)}
                  disabled={subscribingId === channel.id}
                  className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
                >
                  {subscribingId === channel.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Join'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
