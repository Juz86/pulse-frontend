function candidateType(candidate) {
  return String(candidate?.candidateType || candidate?.googCandidateType || 'unknown').toLowerCase();
}

function selectedPair(stats, byId) {
  const transport = stats.find((entry) => entry?.type === 'transport' && entry.selectedCandidatePairId);
  if (transport) return byId.get(transport.selectedCandidatePairId) || null;
  return stats.find((entry) => (
    (entry?.type === 'candidate-pair' || entry?.type === 'candidatepair')
    && (entry.selected === true || (entry.nominated === true && entry.state === 'succeeded'))
  )) || null;
}

export function summarizeSelectedIceCandidatePair(rawStats = []) {
  const stats = Array.from(rawStats || []);
  const byId = new Map(stats.filter(Boolean).map((entry) => [entry.id, entry]));
  const pair = selectedPair(stats, byId);
  if (!pair) return null;

  const localType = candidateType(byId.get(pair.localCandidateId));
  const remoteType = candidateType(byId.get(pair.remoteCandidateId));
  const types = [localType, remoteType];
  const path = types.includes('relay')
    ? 'relay'
    : types.includes('srflx') || types.includes('prflx')
      ? 'srflx'
      : types.includes('host')
        ? 'host'
        : 'unknown';

  return {
    path,
    localCandidateType: localType,
    remoteCandidateType: remoteType,
    protocol: String(pair.protocol || byId.get(pair.localCandidateId)?.protocol || 'unknown').toLowerCase(),
  };
}

export function logSelectedIceCandidatePair(peer, sessionId) {
  if (!peer || typeof peer.getStats !== 'function') return;
  peer.getStats((error, stats = []) => {
    if (error) {
      console.warn('[Pulse][Call] ICE-pad uitlezen mislukt:', error?.message || error);
      return;
    }
    const summary = summarizeSelectedIceCandidatePair(stats);
    console.info('[Pulse][Call] selected ICE candidate pair', {
      sessionId,
      ...(summary || { path: 'unknown' }),
    });
  });
}
