import { useEffect, useRef } from 'react';
import { MicOff, VideoOff } from 'lucide-react';
import type { CallParticipant } from '@/shared/types';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: CallParticipant[];
  isLocalVideoOn: boolean;
  isLocalMuted: boolean;
}

interface VideoTileProps {
  stream: MediaStream | null;
  participant?: CallParticipant;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOn?: boolean;
  name?: string;
}

function VideoTile({ stream, participant, isLocal, isMuted, isVideoOn, name }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const displayName = isLocal ? 'You' : (participant?.displayName || name || 'Participant');
  const showVideo = isLocal ? isVideoOn : (participant?.isVideoOn ?? true);
  const showMuted = isLocal ? isMuted : participant?.isMuted;

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
      {showVideo && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'transform scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
          <div className="w-20 h-20 rounded-full bg-gray-600 flex items-center justify-center">
            <span className="text-2xl font-semibold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="text-sm text-white bg-black/50 px-2 py-1 rounded">
          {displayName}
        </span>
        <div className="flex gap-1">
          {showMuted && (
            <span className="bg-red-500/80 p-1 rounded">
              <MicOff className="h-4 w-4 text-white" />
            </span>
          )}
          {!showVideo && (
            <span className="bg-red-500/80 p-1 rounded">
              <VideoOff className="h-4 w-4 text-white" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function VideoGrid({
  localStream,
  remoteStreams,
  participants,
  isLocalVideoOn,
  isLocalMuted,
}: VideoGridProps) {
  const totalParticipants = remoteStreams.size + 1; // +1 for local

  const getGridClass = () => {
    if (totalParticipants === 1) return 'grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
  };

  return (
    <div className={`grid ${getGridClass()} gap-4 h-full p-4`}>
      {/* Remote streams */}
      {Array.from(remoteStreams.entries()).map(([userId, stream]) => {
        const participant = participants.find((p) => p.userId === userId);
        return (
          <VideoTile
            key={userId}
            stream={stream}
            participant={participant}
          />
        );
      })}

      {/* Local stream - shown smaller if there are remote streams */}
      <div className={remoteStreams.size > 0 ? '' : 'col-span-full'}>
        <VideoTile
          stream={localStream}
          isLocal
          isMuted={isLocalMuted}
          isVideoOn={isLocalVideoOn}
        />
      </div>
    </div>
  );
}
