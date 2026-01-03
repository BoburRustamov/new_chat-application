import { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui';
import type { Message } from '@/shared/types';
import { signalRService } from '@/shared/api/signalr';

interface DeleteMessageModalProps {
  message: Message;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteMessageModal({ message, isOpen, onClose, onSuccess }: DeleteMessageModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await signalRService.deleteMessage(message.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to delete message:', err);
      setError('Failed to delete message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getMessagePreview = () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-[hsl(var(--background))] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Delete Message</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-[hsl(var(--muted-foreground))]">
            Are you sure you want to delete this message? This action cannot be undone.
          </p>

          {/* Message Preview */}
          <div className="mt-4 rounded-lg bg-[hsl(var(--secondary))] p-3">
            <p className="text-sm italic text-[hsl(var(--muted-foreground))]">
              "{getMessagePreview()}"
            </p>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[hsl(var(--border))] px-4 py-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={isSubmitting}
            className="bg-red-500 hover:bg-red-600"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Deleting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
