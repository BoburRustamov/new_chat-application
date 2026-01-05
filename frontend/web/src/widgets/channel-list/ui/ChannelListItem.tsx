import { Megaphone, Lock, Users } from 'lucide-react';
import type { Channel } from '@/shared/types';

interface ChannelListItemProps {
  channel: Channel;
  isSelected: boolean;
  onClick: () => void;
}

export function ChannelListItem({ channel, isSelected, onClick }: ChannelListItemProps) {
  const formatSubscriberCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[hsl(var(--secondary))] ${
        isSelected ? 'bg-[hsl(var(--secondary))]' : ''
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
          {channel.avatarUrl ? (
            <img
              src={channel.avatarUrl}
              alt={channel.name}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <Megaphone className="h-6 w-6 text-white" />
          )}
        </div>
        {!channel.isPublic && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--background))]">
            <Lock className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))]" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{channel.name}</span>
          {channel.userRole === 'Owner' && (
            <span className="rounded bg-[hsl(var(--primary))] px-1.5 py-0.5 text-[10px] font-medium text-white">
              Owner
            </span>
          )}
          {channel.userRole === 'Admin' && (
            <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Admin
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <Users className="h-3 w-3" />
          <span>{formatSubscriberCount(channel.subscriberCount)} subscribers</span>
        </div>
      </div>
    </div>
  );
}
