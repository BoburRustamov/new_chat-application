import { Phone, Video } from 'lucide-react';
import { useCallStore } from '@/entities/call/model/callStore';
import { CallTimer } from './CallTimer';
import { CallControls } from './CallControls';
import { VideoGrid } from './VideoGrid';

export function CallOverlay() {
  const {
    activeCall,
    callState,
    localStream,
    remoteStreams,
    isMuted,
    isVideoOn,
    callStartTime,
    error,
    toggleMute,
    toggleVideo,
    endCall,
  } = useCallStore();

  if (!activeCall || callState === 'idle') {
    return null;
  }

  const isVideoCall = activeCall.type === 'Video';
  const isConnected = callState === 'connected';
  const isConnecting = callState === 'connecting' || callState === 'initiating' || callState === 'ringing';

  return (
    <div className="fixed inset-0 z-40 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50">
        <div className="flex items-center gap-3">
          {isVideoCall ? (
            <Video className="h-5 w-5 text-blue-400" />
          ) : (
            <Phone className="h-5 w-5 text-green-400" />
          )}
          <div>
            <h3 className="text-white font-medium">
              {activeCall.chatName || activeCall.initiatorName}
            </h3>
            <div className="flex items-center gap-2 text-sm">
              {isConnecting && (
                <span className="text-yellow-400 animate-pulse">
                  {callState === 'ringing' ? 'Ringing...' : 'Connecting...'}
                </span>
              )}
              {isConnected && <CallTimer startTime={callStartTime} />}
              <span className="text-gray-400">
                · {activeCall.participants.filter((p) => !p.leftAt).length} participant(s)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        {isVideoCall ? (
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            participants={activeCall.participants}
            isLocalVideoOn={isVideoOn}
            isLocalMuted={isMuted}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            {/* Voice call UI */}
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6">
              {activeCall.initiatorAvatarUrl ? (
                <img
                  src={activeCall.initiatorAvatarUrl}
                  alt={activeCall.initiatorName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-white">
                  {(activeCall.chatName || activeCall.initiatorName).charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {activeCall.chatName || activeCall.initiatorName}
            </h2>
            {isConnecting && (
              <p className="text-gray-400 animate-pulse">
                {callState === 'ringing' ? 'Ringing...' : 'Connecting...'}
              </p>
            )}
            {isConnected && (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <CallTimer startTime={callStartTime} />
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="py-6 bg-gray-800/50">
        <CallControls
          isMuted={isMuted}
          isVideoOn={isVideoOn}
          isVideoCall={isVideoCall}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEndCall={endCall}
        />
      </div>
    </div>
  );
}
