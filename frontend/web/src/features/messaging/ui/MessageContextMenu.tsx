import { useState, useRef, useEffect } from 'react';
import {
  Copy,
  Reply,
  Forward,
  Edit,
  Trash2,
  Pin,
  PinOff,
  SmilePlus,
} from 'lucide-react';
import type { Message, ChatMember } from '@/shared/types';
import { useAuthStore } from '@/entities/user/model/authStore';
import { signalRService } from '@/shared/api/signalr';

interface MessageContextMenuProps {
  message: Message;
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onForward: (message: Message) => void;
  onPin: (message: Message) => void;
  onUnpin: (message: Message) => void;
  onReact: (message: Message) => void;
  onCopy: (message: Message) => void;
  chatMembers?: ChatMember[];
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

function MenuItem({ icon, label, onClick, variant = 'default', disabled = false }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : variant === 'danger'
          ? 'text-red-500 hover:bg-red-500/10'
          : 'hover:bg-[hsl(var(--muted))]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function MessageContextMenu({
  message,
  isOpen,
  position,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onPin,
  onUnpin,
  onReact,
  onCopy,
  chatMembers,
}: MessageContextMenuProps) {
  const { user } = useAuthStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  const isOwnMessage = message.senderId === user?.id;
  const canEdit = isOwnMessage && !message.isDeleted && message.type === 'Text';
  const canDelete = isOwnMessage && !message.isDeleted;

  // Check if user can pin/unpin messages (Owner, Admin, or Moderator)
  const currentMember = chatMembers?.find(m => m.userId === user?.id);
  const canPin = currentMember?.role === 'Owner' || currentMember?.role === 'Admin' || currentMember?.role === 'Moderator';

  // Check if message was sent within 48 hours (edit time limit)
  const isWithinEditLimit = () => {
    const createdAt = new Date(message.createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 48;
  };

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      // Adjust horizontal position
      if (x + rect.width > viewportWidth - 10) {
        x = viewportWidth - rect.width - 10;
      }
      if (x < 10) {
        x = 10;
      }

      // Adjust vertical position
      if (y + rect.height > viewportHeight - 10) {
        y = viewportHeight - rect.height - 10;
      }
      if (y < 10) {
        y = 10;
      }

      setAdjustedPosition({ x, y });
    }
  }, [isOpen, position]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  if (!isOpen) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[180px] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-1 shadow-lg"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        {/* Quick Reactions */}
        <div className="flex items-center justify-around border-b border-[hsl(var(--border))] px-2 py-2">
          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleAction(async () => {
                try {
                  await signalRService.addReaction(message.id, emoji);
                } catch (error) {
                  console.error('Failed to add reaction:', error);
                }
              })}
              className="rounded p-1 text-lg transition-transform hover:scale-125 hover:bg-[hsl(var(--muted))]"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="py-1">
          <MenuItem
            icon={<Reply className="h-4 w-4" />}
            label="Reply"
            onClick={() => handleAction(() => onReply(message))}
          />

          {message.content && (
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              label="Copy"
              onClick={() => handleAction(() => onCopy(message))}
            />
          )}

          <MenuItem
            icon={<Forward className="h-4 w-4" />}
            label="Forward"
            onClick={() => handleAction(() => onForward(message))}
          />

          <MenuItem
            icon={<SmilePlus className="h-4 w-4" />}
            label="React"
            onClick={() => handleAction(() => onReact(message))}
          />

          {canPin && (
            message.isPinned ? (
              <MenuItem
                icon={<PinOff className="h-4 w-4" />}
                label="Unpin"
                onClick={() => handleAction(() => onUnpin(message))}
              />
            ) : (
              <MenuItem
                icon={<Pin className="h-4 w-4" />}
                label="Pin"
                onClick={() => handleAction(() => onPin(message))}
              />
            )
          )}

          {canEdit && (
            <>
              <div className="my-1 border-t border-[hsl(var(--border))]" />
              <MenuItem
                icon={<Edit className="h-4 w-4" />}
                label="Edit"
                onClick={() => handleAction(() => onEdit(message))}
                disabled={!isWithinEditLimit()}
              />
            </>
          )}

          {canDelete && (
            <>
              {!canEdit && <div className="my-1 border-t border-[hsl(var(--border))]" />}
              <MenuItem
                icon={<Trash2 className="h-4 w-4" />}
                label="Delete"
                onClick={() => handleAction(() => onDelete(message))}
                variant="danger"
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}