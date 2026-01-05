import { useState, useRef, useEffect, useCallback } from 'react';
import { Square, Send, Trash2, Pause, Play } from 'lucide-react';
import { Button } from '@/shared/ui';
import { apiClient } from '@/shared/api/client';
import type { FileInfo } from '@/shared/types';

interface VoiceRecorderProps {
  onSend: (fileInfo: FileInfo) => void;
  onCancel: () => void;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'recorded';

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setError(null);

      // Check browser support
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        setError('Voice recording is not supported in this browser');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        audioBlobRef.current = audioBlob;
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setRecordingState('recorded');
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setRecordingState('recording');
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const cancelRecording = () => {
    cleanup();
    setRecordingState('idle');
    setDuration(0);
    setAudioUrl(null);
    audioBlobRef.current = null;
    onCancel();
  };

  const sendVoiceMessage = async () => {
    if (!audioBlobRef.current) return;

    setIsUploading(true);
    setError(null);

    try {
      // Create a File object from the Blob
      const file = new File(
        [audioBlobRef.current],
        `voice_message_${Date.now()}.webm`,
        { type: audioBlobRef.current.type }
      );

      // Upload the file
      const response = await apiClient.uploadFile<FileInfo>('/files/upload', file);

      cleanup();
      onSend(response.data);
    } catch (err) {
      console.error('Failed to upload voice message:', err);
      setError('Failed to send voice message. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Auto-start recording when component mounts
  useEffect(() => {
    if (recordingState === 'idle') {
      startRecording();
    }
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-lg bg-[hsl(var(--secondary))] p-3">
      {/* Recording indicator */}
      <div className="flex items-center gap-2">
        {recordingState === 'recording' && (
          <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
        )}
        {recordingState === 'paused' && (
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
        )}
        {recordingState === 'recorded' && (
          <div className="h-3 w-3 rounded-full bg-green-500" />
        )}
      </div>

      {/* Duration */}
      <span className="min-w-[50px] font-mono text-sm">
        {formatDuration(duration)}
      </span>

      {/* Waveform visualization (simplified) */}
      {recordingState === 'recording' && (
        <div className="flex flex-1 items-center gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-4 w-1 animate-pulse rounded-full bg-[hsl(var(--primary))]"
              style={{
                animationDelay: `${i * 50}ms`,
                height: `${Math.random() * 16 + 8}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Audio preview */}
      {recordingState === 'recorded' && audioUrl && (
        <audio src={audioUrl} controls className="h-8 flex-1" />
      )}

      {/* Spacer */}
      {recordingState !== 'recording' && recordingState !== 'recorded' && (
        <div className="flex-1" />
      )}

      {/* Error message */}
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}

      {/* Controls */}
      <div className="flex items-center gap-1">
        {/* Cancel */}
        <Button
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          disabled={isUploading}
          className="text-red-500 hover:text-red-600"
        >
          <Trash2 className="h-5 w-5" />
        </Button>

        {/* Pause/Resume/Stop */}
        {recordingState === 'recording' && (
          <>
            <Button variant="ghost" size="icon" onClick={pauseRecording}>
              <Pause className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={stopRecording}>
              <Square className="h-5 w-5" />
            </Button>
          </>
        )}

        {recordingState === 'paused' && (
          <>
            <Button variant="ghost" size="icon" onClick={resumeRecording}>
              <Play className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={stopRecording}>
              <Square className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Send */}
        {recordingState === 'recorded' && (
          <Button
            size="icon"
            onClick={sendVoiceMessage}
            disabled={isUploading}
          >
            {isUploading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
