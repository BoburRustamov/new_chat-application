import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MoreVertical, ArrowLeft, Pin, Search } from 'lucide-react';
import type { Chat } from '@/shared/types';
import { useAuthStore } from '@/entities/user/model/authStore';
import { Button } from '@/shared/ui';
import { CallButton } from '@/features/call';
import { ChatSettingsModal } from '@/features/chat-settings';

interface ChatHeaderProps {
  chat: Chat;
  onBack?: () => void;
  onTogglePinned?: () => void;
  isPinnedPanelOpen?: boolean;
  onToggleSearch?: () => void;
  isSearchOpen?: boolean;
}

export function ChatHeader({ chat, onBack, onTogglePinned, isPinnedPanelOpen, onToggleSearch, isSearchOpen }: ChatHeaderProps) {
  const { user } = useAuthStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const getDisplayInfo = () => {
    if (chat.type === 'Private') {
      const otherMember = chat.members.find((m) => m.userId !== user?.id);
      return {
        name: otherMember?.displayName || 'Unknown',
        avatar: otherMember?.avatarUrl,
        isOnline: otherMember?.isOnline || false,
        lastSeen: otherMember?.lastSeenAt,
      };
    }
    return {
      name: chat.name || 'Unnamed Group',
      avatar: chat.avatarUrl,
      isOnline: false,
      memberCount: chat.members.length,
    };
  };

  const displayInfo = getDisplayInfo();

  const getStatusText = () => {
    if (chat.type === 'Private') {
      if (displayInfo.isOnline) return 'online';
      if (displayInfo.lastSeen) {
        return `last seen ${formatDistanceToNow(new Date(displayInfo.lastSeen), { addSuffix: true })}`;
      }
      return 'offline';
    }
    const onlineCount = chat.members.filter((m) => m.isOnline).length;
    return `${chat.members.length} members${onlineCount > 0 ? `, ${onlineCount} online` : ''}`;
  };

  return (
    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Avatar */}
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
            {displayInfo.avatar ? (
              <img
                src={displayInfo.avatar}
                alt={displayInfo.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-lg font-medium text-white">
                {displayInfo.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {chat.type === 'Private' && displayInfo.isOnline && (
            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[hsl(var(--background))] bg-green-500" />
          )}
        </div>

        {/* Info */}
        <div>
          <h2 className="font-medium">{displayInfo.name}</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{getStatusText()}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <CallButton chatId={chat.id} type="Voice" />
        <CallButton chatId={chat.id} type="Video" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSearch}
          className={isSearchOpen ? 'bg-[hsl(var(--muted))]' : ''}
        >
          <Search className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onTogglePinned}
          className={isPinnedPanelOpen ? 'bg-[hsl(var(--muted))]' : ''}
        >
          <Pin className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Chat Settings Modal */}
      <ChatSettingsModal
        chat={chat}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
