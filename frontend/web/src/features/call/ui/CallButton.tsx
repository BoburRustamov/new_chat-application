import { Phone, Video } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useCallStore } from '@/entities/call/model/callStore';
import type { CallType } from '@/shared/types';

interface CallButtonProps {
  chatId: string;
  type: CallType;
  disabled?: boolean;
}

export function CallButton({ chatId, type, disabled }: CallButtonProps) {
  const { initiateCall, callState } = useCallStore();
  const isInCall = callState !== 'idle';

  const handleClick = async () => {
    if (isInCall || disabled) return;
    await initiateCall(chatId, type);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isInCall || disabled}
      title={type === 'Video' ? 'Start video call' : 'Start voice call'}
    >
      {type === 'Video' ? (
        <Video className="h-5 w-5" />
      ) : (
        <Phone className="h-5 w-5" />
      )}
    </Button>
  );
}
