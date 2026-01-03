import { WEBRTC_CONFIG, getMediaConstraints } from '@/shared/config/webrtc';

type OnStreamCallback = (stream: MediaStream) => void;
type OnIceCandidateCallback = (candidate: RTCIceCandidate) => void;
type OnConnectionStateChangeCallback = (state: RTCPeerConnectionState) => void;

export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private onConnectionStateChange: OnConnectionStateChangeCallback | null = null;

  setOnConnectionStateChange(callback: OnConnectionStateChangeCallback): void {
    this.onConnectionStateChange = callback;
  }

  async getLocalStream(isVideo: boolean): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      const constraints = getMediaConstraints(isVideo);
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('Failed to get local media stream:', error);
      throw new Error(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Camera/microphone permission denied'
          : 'Failed to access camera/microphone'
      );
    }
  }

  createPeerConnection(
    userId: string,
    onRemoteStream: OnStreamCallback,
    onIceCandidate: OnIceCandidateCallback
  ): RTCPeerConnection {
    // Close existing connection if any
    this.closeConnection(userId);

    const peerConnection = new RTCPeerConnection(WEBRTC_CONFIG);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        onRemoteStream(event.streams[0]);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state for ${userId}:`, peerConnection.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(peerConnection.connectionState);
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${userId}:`, peerConnection.iceConnectionState);
    };

    this.peerConnections.set(userId, peerConnection);
    return peerConnection;
  }

  getPeerConnection(userId: string): RTCPeerConnection | undefined {
    return this.peerConnections.get(userId);
  }

  async createOffer(userId: string): Promise<RTCSessionDescriptionInit | null> {
    const peerConnection = this.peerConnections.get(userId);
    if (!peerConnection) return null;

    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peerConnection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      return null;
    }
  }

  async createAnswer(userId: string): Promise<RTCSessionDescriptionInit | null> {
    const peerConnection = this.peerConnections.get(userId);
    if (!peerConnection) return null;

    try {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Failed to create answer:', error);
      return null;
    }
  }

  async setRemoteDescription(
    userId: string,
    description: RTCSessionDescriptionInit
  ): Promise<boolean> {
    const peerConnection = this.peerConnections.get(userId);
    if (!peerConnection) return false;

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
      return true;
    } catch (error) {
      console.error('Failed to set remote description:', error);
      return false;
    }
  }

  async addIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<boolean> {
    const peerConnection = this.peerConnections.get(userId);
    if (!peerConnection) return false;

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      return true;
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
      return false;
    }
  }

  addLocalStreamToConnection(userId: string): void {
    const peerConnection = this.peerConnections.get(userId);
    if (!peerConnection || !this.localStream) return;

    this.localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, this.localStream!);
    });
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  closeConnection(userId: string): void {
    const peerConnection = this.peerConnections.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(userId);
    }
  }

  closeAllConnections(): void {
    this.peerConnections.forEach((connection) => {
      connection.close();
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  getConnectionState(userId: string): RTCPeerConnectionState | null {
    const peerConnection = this.peerConnections.get(userId);
    return peerConnection ? peerConnection.connectionState : null;
  }

  getLocalStreamTracks(): { audio: boolean; video: boolean } {
    if (!this.localStream) {
      return { audio: false, video: false };
    }

    return {
      audio: this.localStream.getAudioTracks().length > 0,
      video: this.localStream.getVideoTracks().length > 0,
    };
  }

  async replaceVideoTrack(newStream: MediaStream): Promise<void> {
    const videoTrack = newStream.getVideoTracks()[0];
    if (!videoTrack) return;

    this.peerConnections.forEach((peerConnection) => {
      const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
    });

    // Update local stream
    if (this.localStream) {
      const oldVideoTrack = this.localStream.getVideoTracks()[0];
      if (oldVideoTrack) {
        this.localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      this.localStream.addTrack(videoTrack);
    }
  }

  async getScreenShareStream(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      return stream;
    } catch (error) {
      console.error('Failed to get screen share stream:', error);
      throw new Error('Failed to start screen sharing');
    }
  }
}
