const ACK_TIMEOUT_MS = 10000;

function browserRuntime() {
  return typeof window === 'undefined' ? {} : window;
}

export const BROWSER_CALL_STATES = Object.freeze({
  PREPARING: 'PREPARING',
  RINGING: 'RINGING',
  CONNECTING: 'CONNECTING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
});

export function createCallEventId(runtime = browserRuntime()) {
  return runtime.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function emitCallEvent(socket, eventName, payload, timeoutMs = ACK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('call_signaling_unavailable'));
      return;
    }
    const timer = setTimeout(() => reject(new Error('call_signaling_timeout')), timeoutMs);
    socket.emit(eventName, payload, (response = {}) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

export async function requestBrowserCallMedia(mediaType = 'audio', runtime = browserRuntime()) {
  if (typeof runtime?.navigator?.mediaDevices?.getUserMedia !== 'function') {
    throw new Error('browser_call_unsupported');
  }
  return runtime.navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: mediaType === 'video' ? {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    } : false,
  });
}

export function requestBrowserMicrophone(runtime = browserRuntime()) {
  return requestBrowserCallMedia('audio', runtime);
}

export function browserCallErrorMessage(error, mediaType = 'audio') {
  const code = error?.code || error?.message || error?.name;
  if (error?.name === 'NotAllowedError' || code === 'NotAllowedError') {
    return mediaType === 'video'
      ? 'Geef Pulse toegang tot je camera en microfoon om te videobellen.'
      : 'Geef Pulse toegang tot je microfoon om te bellen.';
  }
  if (error?.name === 'NotFoundError' || code === 'NotFoundError') {
    return mediaType === 'video'
      ? 'Er is geen camera of microfoon gevonden.'
      : 'Er is geen microfoon gevonden.';
  }
  if (code === 'BUSY' || code === 'call_already_active') return 'Er is al een actief gesprek.';
  if (code === 'RATE_LIMITED') return 'Je hebt in korte tijd te vaak gebeld. Probeer het later opnieuw.';
  if (code === 'NOT_AVAILABLE') return 'Dit contact kan niet worden gebeld.';
  if (code === 'browser_call_unsupported') return 'Deze browser ondersteunt Pulse-oproepen niet.';
  if (code === 'call_ice_unavailable' || code === 'media_error') {
    return 'De audio- en videoverbinding kon niet worden opgebouwd.';
  }
  return 'De oproepverbinding met Pulse is verbroken.';
}

export class BrowserCallMediaSession {
  constructor({ socket, session, localUid, localStream, callbacks = {}, runtime = browserRuntime() }) {
    this.socket = socket;
    this.session = session;
    this.localUid = localUid;
    this.localStream = localStream;
    this.callbacks = callbacks;
    this.runtime = runtime;
    this.connection = null;
    this.remoteCandidateQueue = [];
    this.connectedReported = false;
    this.closed = false;
  }

  async start(iceServers) {
    if (this.connection || this.closed) return;
    const connection = new this.runtime.RTCPeerConnection({ iceServers });
    this.connection = connection;
    this.localStream.getTracks().forEach((track) => connection.addTrack(track, this.localStream));

    connection.onicecandidate = ({ candidate }) => {
      if (!candidate || this.closed) return;
      this.sendMedia({
        type: 'candidate',
        candidate: {
          mediaStreamId: candidate.sdpMid ?? null,
          mediaLineIndex: candidate.sdpMLineIndex ?? 0,
          value: candidate.candidate,
        },
      }).catch(() => this.callbacks.onFailure?.('signaling_error'));
    };
    connection.ontrack = ({ streams, track }) => {
      const [providedStream] = streams;
      const remoteStream = providedStream
        || (track && typeof this.runtime.MediaStream === 'function'
          ? new this.runtime.MediaStream([track])
          : null);
      if (remoteStream) this.callbacks.onRemoteStream?.(remoteStream);
    };
    connection.onconnectionstatechange = () => {
      if (this.closed) return;
      if (connection.connectionState === 'connected' && !this.connectedReported) {
        this.connectedReported = true;
        this.callbacks.onConnected?.();
      } else if (connection.connectionState === 'disconnected') {
        this.callbacks.onReconnecting?.();
      } else if (connection.connectionState === 'failed') {
        this.callbacks.onFailure?.('media_error');
      }
    };

    if (this.session.callerUid === this.localUid) {
      const offer = await connection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.session.mediaType === 'video',
      });
      await connection.setLocalDescription(offer);
      await this.sendMedia({ type: 'offer', description: offer.sdp });
    }
  }

  async handleSignal(signal) {
    if (!this.connection || this.closed || signal.sessionId !== this.session.sessionId) return false;
    if (signal.type === 'candidate') {
      const candidate = new this.runtime.RTCIceCandidate({
        sdpMid: signal.candidate?.mediaStreamId ?? null,
        sdpMLineIndex: signal.candidate?.mediaLineIndex ?? 0,
        candidate: signal.candidate?.value || '',
      });
      if (!this.connection.remoteDescription) {
        this.remoteCandidateQueue.push(candidate);
      } else {
        await this.connection.addIceCandidate(candidate);
      }
      return true;
    }

    if (signal.type !== 'offer' && signal.type !== 'answer') return false;
    await this.connection.setRemoteDescription({ type: signal.type, sdp: signal.description });
    const queued = this.remoteCandidateQueue.splice(0);
    await Promise.all(queued.map((candidate) => this.connection.addIceCandidate(candidate)));
    if (signal.type === 'offer') {
      const answer = await this.connection.createAnswer();
      await this.connection.setLocalDescription(answer);
      await this.sendMedia({ type: 'answer', description: answer.sdp });
    }
    return true;
  }

  setMuted(muted) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  setVideoEnabled(enabled) {
    this.localStream?.getVideoTracks?.().forEach((track) => {
      track.enabled = enabled;
    });
  }

  async restartIce() {
    if (!this.connection || this.closed) return;
    this.connectedReported = false;
    this.connection.restartIce?.();
    if (this.session.callerUid === this.localUid) {
      const offer = await this.connection.createOffer({
        iceRestart: true,
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.session.mediaType === 'video',
      });
      await this.connection.setLocalDescription(offer);
      await this.sendMedia({ type: 'offer', description: offer.sdp });
    }
  }

  async sendMedia(payload) {
    const response = await emitCallEvent(this.socket, 'call:v2:media', {
      sessionId: this.session.sessionId,
      messageId: createCallEventId(this.runtime),
      ...payload,
    });
    if (!response.ok || response.status !== 'RELAYED') throw new Error('call_media_rejected');
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.connection) {
      this.connection.onicecandidate = null;
      this.connection.ontrack = null;
      this.connection.onconnectionstatechange = null;
      this.connection.close();
    }
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.remoteCandidateQueue = [];
  }
}
