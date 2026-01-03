import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Smile, X, Image, FileText, Music, Video, Reply, Mic } from 'lucide-react';
import { useChatStore } from '@/entities/chat/model/chatStore';
import { Button } from '@/shared/ui';
import { apiClient } from '@/shared/api/client';
import type { FileInfo, MessageType, Message } from '@/shared/types';
import { EmojiPicker } from './EmojiPicker';
import { VoiceRecorder } from './VoiceRecorder';

interface MessageInputProps {
  chatId: string;
  replyToMessage?: Message | null;
  onCancelReply?: () => void;
}

interface PendingFile {
  file: File;
  preview?: string;
  uploadProgress: number;
  isUploading: boolean;
  uploadedFileInfo?: FileInfo;
  error?: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return Image;
  if (contentType.startsWith('video/')) return Video;
  if (contentType.startsWith('audio/')) return Music;
  return FileText;
}

function getMessageType(contentType: string): MessageType {
  if (contentType.startsWith('image/')) return 'Image';
  if (contentType.startsWith('video/')) return 'Video';
  if (contentType.startsWith('audio/')) return 'Audio';
  return 'File';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function MessageInput({ chatId, replyToMessage, onCancelReply }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const { sendMessage, startTyping, stopTyping } = useChatStore();

  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);
      // Restore cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setMessage(prev => prev + emoji);
    }
  }, [message]);

  // Focus input when replying
  useEffect(() => {
    if (replyToMessage && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyToMessage]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (pendingFile?.preview) {
        URL.revokeObjectURL(pendingFile.preview);
      }
    };
  }, [pendingFile?.preview]);

  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      startTyping(chatId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      stopTyping(chatId);
    }, 2000);
  }, [chatId, startTyping, stopTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        stopTyping(chatId);
      }
    };
  }, [chatId, stopTyping]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setPendingFile({
        file,
        uploadProgress: 0,
        isUploading: false,
        error: 'File size exceeds 100MB limit',
      });
      return;
    }

    // Create preview for images
    let preview: string | undefined;
    if (file.type.startsWith('image/')) {
      preview = URL.createObjectURL(file);
    }

    setPendingFile({
      file,
      preview,
      uploadProgress: 0,
      isUploading: true,
    });

    // Start upload
    try {
      const response = await apiClient.uploadFile<FileInfo>(
        '/files/upload',
        file,
        (progress) => {
          setPendingFile((prev) =>
            prev ? { ...prev, uploadProgress: progress } : null
          );
        }
      );

      setPendingFile((prev) =>
        prev
          ? {
              ...prev,
              isUploading: false,
              uploadProgress: 100,
              uploadedFileInfo: response.data,
            }
          : null
      );
    } catch (error) {
      console.error('File upload failed:', error);
      setPendingFile((prev) =>
        prev
          ? {
              ...prev,
              isUploading: false,
              error: 'Upload failed. Please try again.',
            }
          : null
      );
    }
  };

  const removePendingFile = () => {
    if (pendingFile?.preview) {
      URL.revokeObjectURL(pendingFile.preview);
    }
    setPendingFile(null);
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    const hasFile = pendingFile?.uploadedFileInfo;

    if ((!trimmedMessage && !hasFile) || isSending) return;
    if (pendingFile?.isUploading) return;

    setIsSending(true);
    setMessage('');

    // Stop typing indicator
    if (isTypingRef.current) {
      isTypingRef.current = false;
      stopTyping(chatId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    try {
      if (hasFile) {
        // Send file message
        await sendMessage({
          chatId,
          content: trimmedMessage || undefined,
          type: getMessageType(pendingFile.file.type),
          fileId: pendingFile.uploadedFileInfo!.id,
          replyToId: replyToMessage?.id,
        });
        removePendingFile();
      } else {
        // Send text message
        await sendMessage({
          chatId,
          content: trimmedMessage,
          type: 'Text',
          replyToId: replyToMessage?.id,
        });
      }
      // Clear reply after sending
      if (onCancelReply) {
        onCancelReply();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessage(trimmedMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    handleTyping();
  };

  const FileIcon = pendingFile ? getFileIcon(pendingFile.file.type) : FileText;
  const canSend = (message.trim() || pendingFile?.uploadedFileInfo) && !isSending && !pendingFile?.isUploading;

  const handleVoiceSend = async (fileInfo: FileInfo) => {
    setIsVoiceRecording(false);
    setIsSending(true);
    try {
      await sendMessage({
        chatId,
        type: 'Audio',
        fileId: fileInfo.id,
        replyToId: replyToMessage?.id,
      });
      if (onCancelReply) {
        onCancelReply();
      }
    } catch (error) {
      console.error('Failed to send voice message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleVoiceCancel = () => {
    setIsVoiceRecording(false);
  };

  // Show voice recorder if recording
  if (isVoiceRecording) {
    return (
      <div className="border-t border-[hsl(var(--border))] p-4">
        {/* Reply preview while voice recording */}
        {replyToMessage && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-[hsl(var(--secondary))] p-3">
            <Reply className="h-5 w-5 text-[hsl(var(--primary))]" />
            <div className="flex-1 min-w-0 border-l-2 border-[hsl(var(--primary))] pl-3">
              <p className="text-sm font-medium text-[hsl(var(--primary))]">
                {replyToMessage.senderDisplayName}
              </p>
              <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">
                {replyToMessage.content || `[${replyToMessage.type}]`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancelReply}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <VoiceRecorder onSend={handleVoiceSend} onCancel={handleVoiceCancel} />
      </div>
    );
  }

  return (
    <div className="border-t border-[hsl(var(--border))] p-4">
      {/* Reply preview */}
      {replyToMessage && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-[hsl(var(--secondary))] p-3">
          <Reply className="h-5 w-5 text-[hsl(var(--primary))]" />
          <div className="flex-1 min-w-0 border-l-2 border-[hsl(var(--primary))] pl-3">
            <p className="text-sm font-medium text-[hsl(var(--primary))]">
              {replyToMessage.senderDisplayName}
            </p>
            <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">
              {replyToMessage.content || `[${replyToMessage.type}]`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancelReply}
            className="flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* File preview */}
      {pendingFile && (
        <div className="mb-3 rounded-lg bg-[hsl(var(--secondary))] p-3">
          <div className="flex items-start gap-3">
            {/* Preview or icon */}
            {pendingFile.preview ? (
              <img
                src={pendingFile.preview}
                alt="Preview"
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
                <FileIcon className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
              </div>
            )}

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{pendingFile.file.name}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {formatFileSize(pendingFile.file.size)}
              </p>

              {/* Upload progress or error */}
              {pendingFile.isUploading && (
                <div className="mt-2">
                  <div className="h-1.5 w-full rounded-full bg-[hsl(var(--muted))]">
                    <div
                      className="h-1.5 rounded-full bg-[hsl(var(--primary))] transition-all"
                      style={{ width: `${pendingFile.uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    Uploading... {pendingFile.uploadProgress}%
                  </p>
                </div>
              )}

              {pendingFile.error && (
                <p className="mt-1 text-xs text-red-500">{pendingFile.error}</p>
              )}

              {pendingFile.uploadedFileInfo && !pendingFile.error && (
                <p className="mt-1 text-xs text-green-500">Ready to send</p>
              )}
            </div>

            {/* Remove button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={removePendingFile}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        />

        {/* Attachment button */}
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={!!pendingFile}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        {/* Emoji button */}
        <div className="relative">
          <Button
            ref={emojiButtonRef}
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
          >
            <Smile className="h-5 w-5" />
          </Button>

          {/* Emoji Picker */}
          <EmojiPicker
            isOpen={isEmojiPickerOpen}
            onClose={() => setIsEmojiPickerOpen(false)}
            onSelect={handleEmojiSelect}
          />
        </div>

        {/* Message input */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={pendingFile ? 'Add a caption...' : 'Type a message...'}
            rows={1}
            className="max-h-[150px] w-full resize-none rounded-lg bg-[hsl(var(--secondary))] px-4 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        {/* Voice record / Send button */}
        {message.trim() || pendingFile ? (
          <Button
            onClick={handleSend}
            disabled={!canSend}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            onClick={() => setIsVoiceRecording(true)}
            size="icon"
            className="flex-shrink-0"
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
