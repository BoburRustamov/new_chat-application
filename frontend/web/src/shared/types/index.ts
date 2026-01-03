export interface User {
  id: string;
  email: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  isOnline: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
  username: string;
}

export type ChatType = 'Private' | 'Group' | 'Channel';

export interface Chat {
  id: string;
  type: ChatType;
  name?: string;
  description?: string;
  avatarUrl?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: Message;
  unreadCount: number;
  members: ChatMember[];
  isPinned?: boolean;
  isMuted?: boolean;
}

export interface ChatMember {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: 'Owner' | 'Admin' | 'Moderator' | 'Member';
  joinedAt: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

export type MessageStatus = 'Sending' | 'Sent' | 'Delivered' | 'Read';
export type MessageType = 'Text' | 'Image' | 'Video' | 'Audio' | 'Voice' | 'File' | 'System';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl?: string;
  content?: string;
  type: MessageType;
  fileId?: string;
  replyToId?: string;
  forwardedFromId?: string;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isPinned: boolean;
  pinnedAt?: string;
  createdAt: string;
  updatedAt: string;
  replyTo?: Message;
  file?: FileInfo;
  reactions?: ReactionGroup[];
  status: MessageStatus;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface FileInfo {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  downloadUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SendMessageRequest {
  chatId: string;
  content?: string;
  type?: MessageType;
  fileId?: string;
  replyToId?: string;
}

export interface TypingEvent {
  chatId: string;
  userId: string;
  userName: string;
}

export interface UserStatusEvent {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

export interface MessageDeletedEvent {
  messageId: string;
  chatId: string;
}

export interface MessagesReadEvent {
  chatId: string;
  userId: string;
  messageId?: string;
}

// Call Types
export type CallType = 'Voice' | 'Video';
export type CallStatus = 'Active' | 'Ended' | 'Missed';
export type CallState = 'idle' | 'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended';

export interface CallParticipant {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: string;
  leftAt?: string;
  isMuted: boolean;
  isVideoOn: boolean;
}

export interface Call {
  id: string;
  chatId: string;
  chatName?: string;
  initiatorId: string;
  initiatorName: string;
  initiatorAvatarUrl?: string;
  type: CallType;
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  participants: CallParticipant[];
}

export interface InitiateCallRequest {
  chatId: string;
  type: CallType;
}

// Call SignalR Events
export interface IncomingCallEvent {
  call: Call;
  callerName: string;
  callerAvatarUrl?: string;
}

export interface CallAcceptedEvent {
  callId: string;
  userId: string;
  userName: string;
  call: Call;
}

export interface CallDeclinedEvent {
  callId: string;
  declinedBy: string;
}

export interface CallEndedEvent {
  callId: string;
  endedBy: string;
  call: Call;
}

export interface ParticipantLeftEvent {
  callId: string;
  userId: string;
  call: Call;
}

export interface ReceiveOfferEvent {
  callId: string;
  fromUserId: string;
  sdp: string;
}

export interface ReceiveAnswerEvent {
  callId: string;
  fromUserId: string;
  sdp: string;
}

export interface ReceiveIceCandidateEvent {
  callId: string;
  fromUserId: string;
  candidate: string;
}

export interface ParticipantMutedEvent {
  callId: string;
  userId: string;
  isMuted: boolean;
}

export interface ParticipantVideoChangedEvent {
  callId: string;
  userId: string;
  isVideoOn: boolean;
}

// Reaction & Pin Events
export interface ReactionEvent {
  chatId: string;
  messageId: string;
  message: Message;
}

export interface MessagePinnedEvent {
  chatId: string;
  messageId: string;
  message: Message;
}

export interface MessageForwardedEvent {
  chatId: string;
  message: Message;
}
