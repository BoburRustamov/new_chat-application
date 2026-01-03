import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, MessageCircle, Settings, Plus, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '@/entities/user/model/authStore';
import { useChatStore } from '@/entities/chat/model/chatStore';
import { useCallStore } from '@/entities/call/model/callStore';
import { Button } from '@/shared/ui';
import { ChatList } from '@/widgets/chat-list/ui/ChatList';
import { ChatHeader } from '@/widgets/chat-area/ui/ChatHeader';
import { MessageList } from '@/widgets/chat-area/ui/MessageList';
import { MessageInput } from '@/features/messaging/ui/MessageInput';
import { NewChatModal } from '@/features/new-chat/ui/NewChatModal';
import { CallOverlay, IncomingCallModal } from '@/features/call';
import { PinnedMessagesPanel } from '@/widgets/chat-area/ui/PinnedMessagesPanel';
import { MessageSearch } from '@/features/search';
import type { Message } from '@/shared/types';

export function ChatPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [isPinnedPanelOpen, setIsPinnedPanelOpen] = useState(false);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const messageListRef = useRef<{ scrollToMessage: (id: string) => void } | null>(null);

  const {
    chats,
    selectedChatId,
    selectChat,
    connectionStatus,
    connectSignalR,
    disconnectSignalR
  } = useChatStore();

  const {
    incomingCall,
    callState,
    initializeCallHandlers,
    acceptCall,
    declineCall,
  } = useCallStore();

  const selectedChat = chats.find((c) => c.id === selectedChatId);

  // Clear reply and close panels when chat changes
  useEffect(() => {
    setReplyToMessage(null);
    setIsPinnedPanelOpen(false);
    setIsMessageSearchOpen(false);
  }, [selectedChatId]);

  const handleTogglePinned = useCallback(() => {
    setIsPinnedPanelOpen((prev) => !prev);
  }, []);

  const handleToggleSearch = useCallback(() => {
    setIsMessageSearchOpen((prev) => !prev);
  }, []);

  const handleNavigateToMessage = useCallback((messageId: string) => {
    messageListRef.current?.scrollToMessage(messageId);
  }, []);

  const handleReplyMessage = useCallback((message: Message) => {
    setReplyToMessage(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  // Connect to SignalR on mount
  useEffect(() => {
    let isMounted = true;

    const connect = async () => {
      try {
        await connectSignalR();
      } catch (error) {
        // Only log errors if component is still mounted
        if (isMounted) {
          console.error('Failed to connect to SignalR:', error);
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      disconnectSignalR();
    };
  }, [connectSignalR, disconnectSignalR]);

  // Initialize call handlers when SignalR is connected
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const cleanup = initializeCallHandlers();
      return cleanup;
    }
  }, [connectionStatus, initializeCallHandlers]);

  const handleLogout = async () => {
    await disconnectSignalR();
    await logout();
    navigate('/');
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
      case 'reconnecting':
        return <Wifi className="h-4 w-4 animate-pulse text-yellow-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      {/* Sidebar */}
      <div className={`flex w-80 flex-col border-r border-[hsl(var(--border))] ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold">ChatApp</span>
            <div title={connectionStatus}>{getConnectionIcon()}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setIsNewChatModalOpen(true)}>
              <Plus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Chat List */}
        <ChatList searchQuery={searchQuery} onSearchChange={setSearchQuery} />

        {/* Sidebar Footer - User Info */}
        <div className="border-t border-[hsl(var(--border))] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-white">
                    {user?.displayName?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{user?.displayName}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">@{user?.username}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`relative flex flex-1 flex-col ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
        {selectedChat ? (
          <>
            <ChatHeader
              chat={selectedChat}
              onBack={() => selectChat(null)}
              onTogglePinned={handleTogglePinned}
              isPinnedPanelOpen={isPinnedPanelOpen}
              onToggleSearch={handleToggleSearch}
              isSearchOpen={isMessageSearchOpen}
            />

            {/* Message Search */}
            <MessageSearch
              chatId={selectedChat.id}
              isOpen={isMessageSearchOpen}
              onClose={() => setIsMessageSearchOpen(false)}
              onNavigateToMessage={handleNavigateToMessage}
            />

            <MessageList ref={messageListRef} chat={selectedChat} onReplyMessage={handleReplyMessage} />
            <MessageInput
              chatId={selectedChat.id}
              replyToMessage={replyToMessage}
              onCancelReply={handleCancelReply}
            />

            {/* Pinned Messages Panel */}
            <PinnedMessagesPanel
              chat={selectedChat}
              isOpen={isPinnedPanelOpen}
              onClose={() => setIsPinnedPanelOpen(false)}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--secondary))]">
                <MessageCircle className="h-12 w-12 text-[hsl(var(--muted-foreground))]" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold">Welcome to ChatApp</h2>
              <p className="mt-2 text-[hsl(var(--muted-foreground))]">
                Select a chat to start messaging or create a new conversation
              </p>
              <Button className="mt-6" onClick={() => setIsNewChatModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Chat
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal isOpen={isNewChatModalOpen} onClose={() => setIsNewChatModalOpen(false)} />

      {/* Call Overlay - shown when in a call */}
      {callState !== 'idle' && <CallOverlay />}

      {/* Incoming Call Modal */}
      {incomingCall && callState === 'ringing' && (
        <IncomingCallModal
          callEvent={incomingCall}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}
    </div>
  );
}
