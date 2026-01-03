import { formatDistanceToNow } from 'date-fns';
import type { Chat } from '@/shared/types';
import { useAuthStore } from '@/entities/user/model/authStore';

interface ChatListItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
}

export function ChatListItem({ chat, isSelected, onClick }: ChatListItemProps) {
  const { user } = useAuthStore();

  // For private chats, get the other member's info
  const getDisplayInfo = () => {
    if (chat.type === 'Private') {
      const otherMember = chat.members.find((m) => m.userId !== user?.id);
      return {
        name: otherMember?.displayName || 'Unknown',
        avatar: otherMember?.avatarUrl,
        isOnline: otherMember?.isOnline || false,
      };
    }
    return {
      name: chat.name || 'Unnamed Group',
      avatar: chat.avatarUrl,
      isOnline: false,
    };
  };

  const displayInfo = getDisplayInfo();
  const lastMessage = chat.lastMessage;

  const getLastMessagePreview = () => {
    if (!lastMessage) return 'No messages yet';
    if (lastMessage.isDeleted) return 'Message deleted';
    if (lastMessage.type !== 'Text') {
      const typeLabels: Record<string, string> = {
        Image: '📷 Photo',
        Video: '🎬 Video',
        Audio: '🎵 Audio',
        Voice: '🎤 Voice message',
        File: '📎 File',
        System: 'System message',
      };
      return typeLabels[lastMessage.type] || 'Attachment';
    }
    return lastMessage.content || '';
  };

  const getTimeDisplay = () => {
    if (!lastMessage) return '';
    return formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: false });
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

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate font-medium">{displayInfo.name}</span>
          <span className="flex-shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
            {getTimeDisplay()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">
            {lastMessage && lastMessage.senderId === user?.id && (
              <span className="text-[hsl(var(--primary))]">You: </span>
            )}
            {getLastMessagePreview()}
          </p>
          {chat.unreadCount > 0 && (
            <span className="ml-2 flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1.5 text-xs font-medium text-white">
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
