import { useEffect, useState } from 'react';
import { X, Pin, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/shared/ui';
import type { Message, Chat } from '@/shared/types';
import { apiClient } from '@/shared/api/client';
import { signalRService } from '@/shared/api/signalr';

interface PinnedMessagesPanelProps {
  chat: Chat;
  isOpen: boolean;
  onClose: () => void;
  onMessageClick?: (messageId: string) => void;
}

export function PinnedMessagesPanel({
  chat,
  isOpen,
  onClose,
  onMessageClick,
}: PinnedMessagesPanelProps) {
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPinnedMessages();
    }
  }, [isOpen, chat.id]);

  const loadPinnedMessages = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<Message[]>(`/messages/chat/${chat.id}/pinned`);
      setPinnedMessages(response.data);
    } catch (err) {
      console.error('Failed to load pinned messages:', err);
      setError('Failed to load pinned messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnpin = async (messageId: string) => {
    try {
      await signalRService.unpinMessage(messageId);
      setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('Failed to unpin message:', err);
    }
  };

  const getMessagePreview = (message: Message) => {
    if (message.content) {
      return message.content.length > 100
        ? `${message.content.substring(0, 100)}...`
        : message.content;
    }
    if (message.file) {
      return `[${message.type}: ${message.file.fileName}]`;
    }
    return '[Message]';
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="flex items-center gap-2">
          <Pin className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h2 className="font-semibold">Pinned Messages</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <Button variant="outline" className="mt-4" onClick={loadPinnedMessages}>
              Retry
            </Button>
          </div>
        ) : pinnedMessages.length === 0 ? (
          <div className="py-8 text-center">
            <Pin className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
            <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
              No pinned messages yet
            </p>
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              Right-click on a message to pin it
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pinnedMessages.map((message) => (
              <div
                key={message.id}
                className="group relative rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-3 transition-colors hover:bg-[hsl(var(--muted))]"
              >
                {/* Sender and time */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-[hsl(var(--primary))]">
                    {message.senderDisplayName}
                  </span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {format(new Date(message.createdAt), 'MMM d, HH:mm')}
                  </span>
                </div>

                {/* Message content */}
                <button
                  onClick={() => onMessageClick?.(message.id)}
                  className="w-full text-left"
                >
                  <p className="text-sm text-[hsl(var(--foreground))]">
                    {getMessagePreview(message)}
                  </p>
                </button>

                {/* Pinned date */}
                {message.pinnedAt && (
                  <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                    Pinned {format(new Date(message.pinnedAt), 'MMM d, yyyy')}
                  </p>
                )}

                {/* Unpin button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleUnpin(message.id)}
                  className="absolute right-2 top-2 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
