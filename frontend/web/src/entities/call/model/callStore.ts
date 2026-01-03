import { create } from 'zustand';
import type {
  Call,
  CallState,
  CallType,
  IncomingCallEvent,
  CallAcceptedEvent,
  CallEndedEvent,
  ParticipantLeftEvent,
  ReceiveOfferEvent,
  ReceiveAnswerEvent,
  ReceiveIceCandidateEvent,
  ParticipantMutedEvent,
  ParticipantVideoChangedEvent,
} from '@/shared/types';
import { signalRService } from '@/shared/api/signalr';
import { WebRTCService } from '@/features/call/model/webrtcService';

interface CallStore {
  // State
  activeCall: Call | null;
  callState: CallState;
  incomingCall: IncomingCallEvent | null;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isVideoOn: boolean;
  callStartTime: Date | null;
  error: string | null;

  // WebRTC service instance
  webrtcService: WebRTCService | null;

  // Actions
  initiateCall: (chatId: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;

  // Internal actions
  setActiveCall: (call: Call | null) => void;
  setCallState: (state: CallState) => void;
  setIncomingCall: (event: IncomingCallEvent | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  addRemoteStream: (userId: string, stream: MediaStream) => void;
  removeRemoteStream: (userId: string) => void;
  setError: (error: string | null) => void;
  cleanup: () => void;

  // SignalR event handlers
  handleCallInitiated: (call: Call) => void;
  handleIncomingCall: (event: IncomingCallEvent) => void;
  handleCallAccepted: (event: CallAcceptedEvent) => void;
  handleCallDeclined: () => void;
  handleCallEnded: (event: CallEndedEvent) => void;
  handleParticipantLeft: (event: ParticipantLeftEvent) => void;
  handleReceiveOffer: (event: ReceiveOfferEvent) => void;
  handleReceiveAnswer: (event: ReceiveAnswerEvent) => void;
  handleReceiveIceCandidate: (event: ReceiveIceCandidateEvent) => void;
  handleParticipantMuted: (event: ParticipantMutedEvent) => void;
  handleParticipantVideoChanged: (event: ParticipantVideoChangedEvent) => void;

  // Initialize SignalR handlers
  initializeCallHandlers: () => () => void;
}

export const useCallStore = create<CallStore>((set, get) => ({
  // Initial state
  activeCall: null,
  callState: 'idle',
  incomingCall: null,
  localStream: null,
  remoteStreams: new Map(),
  isMuted: false,
  isVideoOn: true,
  callStartTime: null,
  error: null,
  webrtcService: null,

  // Actions
  initiateCall: async (chatId: string, type: CallType) => {
    try {
      set({ callState: 'initiating', error: null, isVideoOn: type === 'Video' });

      // Create WebRTC service
      const webrtcService = new WebRTCService();
      set({ webrtcService });

      // Get local media stream
      const stream = await webrtcService.getLocalStream(type === 'Video');
      set({ localStream: stream });

      // Initiate call via SignalR
      await signalRService.initiateCall(chatId, type);
    } catch (error) {
      console.error('Failed to initiate call:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to initiate call',
        callState: 'idle',
      });
      get().cleanup();
    }
  },

  acceptCall: async () => {
    const { incomingCall, webrtcService: existingService } = get();
    if (!incomingCall) return;

    try {
      set({ callState: 'connecting', error: null, isVideoOn: incomingCall.call.type === 'Video' });

      // Create WebRTC service if not exists
      let webrtcService = existingService;
      if (!webrtcService) {
        webrtcService = new WebRTCService();
        set({ webrtcService });
      }

      // Get local media stream
      const stream = await webrtcService.getLocalStream(incomingCall.call.type === 'Video');
      set({ localStream: stream });

      // Accept call via SignalR
      await signalRService.acceptCall(incomingCall.call.id);
      set({ incomingCall: null, activeCall: incomingCall.call });
    } catch (error) {
      console.error('Failed to accept call:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to accept call',
        callState: 'idle',
        incomingCall: null,
      });
      get().cleanup();
    }
  },

  declineCall: () => {
    const { incomingCall } = get();
    if (!incomingCall) return;

    signalRService.declineCall(incomingCall.call.id);
    set({ incomingCall: null, callState: 'idle' });
  },

  endCall: () => {
    const { activeCall } = get();
    if (!activeCall) return;

    signalRService.endCall(activeCall.id);
    get().cleanup();
  },

  leaveCall: () => {
    const { activeCall } = get();
    if (!activeCall) return;

    signalRService.leaveCall(activeCall.id);
    get().cleanup();
  },

  toggleMute: () => {
    const { activeCall, isMuted, localStream } = get();
    if (!activeCall || !localStream) return;

    const newMutedState = !isMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !newMutedState;
    });

    set({ isMuted: newMutedState });
    signalRService.toggleMute(activeCall.id, newMutedState);
  },

  toggleVideo: () => {
    const { activeCall, isVideoOn, localStream } = get();
    if (!activeCall || !localStream) return;

    const newVideoState = !isVideoOn;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = newVideoState;
    });

    set({ isVideoOn: newVideoState });
    signalRService.toggleVideo(activeCall.id, newVideoState);
  },

  // Internal actions
  setActiveCall: (call) => set({ activeCall: call }),
  setCallState: (state) => set({ callState: state }),
  setIncomingCall: (event) => set({ incomingCall: event }),
  setLocalStream: (stream) => set({ localStream: stream }),

  addRemoteStream: (userId, stream) => {
    set((state) => {
      const newStreams = new Map(state.remoteStreams);
      newStreams.set(userId, stream);
      return { remoteStreams: newStreams };
    });
  },

  removeRemoteStream: (userId) => {
    set((state) => {
      const newStreams = new Map(state.remoteStreams);
      newStreams.delete(userId);
      return { remoteStreams: newStreams };
    });
  },

  setError: (error) => set({ error }),

  cleanup: () => {
    const { localStream, webrtcService } = get();

    // Stop local stream tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Close WebRTC connections
    if (webrtcService) {
      webrtcService.closeAllConnections();
    }

    set({
      activeCall: null,
      callState: 'idle',
      incomingCall: null,
      localStream: null,
      remoteStreams: new Map(),
      isMuted: false,
      isVideoOn: true,
      callStartTime: null,
      error: null,
      webrtcService: null,
    });
  },

  // SignalR event handlers
  handleCallInitiated: (call) => {
    set({
      activeCall: call,
      callState: 'ringing',
      callStartTime: new Date(),
    });
  },

  handleIncomingCall: (event) => {
    const { callState } = get();
    // Only show incoming call if not already in a call
    if (callState === 'idle') {
      set({ incomingCall: event, callState: 'ringing' });
    }
  },

  handleCallAccepted: async (event) => {
    const { activeCall, webrtcService, localStream } = get();
    if (!activeCall || !webrtcService || !localStream) return;

    try {
      set({ callState: 'connecting' });

      // Update active call with new participant
      set({
        activeCall: event.call,
      });

      // Create peer connection for the new participant
      const peerConnection = webrtcService.createPeerConnection(
        event.userId,
        (stream) => get().addRemoteStream(event.userId, stream),
        (candidate) => signalRService.sendIceCandidate(activeCall.id, event.userId, JSON.stringify(candidate))
      );

      // Add local stream to connection
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      // Create and send offer (if we're the initiator)
      const currentUserId = localStorage.getItem('userId');
      if (currentUserId && activeCall.initiatorId === currentUserId) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        await signalRService.sendOffer(activeCall.id, event.userId, JSON.stringify(offer));
      }

      set({ callState: 'connected', callStartTime: new Date() });
    } catch (error) {
      console.error('Failed to handle call accepted:', error);
      set({ error: 'Failed to establish connection' });
    }
  },

  handleCallDeclined: () => {
    const { callState } = get();
    if (callState === 'ringing' || callState === 'initiating') {
      set({ error: 'Call was declined' });
      get().cleanup();
    }
  },

  handleCallEnded: (event) => {
    set({ activeCall: event.call });
    get().cleanup();
  },

  handleParticipantLeft: (event) => {
    const { webrtcService } = get();
    if (webrtcService) {
      webrtcService.closeConnection(event.userId);
    }
    get().removeRemoteStream(event.userId);
    set({ activeCall: event.call });

    // If no participants left, end the call
    const activeParticipants = event.call.participants.filter((p) => !p.leftAt);
    if (activeParticipants.length <= 1) {
      get().cleanup();
    }
  },

  handleReceiveOffer: async (event) => {
    const { activeCall, webrtcService, localStream } = get();
    if (!activeCall || !webrtcService || !localStream) return;

    try {
      // Create peer connection for the caller
      const peerConnection = webrtcService.createPeerConnection(
        event.fromUserId,
        (stream) => get().addRemoteStream(event.fromUserId, stream),
        (candidate) => signalRService.sendIceCandidate(activeCall.id, event.fromUserId, JSON.stringify(candidate))
      );

      // Add local stream
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      // Set remote description (the offer)
      const offer = JSON.parse(event.sdp) as RTCSessionDescriptionInit;
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await signalRService.sendAnswer(activeCall.id, event.fromUserId, JSON.stringify(answer));

      set({ callState: 'connected', callStartTime: new Date() });
    } catch (error) {
      console.error('Failed to handle offer:', error);
      set({ error: 'Failed to establish connection' });
    }
  },

  handleReceiveAnswer: async (event) => {
    const { webrtcService } = get();
    if (!webrtcService) return;

    try {
      const peerConnection = webrtcService.getPeerConnection(event.fromUserId);
      if (peerConnection) {
        const answer = JSON.parse(event.sdp) as RTCSessionDescriptionInit;
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  },

  handleReceiveIceCandidate: async (event) => {
    const { webrtcService } = get();
    if (!webrtcService) return;

    try {
      const peerConnection = webrtcService.getPeerConnection(event.fromUserId);
      if (peerConnection) {
        const candidate = JSON.parse(event.candidate) as RTCIceCandidateInit;
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  },

  handleParticipantMuted: (event) => {
    set((state) => {
      if (!state.activeCall) return state;
      const participants = state.activeCall.participants.map((p) =>
        p.userId === event.userId ? { ...p, isMuted: event.isMuted } : p
      );
      return {
        activeCall: { ...state.activeCall, participants },
      };
    });
  },

  handleParticipantVideoChanged: (event) => {
    set((state) => {
      if (!state.activeCall) return state;
      const participants = state.activeCall.participants.map((p) =>
        p.userId === event.userId ? { ...p, isVideoOn: event.isVideoOn } : p
      );
      return {
        activeCall: { ...state.activeCall, participants },
      };
    });
  },

  // Initialize SignalR handlers
  initializeCallHandlers: () => {
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(signalRService.onCallInitiated(get().handleCallInitiated));
    unsubscribers.push(signalRService.onIncomingCall(get().handleIncomingCall));
    unsubscribers.push(signalRService.onCallAccepted(get().handleCallAccepted));
    unsubscribers.push(signalRService.onCallDeclined(get().handleCallDeclined));
    unsubscribers.push(signalRService.onCallEnded(get().handleCallEnded));
    unsubscribers.push(signalRService.onParticipantLeft(get().handleParticipantLeft));
    unsubscribers.push(signalRService.onReceiveOffer(get().handleReceiveOffer));
    unsubscribers.push(signalRService.onReceiveAnswer(get().handleReceiveAnswer));
    unsubscribers.push(signalRService.onReceiveIceCandidate(get().handleReceiveIceCandidate));
    unsubscribers.push(signalRService.onParticipantMuted(get().handleParticipantMuted));
    unsubscribers.push(signalRService.onParticipantVideoChanged(get().handleParticipantVideoChanged));

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  },
}));
