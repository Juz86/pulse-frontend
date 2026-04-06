export function deriveCallMessagePresentation(msg, isOwn) {
  const isMissed = !isOwn && (msg.direction === 'no-answer' || msg.direction === 'declined');
  const durSec = msg.duration || 0;
  const durationStr = durSec > 0
    ? (durSec >= 60 ? `${Math.floor(durSec / 60)} min` : `${durSec} sec`)
    : '';
  const callLabel = isOwn
    ? (msg.direction === 'completed'
      ? (msg.isVideo ? 'Video-oproep' : 'Spraakoproep')
      : msg.direction === 'declined'
        ? 'Geweigerd'
        : 'Geen antwoord')
    : (isMissed
      ? (msg.isVideo ? 'Gemiste video-oproep' : 'Gemiste spraakoproep')
      : (msg.isVideo ? 'Video-oproep' : 'Spraakoproep'));
  const callSub = durationStr || (isMissed ? 'Tik om terug te bellen' : '');
  const iconType = isMissed ? 'missed' : isOwn ? 'outgoing' : 'incoming';
  const callCardLabel = isMissed
    ? `${callLabel}. Activeer om terug te bellen`
    : callSub ? `${callLabel}. ${callSub}` : callLabel;

  return {
    isMissed,
    isVideo: Boolean(msg.isVideo),
    callLabel,
    callSub,
    iconType,
    callCardLabel,
  };
}
