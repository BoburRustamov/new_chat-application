// WebRTC Configuration

export const ICE_SERVERS: RTCIceServer[] = [
  // Free Google STUN servers
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export const WEBRTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// Media constraints for voice calls
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
};

// Media constraints for video calls
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { min: 320, ideal: 640, max: 1280 },
  height: { min: 240, ideal: 480, max: 720 },
  frameRate: { min: 15, ideal: 24, max: 30 },
  facingMode: 'user',
};

// Get media constraints based on call type
export const getMediaConstraints = (isVideo: boolean): MediaStreamConstraints => ({
  audio: AUDIO_CONSTRAINTS,
  video: isVideo ? VIDEO_CONSTRAINTS : false,
});

// Call timeouts
export const CALL_TIMEOUT_MS = 30000; // 30 seconds to answer
export const ICE_GATHERING_TIMEOUT_MS = 5000; // 5 seconds for ICE gathering
export const RECONNECT_TIMEOUT_MS = 10000; // 10 seconds before reconnect attempt

// Connection states
export const CONNECTION_STATES = {
  NEW: 'new',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
  CLOSED: 'closed',
} as const;

export type ConnectionState = typeof CONNECTION_STATES[keyof typeof CONNECTION_STATES];
