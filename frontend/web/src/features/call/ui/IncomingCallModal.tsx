import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/shared/ui';
import type { IncomingCallEvent } from '@/shared/types';
import { useEffect } from 'react';

interface IncomingCallModalProps {
  callEvent: IncomingCallEvent;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({ callEvent, onAccept, onDecline }: IncomingCallModalProps) {
  useEffect(() => {
    // Create a simple ringtone using Web Audio API
    const audioContext = new AudioContext();
    let oscillator: OscillatorNode | null = null;
    let gainNode: GainNode | null = null;

    const playRingtone = () => {
      oscillator = audioContext.createOscillator();
      gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;

      oscillator.start();

      // Pulse the tone
      const pulseInterval = setInterval(() => {
        if (gainNode) {
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        }
      }, 1000);

      return () => {
        clearInterval(pulseInterval);
        oscillator?.stop();
        audioContext.close();
      };
    };

    const cleanup = playRingtone();
    return cleanup;
  }, []);

  const isVideoCall = callEvent.call.type === 'Video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
        {/* Caller avatar */}
        <div className="relative mb-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
            {callEvent.callerAvatarUrl ? (
              <img
                src={callEvent.callerAvatarUrl}
                alt={callEvent.callerName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-white">
                {callEvent.callerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            <span className="bg-gray-800 px-3 py-1 rounded-full text-xs text-gray-300 flex items-center gap-1">
              {isVideoCall ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
              {isVideoCall ? 'Video Call' : 'Voice Call'}
            </span>
          </div>
        </div>

        {/* Caller info */}
        <h2 className="text-xl font-semibold text-white mb-2">{callEvent.callerName}</h2>
        <p className="text-gray-400 mb-8">Incoming {isVideoCall ? 'video' : 'voice'} call...</p>

        {/* Action buttons */}
        <div className="flex justify-center gap-8">
          <Button
            variant="destructive"
            size="icon"
            className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700"
            onClick={onDecline}
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
          <Button
            size="icon"
            className="h-16 w-16 rounded-full bg-green-600 hover:bg-green-700"
            onClick={onAccept}
          >
            {isVideoCall ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
