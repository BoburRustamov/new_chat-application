import * as signalR from '@microsoft/signalr';
import type {
  Message,
  SendMessageRequest,
  TypingEvent,
  UserStatusEvent,
  MessageDeletedEvent,
  MessagesReadEvent,
  Call,
  CallType,
  IncomingCallEvent,
  CallAcceptedEvent,
  CallDeclinedEvent,
  CallEndedEvent,
  ParticipantLeftEvent,
  ReceiveOfferEvent,
  ReceiveAnswerEvent,
  ReceiveIceCandidateEvent,
  ParticipantMutedEvent,
  ParticipantVideoChangedEvent,
} from '../types';

// Reaction/Pin event types - backend sends the updated Message directly
type ReactionHandler = (message: Message) => void;
type MessagePinnedHandler = (message: Message) => void;
type MessageForwardedHandler = (message: Message) => void;

const HUB_URL = import.meta.env.VITE_HUB_URL || '/hubs/chat';

type MessageHandler = (message: Message) => void;
type MessageEditedHandler = (message: Message) => void;
type MessageDeletedHandler = (event: MessageDeletedEvent) => void;
type TypingHandler = (event: TypingEvent) => void;
type UserStatusHandler = (event: UserStatusEvent) => void;
type MessagesReadHandler = (event: MessagesReadEvent) => void;
type ConnectionHandler = () => void;

// Call event handlers
type CallInitiatedHandler = (call: Call) => void;
type IncomingCallHandler = (event: IncomingCallEvent) => void;
type CallAcceptedHandler = (event: CallAcceptedEvent) => void;
type CallDeclinedHandler = (event: CallDeclinedEvent) => void;
type CallEndedHandler = (event: CallEndedEvent) => void;
type ParticipantLeftHandler = (event: ParticipantLeftEvent) => void;
type ReceiveOfferHandler = (event: ReceiveOfferEvent) => void;
type ReceiveAnswerHandler = (event: ReceiveAnswerEvent) => void;
type ReceiveIceCandidateHandler = (event: ReceiveIceCandidateEvent) => void;
type ParticipantMutedHandler = (event: ParticipantMutedEvent) => void;
type ParticipantVideoChangedHandler = (event: ParticipantVideoChangedEvent) => void;

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private messageEditedHandlers: Set<MessageEditedHandler> = new Set();
  private messageDeletedHandlers: Set<MessageDeletedHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private stoppedTypingHandlers: Set<TypingHandler> = new Set();
  private userStatusHandlers: Set<UserStatusHandler> = new Set();
  private messagesReadHandlers: Set<MessagesReadHandler> = new Set();
  private connectedHandlers: Set<ConnectionHandler> = new Set();
  private disconnectedHandlers: Set<ConnectionHandler> = new Set();
  private reconnectingHandlers: Set<ConnectionHandler> = new Set();

  // Call event handler sets
  private callInitiatedHandlers: Set<CallInitiatedHandler> = new Set();
  private incomingCallHandlers: Set<IncomingCallHandler> = new Set();
  private callAcceptedHandlers: Set<CallAcceptedHandler> = new Set();
  private callDeclinedHandlers: Set<CallDeclinedHandler> = new Set();
  private callEndedHandlers: Set<CallEndedHandler> = new Set();
  private participantLeftHandlers: Set<ParticipantLeftHandler> = new Set();
  private receiveOfferHandlers: Set<ReceiveOfferHandler> = new Set();
  private receiveAnswerHandlers: Set<ReceiveAnswerHandler> = new Set();
  private receiveIceCandidateHandlers: Set<ReceiveIceCandidateHandler> = new Set();
  private participantMutedHandlers: Set<ParticipantMutedHandler> = new Set();
  private participantVideoChangedHandlers: Set<ParticipantVideoChangedHandler> = new Set();

  // Reaction/Pin/Forward event handler sets
  private reactionAddedHandlers: Set<ReactionHandler> = new Set();
  private reactionRemovedHandlers: Set<ReactionHandler> = new Set();
  private messagePinnedHandlers: Set<MessagePinnedHandler> = new Set();
  private messageUnpinnedHandlers: Set<MessagePinnedHandler> = new Set();
  private messageForwardedHandlers: Set<MessageForwardedHandler> = new Set();

  // Connection management - use version counter to handle Strict Mode
  private connectionVersion = 0;

  async start(): Promise<void> {
    // If already connected, do nothing
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      console.log('[SignalR] Already connected, skipping start');
      return;
    }

    // If currently connecting or reconnecting via SignalR's built-in mechanism, wait
    if (this.connection?.state === signalR.HubConnectionState.Connecting ||
        this.connection?.state === signalR.HubConnectionState.Reconnecting) {
      console.log('[SignalR] Already connecting/reconnecting, skipping start');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No access token available');
    }

    // Increment version - this invalidates any pending connection from a previous mount
    const currentVersion = ++this.connectionVersion;
    console.log(`[SignalR] Starting connection attempt, version: ${currentVersion}`);

    // Clean up any existing connection
    if (this.connection) {
      console.log('[SignalR] Cleaning up existing connection');
      try {
        await this.connection.stop();
      } catch {
        // Ignore stop errors
      }
      this.connection = null;
    }

    // Check if stop was called while we were cleaning up
    if (currentVersion !== this.connectionVersion) {
      console.log(`[SignalR] Version changed during cleanup (${currentVersion} vs ${this.connectionVersion}), aborting`);
      return;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.setupEventHandlers();

    try {
      await this.connection.start();
      // Only report success if this is still the current version
      if (currentVersion === this.connectionVersion) {
        console.log('[SignalR] Connected successfully');
        this.connectedHandlers.forEach(handler => handler());
      } else {
        console.log(`[SignalR] Version changed after connect (${currentVersion} vs ${this.connectionVersion}), ignoring success`);
      }
    } catch (error) {
      const err = error as Error;
      const isAbortError = err?.name === 'AbortError' ||
        err?.message?.includes('stopped during negotiation') ||
        err?.message?.includes('connection was stopped');

      // Abort errors are expected when component unmounts during connection
      if (isAbortError) {
        console.log('[SignalR] Connection aborted (React Strict Mode cleanup)');
        // Clear the connection so next attempt creates a fresh one
        this.connection = null;
        return;
      }

      // Only throw if this version is still valid
      if (currentVersion === this.connectionVersion) {
        console.error('[SignalR] Connection error:', error);
        this.connection = null;
        throw error;
      } else {
        console.log(`[SignalR] Version changed, ignoring error from version ${currentVersion}`);
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    this.connection.on('ReceiveMessage', (message: Message) => {
      this.messageHandlers.forEach(handler => handler(message));
    });

    this.connection.on('MessageEdited', (message: Message) => {
      this.messageEditedHandlers.forEach(handler => handler(message));
    });

    this.connection.on('MessageDeleted', (event: MessageDeletedEvent) => {
      this.messageDeletedHandlers.forEach(handler => handler(event));
    });

    this.connection.on('UserTyping', (event: TypingEvent) => {
      this.typingHandlers.forEach(handler => handler(event));
    });

    this.connection.on('UserStoppedTyping', (event: TypingEvent) => {
      this.stoppedTypingHandlers.forEach(handler => handler(event));
    });

    this.connection.on('UserStatusChanged', (event: UserStatusEvent) => {
      this.userStatusHandlers.forEach(handler => handler(event));
    });

    this.connection.on('MessagesRead', (event: MessagesReadEvent) => {
      this.messagesReadHandlers.forEach(handler => handler(event));
    });

    // Call event handlers
    this.connection.on('CallInitiated', (call: Call) => {
      this.callInitiatedHandlers.forEach(handler => handler(call));
    });

    this.connection.on('IncomingCall', (event: IncomingCallEvent) => {
      this.incomingCallHandlers.forEach(handler => handler(event));
    });

    this.connection.on('CallAccepted', (event: CallAcceptedEvent) => {
      this.callAcceptedHandlers.forEach(handler => handler(event));
    });

    this.connection.on('CallDeclined', (event: CallDeclinedEvent) => {
      this.callDeclinedHandlers.forEach(handler => handler(event));
    });

    this.connection.on('CallEnded', (event: CallEndedEvent) => {
      this.callEndedHandlers.forEach(handler => handler(event));
    });

    this.connection.on('ParticipantLeft', (event: ParticipantLeftEvent) => {
      this.participantLeftHandlers.forEach(handler => handler(event));
    });

    this.connection.on('ReceiveOffer', (event: ReceiveOfferEvent) => {
      this.receiveOfferHandlers.forEach(handler => handler(event));
    });

    this.connection.on('ReceiveAnswer', (event: ReceiveAnswerEvent) => {
      this.receiveAnswerHandlers.forEach(handler => handler(event));
    });

    this.connection.on('ReceiveIceCandidate', (event: ReceiveIceCandidateEvent) => {
      this.receiveIceCandidateHandlers.forEach(handler => handler(event));
    });

    this.connection.on('ParticipantMuted', (event: ParticipantMutedEvent) => {
      this.participantMutedHandlers.forEach(handler => handler(event));
    });

    this.connection.on('ParticipantVideoChanged', (event: ParticipantVideoChangedEvent) => {
      this.participantVideoChangedHandlers.forEach(handler => handler(event));
    });

    // Reaction events - backend sends the updated message with reactions
    this.connection.on('ReactionAdded', (message: Message) => {
      this.reactionAddedHandlers.forEach(handler => handler(message));
    });

    this.connection.on('ReactionRemoved', (message: Message) => {
      this.reactionRemovedHandlers.forEach(handler => handler(message));
    });

    // Pin events - backend sends the updated message
    this.connection.on('MessagePinned', (message: Message) => {
      this.messagePinnedHandlers.forEach(handler => handler(message));
    });

    this.connection.on('MessageUnpinned', (message: Message) => {
      this.messageUnpinnedHandlers.forEach(handler => handler(message));
    });

    // Forward event - sent to the caller after forwarding
    this.connection.on('MessageForwarded', (message: Message) => {
      this.messageForwardedHandlers.forEach(handler => handler(message));
    });

    this.connection.onreconnecting(() => {
      console.log('SignalR reconnecting...');
      this.reconnectingHandlers.forEach(handler => handler());
    });

    this.connection.onreconnected(() => {
      console.log('SignalR reconnected');
      this.connectedHandlers.forEach(handler => handler());
    });

    this.connection.onclose(() => {
      console.log('SignalR disconnected');
      this.disconnectedHandlers.forEach(handler => handler());
    });
  }

  async stop(): Promise<void> {
    // Increment version to invalidate any pending start
    this.connectionVersion++;

    if (this.connection) {
      try {
        await this.connection.stop();
      } catch {
        // Ignore errors during stop
      }
      this.connection = null;
    }
  }

  async sendMessage(request: SendMessageRequest): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    console.log('[SignalR] Sending message:', JSON.stringify(request, null, 2));
    console.log('[SignalR] Connection state:', this.connection?.state);
    try {
      await this.connection!.invoke('SendMessage', request);
      console.log('[SignalR] Message sent successfully');
    } catch (error) {
      console.error('[SignalR] SendMessage failed:', error);
      throw error;
    }
  }

  async editMessage(messageId: string, content: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('EditMessage', messageId, content);
  }

  async deleteMessage(messageId: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('DeleteMessage', messageId);
  }

  async startTyping(chatId: string): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('StartTyping', chatId);
  }

  async stopTyping(chatId: string): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('StopTyping', chatId);
  }

  async markAsRead(chatId: string, messageId?: string): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('MarkAsRead', chatId, messageId);
  }

  async joinChat(chatId: string): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('JoinChat', chatId);
  }

  async leaveChat(chatId: string): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('LeaveChat', chatId);
  }

  // Call methods
  async initiateCall(chatId: string, type: CallType): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('InitiateCall', { chatId, type });
  }

  async acceptCall(callId: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('AcceptCall', callId);
  }

  async declineCall(callId: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('DeclineCall', callId);
  }

  async endCall(callId: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('EndCall', callId);
  }

  async leaveCall(callId: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('LeaveCall', callId);
  }

  async sendOffer(callId: string, targetUserId: string, sdp: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('SendOffer', callId, targetUserId, sdp);
  }

  async sendAnswer(callId: string, targetUserId: string, sdp: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('SendAnswer', callId, targetUserId, sdp);
  }

  async sendIceCandidate(callId: string, targetUserId: string, candidate: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('SendIceCandidate', callId, targetUserId, candidate);
  }

  async toggleMute(callId: string, isMuted: boolean): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('ToggleMute', callId, isMuted);
  }

  async toggleVideo(callId: string, isVideoOn: boolean): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('ToggleVideo', callId, isVideoOn);
  }

  // Pin/Unpin messages
  async pinMessage(messageId: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('PinMessage', messageId);
  }

  async unpinMessage(messageId: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('UnpinMessage', messageId);
  }

  // Reactions
  async addReaction(messageId: string, emoji: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('AddReaction', messageId, emoji);
  }

  async removeReaction(messageId: string, emoji: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('RemoveReaction', messageId, emoji);
  }

  // Forward message
  async forwardMessage(messageId: string, targetChatId: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke('ForwardMessage', messageId, targetChatId);
  }

  // Generic invoke for direct hub method calls
  async invoke(method: string, ...args: unknown[]): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    await this.connection!.invoke(method, ...args);
  }

  // Event subscription methods
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onMessageEdited(handler: MessageEditedHandler): () => void {
    this.messageEditedHandlers.add(handler);
    return () => this.messageEditedHandlers.delete(handler);
  }

  onMessageDeleted(handler: MessageDeletedHandler): () => void {
    this.messageDeletedHandlers.add(handler);
    return () => this.messageDeletedHandlers.delete(handler);
  }

  onTyping(handler: TypingHandler): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  onStoppedTyping(handler: TypingHandler): () => void {
    this.stoppedTypingHandlers.add(handler);
    return () => this.stoppedTypingHandlers.delete(handler);
  }

  onUserStatusChanged(handler: UserStatusHandler): () => void {
    this.userStatusHandlers.add(handler);
    return () => this.userStatusHandlers.delete(handler);
  }

  onMessagesRead(handler: MessagesReadHandler): () => void {
    this.messagesReadHandlers.add(handler);
    return () => this.messagesReadHandlers.delete(handler);
  }

  onConnected(handler: ConnectionHandler): () => void {
    this.connectedHandlers.add(handler);
    return () => this.connectedHandlers.delete(handler);
  }

  onDisconnected(handler: ConnectionHandler): () => void {
    this.disconnectedHandlers.add(handler);
    return () => this.disconnectedHandlers.delete(handler);
  }

  onReconnecting(handler: ConnectionHandler): () => void {
    this.reconnectingHandlers.add(handler);
    return () => this.reconnectingHandlers.delete(handler);
  }

  // Call event subscription methods
  onCallInitiated(handler: CallInitiatedHandler): () => void {
    this.callInitiatedHandlers.add(handler);
    return () => this.callInitiatedHandlers.delete(handler);
  }

  onIncomingCall(handler: IncomingCallHandler): () => void {
    this.incomingCallHandlers.add(handler);
    return () => this.incomingCallHandlers.delete(handler);
  }

  onCallAccepted(handler: CallAcceptedHandler): () => void {
    this.callAcceptedHandlers.add(handler);
    return () => this.callAcceptedHandlers.delete(handler);
  }

  onCallDeclined(handler: CallDeclinedHandler): () => void {
    this.callDeclinedHandlers.add(handler);
    return () => this.callDeclinedHandlers.delete(handler);
  }

  onCallEnded(handler: CallEndedHandler): () => void {
    this.callEndedHandlers.add(handler);
    return () => this.callEndedHandlers.delete(handler);
  }

  onParticipantLeft(handler: ParticipantLeftHandler): () => void {
    this.participantLeftHandlers.add(handler);
    return () => this.participantLeftHandlers.delete(handler);
  }

  onReceiveOffer(handler: ReceiveOfferHandler): () => void {
    this.receiveOfferHandlers.add(handler);
    return () => this.receiveOfferHandlers.delete(handler);
  }

  onReceiveAnswer(handler: ReceiveAnswerHandler): () => void {
    this.receiveAnswerHandlers.add(handler);
    return () => this.receiveAnswerHandlers.delete(handler);
  }

  onReceiveIceCandidate(handler: ReceiveIceCandidateHandler): () => void {
    this.receiveIceCandidateHandlers.add(handler);
    return () => this.receiveIceCandidateHandlers.delete(handler);
  }

  onParticipantMuted(handler: ParticipantMutedHandler): () => void {
    this.participantMutedHandlers.add(handler);
    return () => this.participantMutedHandlers.delete(handler);
  }

  onParticipantVideoChanged(handler: ParticipantVideoChangedHandler): () => void {
    this.participantVideoChangedHandlers.add(handler);
    return () => this.participantVideoChangedHandlers.delete(handler);
  }

  // Reaction/Pin/Forward event subscriptions
  onReactionAdded(handler: ReactionHandler): () => void {
    this.reactionAddedHandlers.add(handler);
    return () => this.reactionAddedHandlers.delete(handler);
  }

  onReactionRemoved(handler: ReactionHandler): () => void {
    this.reactionRemovedHandlers.add(handler);
    return () => this.reactionRemovedHandlers.delete(handler);
  }

  onMessagePinned(handler: MessagePinnedHandler): () => void {
    this.messagePinnedHandlers.add(handler);
    return () => this.messagePinnedHandlers.delete(handler);
  }

  onMessageUnpinned(handler: MessagePinnedHandler): () => void {
    this.messageUnpinnedHandlers.add(handler);
    return () => this.messageUnpinnedHandlers.delete(handler);
  }

  onMessageForwarded(handler: MessageForwardedHandler): () => void {
    this.messageForwardedHandlers.add(handler);
    return () => this.messageForwardedHandlers.delete(handler);
  }

  get isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

export const signalRService = new SignalRService();
