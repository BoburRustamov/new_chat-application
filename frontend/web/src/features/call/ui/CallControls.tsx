import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { Button } from '@/shared/ui';

interface CallControlsProps {
  isMuted: boolean;
  isVideoOn: boolean;
  isVideoCall: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

export function CallControls({
  isMuted,
  isVideoOn,
  isVideoCall,
  onToggleMute,
  onToggleVideo,
  onEndCall,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        variant="outline"
        size="icon"
        className={`h-14 w-14 rounded-full ${
          isMuted
            ? 'bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30'
            : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
        }`}
        onClick={onToggleMute}
      >
        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </Button>

      {isVideoCall && (
        <Button
          variant="outline"
          size="icon"
          className={`h-14 w-14 rounded-full ${
            !isVideoOn
              ? 'bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30'
              : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
          }`}
          onClick={onToggleVideo}
        >
          {isVideoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </Button>
      )}

      <Button
        variant="destructive"
        size="icon"
        className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700"
        onClick={onEndCall}
      >
        <PhoneOff className="h-6 w-6" />
      </Button>
    </div>
  );
}
