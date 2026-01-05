import { useEffect, useRef, useMemo, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import type { Chat, Message } from '@/shared/types';
import { useChatStore } from '@/entities/chat/model/chatStore';
import { MessageBubble } from './MessageBubble';
import { MessageContextMenu, EditMessageModal, DeleteMessageModal, ForwardMessageModal, ReactionPicker } from '@/features/messaging';
import { signalRService } from '@/shared/api/signalr';

interface MessageListProps {
  chat: Chat;
  onReplyMessage?: (message: Message) => void;
}

export interface MessageListHandle {
  scrollToMessage: (messageId: string) => void;
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(function MessageList({ chat, onReplyMessage }, ref) {
  const { messages, isLoadingMessages, typingUsers, markAsRead } = useChatStore();
  const chatMessages = useMemo(() => messages[chat.id] || [], [messages, chat.id]);
  const chatTypingUsers = typingUsers[chat.id] || [];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Expose scrollToMessage method via ref
  useImperativeHandle(ref, () => ({
    scrollToMessage: (messageId: string) => {
      const element = messageRefs.current.get(messageId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(messageId);
        // Clear highlight after animation
        setTimeout(() => setHighlightedMessageId(null), 2000);
      }
    },
  }), []);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    message: Message | null;
    position: { x: number; y: number };
  }>({ isOpen: false, message: null, position: { x: 0, y: 0 } });

  // Edit modal state
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    message: Message | null;
  }>({ isOpen: false, message: null });

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    message: Message | null;
  }>({ isOpen: false, message: null });

  // Forward modal state
  const [forwardModal, setForwardModal] = useState<{
    isOpen: boolean;
    message: Message | null;
  }>({ isOpen: false, message: null });

  // Reaction picker state
  const [reactionPicker, setReactionPicker] = useState<{
    isOpen: boolean;
    messageId: string | null;
    position: { x: number; y: number };
  }>({ isOpen: false, messageId: null, position: { x: 0, y: 0 } });

  // Context menu handlers
  const handleContextMenu = useCallback((message: Message, position: { x: number; y: number }) => {
    setContextMenu({ isOpen: true, message, position });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, message: null, position: { x: 0, y: 0 } });
  }, []);

  const handleReply = useCallback((message: Message) => {
    if (onReplyMessage) {
      onReplyMessage(message);
    }
  }, [onReplyMessage]);

  const handleEdit = useCallback((message: Message) => {
    setEditModal({ isOpen: true, message });
  }, []);

  const handleDelete = useCallback((message: Message) => {
    setDeleteModal({ isOpen: true, message });
  }, []);

  const handleForward = useCallback((message: Message) => {
    setForwardModal({ isOpen: true, message });
  }, []);

  const handlePin = useCallback(async (message: Message) => {
    try {
      await signalRService.invoke('PinMessage', message.id);
    } catch (error) {
      console.error('Failed to pin message:', error);
    }
  }, []);

  const handleUnpin = useCallback(async (message: Message) => {
    try {
      await signalRService.invoke('UnpinMessage', message.id);
    } catch (error) {
      console.error('Failed to unpin message:', error);
    }
  }, []);

  const handleReact = useCallback((message: Message) => {
    // Get position from context menu or use center of screen
    const position = contextMenu.isOpen
      ? contextMenu.position
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    setReactionPicker({ isOpen: true, messageId: message.id, position });
  }, [contextMenu]);

  const handleCopy = useCallback((message: Message) => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (chatMessages.length > 0) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      markAsRead(chat.id, lastMessage.id);
    }
  }, [chat.id, chatMessages, markAsRead]);

  // Group messages by date
  const groupedMessages: { date: Date; messages: Message[] }[] = [];
  let currentGroup: { date: Date; messages: Message[] } | null = null;

  chatMessages.forEach((message) => {
    const messageDate = parseISO(message.createdAt);
    if (!currentGroup || !isSameDay(currentGroup.date, messageDate)) {
      currentGroup = { date: messageDate, messages: [] };
      groupedMessages.push(currentGroup);
    }
    currentGroup.messages.push(message);
  });

  // Determine if we should show sender name (for group chats)
  const shouldShowSender = (message: Message, index: number, group: Message[]) => {
    if (chat.type === 'Private') return false;
    if (index === 0) return true;
    return group[index - 1].senderId !== message.senderId;
  };

  const getTypingText = () => {
    if (chatTypingUsers.length === 0) return null;
    if (chatTypingUsers.length === 1) {
      return `${chatTypingUsers[0].userName} is typing...`;
    }
    if (chatTypingUsers.length === 2) {
      return `${chatTypingUsers[0].userName} and ${chatTypingUsers[1].userName} are typing...`;
    }
    return `${chatTypingUsers[0].userName} and ${chatTypingUsers.length - 1} others are typing...`;
  };

  const typingText = getTypingText();

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-y-auto p-4">
      {isLoadingMessages ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : chatMessages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[hsl(var(--muted-foreground))]">No messages yet. Say hello!</p>
        </div>
      ) : (
        <>
          {groupedMessages.map((group) => (
            <div key={group.date.toISOString()}>
              {/* Date separator */}
              <div className="my-4 flex items-center justify-center">
                <div className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {format(group.date, 'MMMM d, yyyy')}
                </div>
              </div>

              {/* Messages for this date */}
              <div className="space-y-2">
                {group.messages.map((message, index) => (
                  <div
                    key={message.id}
                    ref={(el) => {
                      if (el) messageRefs.current.set(message.id, el);
                    }}
                    className={`transition-all duration-500 ${
                      highlightedMessageId === message.id
                        ? 'rounded-lg bg-[hsl(var(--primary))]/10 ring-2 ring-[hsl(var(--primary))]'
                        : ''
                    }`}
                  >
                    <MessageBubble
                      message={message}
                      showSender={shouldShowSender(message, index, group.messages)}
                      onContextMenu={handleContextMenu}
                      onReply={handleReply}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Context Menu */}
      {contextMenu.message && (
        <MessageContextMenu
          message={contextMenu.message}
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onForward={handleForward}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onReact={handleReact}
          onCopy={handleCopy}
          chatMembers={chat.members}
        />
      )}

      {/* Edit Message Modal */}
      {editModal.message && (
        <EditMessageModal
          message={editModal.message}
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, message: null })}
          onSuccess={() => {}}
        />
      )}

      {/* Delete Message Modal */}
      {deleteModal.message && (
        <DeleteMessageModal
          message={deleteModal.message}
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, message: null })}
          onSuccess={() => {}}
        />
      )}

      {/* Forward Message Modal */}
      {forwardModal.message && (
        <ForwardMessageModal
          message={forwardModal.message}
          isOpen={forwardModal.isOpen}
          onClose={() => setForwardModal({ isOpen: false, message: null })}
          onSuccess={() => {}}
        />
      )}

      {/* Reaction Picker */}
      {reactionPicker.messageId && (
        <ReactionPicker
          messageId={reactionPicker.messageId}
          isOpen={reactionPicker.isOpen}
          position={reactionPicker.position}
          onClose={() => setReactionPicker({ isOpen: false, messageId: null, position: { x: 0, y: 0 } })}
        />
      )}

      {/* Typing indicator */}
      {typingText && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex space-x-1">
            <div className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--muted-foreground))]" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--muted-foreground))]" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--muted-foreground))]" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">{typingText}</span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
});
