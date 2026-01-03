import { useState } from 'react';
import { X, Forward, Search, Check } from 'lucide-react';
import { Button } from '@/shared/ui';
import type { Message, Chat } from '@/shared/types';
import { useChatStore } from '@/entities/chat/model/chatStore';
import { signalRService } from '@/shared/api/signalr';

interface ForwardMessageModalProps {
  message: Message;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ForwardMessageModal({ message, isOpen, onClose, onSuccess }: ForwardMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { chats } = useChatStore();

  // Filter chats based on search query
  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;
    const name = chat.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleChatSelection = (chatId: string) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId]
    );
  };

  const handleForward = async () => {
    if (selectedChatIds.length === 0) {
      setError('Please select at least one chat');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Forward to each selected chat
      for (const chatId of selectedChatIds) {
        await signalRService.forwardMessage(message.id, chatId);
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to forward message:', err);
      setError('Failed to forward message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getMessagePreview = () => {
    if (message.content) {
      return message.content.length > 50
        ? `${message.content.substring(0, 50)}...`
        : message.content;
    }
    if (message.file) {
      return `[${message.type}: ${message.file.fileName}]`;
    }
    return '[Message]';
  };

  const getChatDisplayName = (chat: Chat) => {
    return chat.name || 'Chat';
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.avatarUrl) {
      return (
        <img
          src={chat.avatarUrl}
          alt={getChatDisplayName(chat)}
          className="h-full w-full rounded-full object-cover"
        />
      );
    }
    return (
      <span className="text-sm font-medium text-white">
        {getChatDisplayName(chat).charAt(0).toUpperCase()}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-[hsl(var(--background))] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
          <div className="flex items-center gap-2">
            <Forward className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="text-lg font-semibold">Forward Message</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Message Preview */}
        <div className="border-b border-[hsl(var(--border))] px-4 py-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Forwarding:</p>
          <p className="mt-1 truncate text-sm italic">"{getMessagePreview()}"</p>
        </div>

        {/* Search */}
        <div className="border-b border-[hsl(var(--border))] p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full rounded-lg bg-[hsl(var(--secondary))] py-2 pl-10 pr-4 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="max-h-64 overflow-y-auto p-2">
          {filteredChats.length === 0 ? (
            <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No chats found
            </p>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => toggleChatSelection(chat.id)}
                className={`flex w-full items-center gap-3 rounded-lg p-3 transition-colors ${
                  selectedChatIds.includes(chat.id)
                    ? 'bg-[hsl(var(--primary))]/10'
                    : 'hover:bg-[hsl(var(--muted))]'
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
                  {getChatAvatar(chat)}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{getChatDisplayName(chat)}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {chat.type === 'Private' ? 'Private chat' : `${chat.members?.length || 0} members`}
                  </p>
                </div>
                {selectedChatIds.includes(chat.id) && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {error && (
          <div className="px-4 py-2">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-4 py-3">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {selectedChatIds.length} chat{selectedChatIds.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleForward}
              disabled={isSubmitting || selectedChatIds.length === 0}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Forwarding...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Forward className="h-4 w-4" />
                  Forward
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
