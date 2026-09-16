import RealtimeKitClient from '@cloudflare/realtimekit';
import { RTC_CONFIG_URL } from '../config/runtimeConfig';

export const REALTIMEKIT_CALL_ENGINE = 'realtimekit-v2';

function requireValue(value, name) {
  if (!value) throw new Error(`${name} ontbreekt voor de oproep.`);
  return value;
}

export async function fetchRealtimeKitCallCredentials({
  sessionId,
  idToken,
  name,
  picture,
  backendUrl = RTC_CONFIG_URL,
  fetchImpl = fetch,
}) {
  requireValue(sessionId, 'sessionId');
  requireValue(idToken, 'idToken');
  const response = await fetchImpl(
    `${String(backendUrl).replace(/\/+$/, '')}/api/calls/realtimekit/session/${encodeURIComponent(sessionId)}/join`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({ name: name || undefined, picture: picture || undefined }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.engine !== REALTIMEKIT_CALL_ENGINE || !payload?.authToken) {
    const error = new Error('De nieuwe oproepverbinding kon niet worden voorbereid.');
    error.code = payload?.error || 'realtimekit_bootstrap_failed';
    error.status = response.status;
    throw error;
  }
  return {
    authToken: payload.authToken,
    engine: payload.engine,
    isVideo: Boolean(payload.isVideo),
    sessionId: payload.sessionId,
  };
}

function buildMediaStream(tracks) {
  const activeTracks = tracks.filter((track) => track && track.readyState !== 'ended');
  return typeof MediaStream === 'function' ? new MediaStream(activeTracks) : { getTracks: () => activeTracks };
}

function tracksForParticipant(participant) {
  return [
    participant?.audioTrack,
    participant?.videoEnabled ? participant?.videoTrack : null,
  ].filter(Boolean);
}

export async function startRealtimeKitCall({
  authToken,
  isVideo,
  onRemoteStream,
  onParticipantLeft,
  onError,
  client = RealtimeKitClient,
}) {
  requireValue(authToken, 'RealtimeKit-token');
  const meeting = await client.init({
    authToken,
    defaults: { audio: true, video: Boolean(isVideo) },
    onError,
  });
  const remoteStreams = new Map();
  const participantListeners = new Map();
  const joined = meeting.participants.joined;

  const publishParticipant = (participant) => {
    const stream = buildMediaStream(tracksForParticipant(participant));
    remoteStreams.set(participant.id, stream);
    onRemoteStream?.(stream, participant);
  };

  const watchParticipant = (participant) => {
    if (!participant?.id || participantListeners.has(participant.id)) return;
    const refresh = () => publishParticipant(participant);
    participant.on?.('audioUpdate', refresh);
    participant.on?.('videoUpdate', refresh);
    participantListeners.set(participant.id, refresh);
    publishParticipant(participant);
  };

  const unwatchParticipant = (participant) => {
    const refresh = participantListeners.get(participant?.id);
    if (refresh) {
      participant.off?.('audioUpdate', refresh);
      participant.off?.('videoUpdate', refresh);
    }
    participantListeners.delete(participant?.id);
    remoteStreams.delete(participant?.id);
    onParticipantLeft?.(participant);
  };

  joined.on?.('participantJoined', watchParticipant);
  joined.on?.('participantLeft', unwatchParticipant);
  await meeting.join();
  joined.forEach?.(watchParticipant);

  let left = false;
  return {
    engine: REALTIMEKIT_CALL_ENGINE,
    meeting,
    getLocalStream() {
      return buildMediaStream([
        meeting.self?.audioEnabled ? meeting.self.audioTrack : null,
        meeting.self?.videoEnabled ? meeting.self.videoTrack : null,
      ]);
    },
    getRemoteStreams() {
      return new Map(remoteStreams);
    },
    async setMicrophoneEnabled(enabled) {
      return enabled ? meeting.self.enableAudio() : meeting.self.disableAudio();
    },
    async setCameraEnabled(enabled) {
      return enabled ? meeting.self.enableVideo() : meeting.self.disableVideo();
    },
    async leave() {
      if (left) return;
      left = true;
      joined.off?.('participantJoined', watchParticipant);
      joined.off?.('participantLeft', unwatchParticipant);
      participantListeners.forEach((refresh, participantId) => {
        const participant = joined.get?.(participantId);
        participant?.off?.('audioUpdate', refresh);
        participant?.off?.('videoUpdate', refresh);
      });
      participantListeners.clear();
      remoteStreams.clear();
      await meeting.leave();
    },
  };
}

