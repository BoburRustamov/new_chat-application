import { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '@/shared/ui';
import type { Message } from '@/shared/types';
import { signalRService } from '@/shared/api/signalr';

interface EditMessageModalProps {
  message: Message;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditMessageModal({ message, isOpen, onClose, onSuccess }: EditMessageModalProps) {
  const [content, setContent] = useState(message.content || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus and select text when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isOpen]);

  // Reset state when message changes
  useEffect(() => {
    setContent(message.content || '');
    setError(null);
  }, [message]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSubmit = async () => {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      setError('Message cannot be empty');
      return;
    }

    if (trimmedContent === message.content) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await signalRService.editMessage(message.id, trimmedContent);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to edit message:', err);
      setError('Failed to edit message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-[hsl(var(--background))] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
          <h2 className="text-lg font-semibold">Edit Message</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Edit your message..."
            className="max-h-[200px] min-h-[80px] w-full resize-none rounded-lg bg-[hsl(var(--secondary))] px-4 py-3 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />

          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}

          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            Press Enter to save, Shift+Enter for new line, Escape to cancel
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[hsl(var(--border))] px-4 py-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Save
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}