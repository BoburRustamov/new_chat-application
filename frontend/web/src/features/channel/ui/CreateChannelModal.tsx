import { useState } from 'react';
import { X, Megaphone, Lock, Globe, Loader2 } from 'lucide-react';
import { useChannelStore } from '@/entities/channel';
import type { CreateChannelRequest } from '@/shared/types';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (channelId: string, chatId: string) => void;
}

export function CreateChannelModal({ isOpen, onClose, onSuccess }: CreateChannelModalProps) {
  const { createChannel, isLoading } = useChannelStore();
  const [formData, setFormData] = useState<CreateChannelRequest>({
    name: '',
    username: '',
    description: '',
    isPublic: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Channel name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Channel name must be at least 3 characters';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 5) {
      newErrors.username = 'Username must be at least 5 characters';
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(formData.username)) {
      newErrors.username = 'Username must start with a letter and contain only letters, numbers, and underscores';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const channel = await createChannel(formData);
      onSuccess?.(channel.id, channel.chatId);
      handleClose();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        if (axiosError.response?.data?.message?.includes('username')) {
          setErrors({ username: 'This username is already taken' });
        } else {
          setErrors({ submit: 'Failed to create channel. Please try again.' });
        }
      } else {
        setErrors({ submit: 'Failed to create channel. Please try again.' });
      }
    }
  };

  const handleClose = () => {
    setFormData({ name: '', username: '', description: '', isPublic: true });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-[hsl(var(--background))] shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold">Create Channel</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 hover:bg-[hsl(var(--secondary))]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          {/* Channel Name */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Channel Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Awesome Channel"
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Username */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Username</label>
            <div className="flex items-center">
              <span className="rounded-l-lg border border-r-0 border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                @
              </span>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                placeholder="myawesomechannel"
                className="w-full rounded-r-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-xs text-red-500">{errors.username}</p>
            )}
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              People can find and join your channel using this username
            </p>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What's your channel about?"
              rows={3}
              className="w-full resize-none rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          {/* Visibility */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium">Channel Type</label>
            <div className="space-y-2">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                  formData.isPublic
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10'
                    : 'border-[hsl(var(--border))]'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={formData.isPublic}
                  onChange={() => setFormData({ ...formData, isPublic: true })}
                  className="hidden"
                />
                <Globe className="h-5 w-5 text-[hsl(var(--primary))]" />
                <div>
                  <p className="font-medium">Public</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Anyone can find and join this channel
                  </p>
                </div>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                  !formData.isPublic
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10'
                    : 'border-[hsl(var(--border))]'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={!formData.isPublic}
                  onChange={() => setFormData({ ...formData, isPublic: false })}
                  className="hidden"
                />
                <Lock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                <div>
                  <p className="font-medium">Private</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Only people with an invite link can join
                  </p>
                </div>
              </label>
            </div>
          </div>

          {errors.submit && (
            <p className="mb-4 text-center text-sm text-red-500">{errors.submit}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-[hsl(var(--border))] py-2 text-sm font-medium hover:bg-[hsl(var(--secondary))]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] py-2 text-sm font-medium text-white hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Channel'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
