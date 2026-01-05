import { format } from 'date-fns';
import { Check, CheckCheck, Download, FileText, Image as ImageIcon, Play, Pin, Forward } from 'lucide-react';
import type { Message } from '@/shared/types';
import { useAuthStore } from '@/entities/user/model/authStore';
import { useState } from 'react';

interface MessageBubbleProps {
  message: Message;
  showSender?: boolean;
  onContextMenu?: (message: Message, position: { x: number; y: number }) => void;
  onReply?: (message: Message) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MessageBubble({ message, showSender = false, onContextMenu, onReply }: MessageBubbleProps) {
  const { user } = useAuthStore();
  const isOwn = message.senderId === user?.id;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onContextMenu && !message.isDeleted) {
      onContextMenu(message, { x: e.clientX, y: e.clientY });
    }
  };

  const handleDoubleClick = () => {
    if (onReply && !message.isDeleted) {
      onReply(message);
    }
  };

  const getStatusIcon = () => {
    if (!isOwn) return null;

    switch (message.status) {
      case 'Sending':
        return <div className="h-3 w-3 animate-pulse rounded-full bg-gray-400" />;
      case 'Sent':
        return <Check className="h-3 w-3 text-gray-400" />;
      case 'Delivered':
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case 'Read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  if (message.isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[70%] rounded-2xl bg-[hsl(var(--secondary))] px-4 py-2 italic text-[hsl(var(--muted-foreground))]">
          This message was deleted
        </div>
      </div>
    );
  }

  const getFileUrl = (path: string) => {
    if (path.startsWith('http')) return path;
    // Path already includes /api prefix, so use it directly for relative URLs
    return path;
  };

  const renderContent = () => {
    switch (message.type) {
      case 'Text':
        return <p className="whitespace-pre-wrap break-words">{message.content}</p>;

      case 'Image':
        if (!message.file) return null;
        return (
          <div className="overflow-hidden rounded-lg">
            {!imageLoaded && (
              <div
                className="flex items-center justify-center bg-[hsl(var(--muted))]"
                style={{
                  width: message.file.width ? Math.min(message.file.width, 300) : 200,
                  height: message.file.height ? Math.min(message.file.height, 300) : 150
                }}
              >
                <ImageIcon className="h-8 w-8 text-[hsl(var(--muted-foreground))] animate-pulse" />
              </div>
            )}
            <a
              href={getFileUrl(message.file.downloadUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={getFileUrl(message.file.thumbnailUrl || message.file.downloadUrl)}
                alt={message.file.fileName}
                className={`max-w-[300px] max-h-[300px] object-contain cursor-pointer hover:opacity-90 transition-opacity ${!imageLoaded ? 'hidden' : ''}`}
                onLoad={() => setImageLoaded(true)}
              />
            </a>
            {message.content && (
              <p className="mt-2 whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        );

      case 'Video':
        if (!message.file) return null;
        return (
          <div className="overflow-hidden rounded-lg">
            <div className="relative">
              <video
                src={getFileUrl(message.file.downloadUrl)}
                className="max-w-[300px] max-h-[300px]"
                controls
                preload="metadata"
              />
            </div>
            {message.file.duration && (
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Duration: {formatDuration(message.file.duration)}
              </p>
            )}
            {message.content && (
              <p className="mt-2 whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        );

      case 'Audio':
      case 'Voice':
        if (!message.file) return null;
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white hover:opacity-90 transition-opacity"
              >
                {isPlaying ? (
                  <div className="flex gap-0.5">
                    <span className="h-3 w-1 bg-white rounded animate-pulse" />
                    <span className="h-3 w-1 bg-white rounded animate-pulse delay-75" />
                    <span className="h-3 w-1 bg-white rounded animate-pulse delay-150" />
                  </div>
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </button>
              <div className="flex-1">
                <audio
                  src={getFileUrl(message.file.downloadUrl)}
                  controls
                  className="w-full h-8"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
                {message.file.duration && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {formatDuration(message.file.duration)}
                  </p>
                )}
              </div>
            </div>
            {message.content && (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        );

      case 'File':
        if (!message.file) return null;
        return (
          <div className="flex flex-col gap-2">
            <a
              href={getFileUrl(message.file.downloadUrl)}
              download={message.file.fileName}
              className="flex items-center gap-3 rounded-lg bg-[hsl(var(--muted))] p-3 hover:bg-[hsl(var(--muted))]/80 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.file.fileName}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {formatFileSize(message.file.size)}
                </p>
              </div>
              <Download className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            </a>
            {message.content && (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        );

      default:
        return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex max-w-[70%] flex-col ${isOwn ? 'items-end' : 'items-start'}`}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      >
        {/* Sender name for group chats */}
        {showSender && !isOwn && (
          <span className="mb-1 text-xs font-medium text-[hsl(var(--primary))]">
            {message.senderDisplayName}
          </span>
        )}

        {/* Forwarded indicator */}
        {message.forwardedFromId && (
          <div className="mb-1 flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <Forward className="h-3 w-3" />
            <span>Forwarded message</span>
          </div>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div className="mb-1 max-w-full cursor-pointer rounded-lg border-l-2 border-[hsl(var(--primary))] bg-[hsl(var(--secondary))] px-3 py-1 hover:bg-[hsl(var(--muted))]">
            <p className="truncate text-xs font-medium text-[hsl(var(--primary))]">
              {message.replyTo.senderDisplayName}
            </p>
            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
              {message.replyTo.content || 'Attachment'}
            </p>
          </div>
        )}

        {/* Message content */}
        <div
          className={`relative rounded-2xl px-4 py-2 transition-colors ${
            isOwn
              ? 'bg-[hsl(var(--primary))] text-white'
              : 'bg-[hsl(var(--secondary))]'
          } ${!message.isDeleted ? 'cursor-pointer hover:brightness-95' : ''}`}
        >
          {/* Pinned indicator */}
          {message.isPinned && (
            <div className={`absolute -top-2 ${isOwn ? '-left-2' : '-right-2'}`}>
              <Pin className="h-4 w-4 text-[hsl(var(--primary))] rotate-45" />
            </div>
          )}

          {renderContent()}

          {/* Reactions display */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {message.reactions.map((reaction) => (
                <span
                  key={reaction.emoji}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                    reaction.userIds.includes(user?.id || '')
                      ? 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]'
                      : 'bg-[hsl(var(--muted))]'
                  }`}
                >
                  {reaction.emoji} {reaction.count}
                </span>
              ))}
            </div>
          )}

          {/* Time and status */}
          <div
            className={`mt-1 flex items-center justify-end gap-1 text-xs ${
              isOwn ? 'text-white/70' : 'text-[hsl(var(--muted-foreground))]'
            }`}
          >
            {message.isEdited && <span>edited</span>}
            <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
            {getStatusIcon()}
          </div>
        </div>
      </div>
    </div>
  );
}
