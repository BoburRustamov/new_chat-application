import { useRef, useEffect } from 'react';
import { signalRService } from '@/shared/api/signalr';

interface ReactionPickerProps {
  messageId: string;
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

export function ReactionPicker({ messageId, isOpen, position, onClose }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleReaction = async (emoji: string) => {
    try {
      await signalRService.addReaction(messageId, emoji);
      onClose();
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={pickerRef}
        className="fixed z-50 flex gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 shadow-lg"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -100%)',
        }}
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 hover:bg-[hsl(var(--muted))]"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
