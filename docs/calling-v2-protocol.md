# Pulse Calling v2 protocol

Status: design contract, no production calling is enabled.

## Ownership

- `PulseCallCoordinator` will be the single owner of the local call lifecycle.
- The native media service will own microphone, camera, audio routing and WebRTC resources.
- Railway will be authoritative for session membership and ordered signaling events.
- FCM will only wake the recipient and identify a pending session.
- TURN will only relay media when direct ICE connectivity fails.
- Android Telecom may be added later as an adapter. It must not create or own a media session.
- The WebView must not own, restore or negotiate calls.

## State model

```text
IDLE -> PREPARING -> RINGING -> CONNECTING -> ACTIVE -> ENDING -> ENDED
  |                      ^          |            |
  +---- incoming --------+          +-- network -+
```

Valid entry points:

- outgoing: `IDLE -> PREPARING` using `START_OUTGOING`;
- incoming: `IDLE -> RINGING` using `RECEIVE_INCOMING`.

Only an incoming call accepts `LOCAL_ACCEPTED`. Only an outgoing call accepts
`REMOTE_ACCEPTED`. Every failure or explicit end first enters `ENDING`; resource
cleanup must complete before `ENDED`. `RESET` returns the coordinator to `IDLE`.

## Event envelope

Every server and client event will contain:

```json
{
  "protocolVersion": 2,
  "sessionId": "globally-unique-id",
  "eventId": "globally-unique-id",
  "sequence": 1,
  "type": "call.event",
  "senderDeviceId": "registered-device-id",
  "issuedAt": "2026-09-22T10:00:00.000Z",
  "payload": {}
}
```

Rules:

1. `sessionId` is never reused.
2. `eventId` makes retries idempotent.
3. `sequence` is strictly increasing within a session.
4. Events for a different or retired session are ignored.
5. Out-of-order events trigger a snapshot request instead of a guessed transition.
6. The server acknowledges every accepted command with the resulting session revision.
7. Reconnecting clients fetch the server snapshot before sending new commands.
8. One user can hold at most one live session lease at a time.

## Time budgets

- command acknowledgement: 5 seconds, with bounded retries using the same `eventId`;
- outgoing preparation: 10 seconds;
- ringing: 45 seconds;
- initial media connection: 20 seconds;
- network recovery grace period: 15 seconds;
- cleanup: 5 seconds before forced local resource release.

These are protocol limits, not UI timers. The coordinator produces a terminal reason
when a limit is reached.

## Terminal reasons

At minimum: `local_hangup`, `remote_hangup`, `declined`, `no_answer`,
`signaling_timeout`, `media_timeout`, `network_lost`, `permission_denied`,
`busy`, `replaced`, and `internal_error`.

## Acceptance gates

No Play Store build may enable calling until all applicable gates pass:

1. Repeated taps create exactly one session.
2. Replayed FCM and socket events are idempotent.
3. Stale events cannot alter the active session.
4. Caller and recipient converge on the same terminal state.
5. Answer, decline and hangup work with the app foregrounded, backgrounded and locked.
6. Audio survives Home, lockscreen and a short wifi/mobile transition.
7. ICE can recover or fall back to a relay without creating a second PeerConnection.
8. A failed call releases microphone, camera, audio focus and foreground notification.
9. Video is added only after every audio gate passes.
10. Android Telecom is added only after native audio and video pass without it.

## Diagnostics contract

Record timestamps, state transitions, terminal reason, selected ICE candidate type,
round-trip time, jitter, packet loss and recovery attempts. Never record SDP bodies,
media, authentication tokens, encryption keys or TURN credentials.
