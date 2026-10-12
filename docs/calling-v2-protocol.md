# Pulse Calling v2 protocol

Status: design contract, no production calling is enabled.

## Ownership

- `PulseCallCoordinator` will be the single owner of the local call lifecycle.
- The native media service will own microphone, camera, audio routing and WebRTC resources.
- Railway will be authoritative for session membership and ordered signaling events.
- FCM will only wake the recipient and identify a pending session.
- TURN will only relay media when direct ICE connectivity fails.
- Android Core-Telecom is the system call-control adapter from the first native phase. It must
  not create or own a signaling or media session.
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

## Railway command and snapshot contract

Client commands contain:

```json
{
  "sessionId": "globally-unique-id",
  "eventId": "globally-unique-id",
  "expectedRevision": 1,
  "command": "INVITE_READY"
}
```

Railway acknowledges the command with the complete authoritative session
snapshot. That snapshot contains `protocolVersion`, `revision`, both participant
IDs, media type, state, readiness and terminal fields. The Android coordinator
maps the server `revision` to its local ordered `sequence`.

Rules:

1. `sessionId` is never reused.
2. `eventId` makes retries idempotent.
3. `revision` is strictly increasing within a server session.
4. Events for a different or retired session are ignored.
5. Out-of-order events trigger a snapshot request instead of a guessed transition.
6. The server acknowledges every accepted command with the resulting session revision.
7. Reconnecting clients fetch the server snapshot before sending new commands.
8. One user can hold at most one live session lease at a time.
9. Local media readiness sends `MEDIA_CONNECTED`; only the resulting Railway snapshot may
   move the local call to `ACTIVE`.

The native Socket.IO adapter waits up to 5 seconds for an acknowledgement and retries a
timed-out operation at most twice. Retries reuse the same `requestId` or `eventId`, so Railway
deduplicates them. A reconnect never resumes from memory alone: it first requests the active
session snapshot.

## Native orchestration order

The native session orchestrator uses one strict launch order:

1. obtain the current Firebase user and ID token;
2. connect the authenticated Railway socket;
3. create or fetch the authoritative Railway session;
4. admit that `sessionId` into `PulseCallCoordinator`;
5. register the call with Core-Telecom;
6. send `INVITE_READY` for outgoing calls or `ACCEPT` after an incoming answer.

Telecom callbacks return without waiting for network retries. They enqueue the matching Railway
command through the orchestrator, while every resulting snapshot is reconciled through the same
coordinator.

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

Railway stores one perspective-neutral reason: `declined`, `hangup`, `cancelled`,
`missed`, `invite_timeout`, `connect_timeout`, `media_error` or
`signaling_error`. For `hangup`, `terminalByUid` identifies who ended the call;
each client derives whether that was local or remote. Local-only failures such
as `permission_denied` remain diagnostics and are mapped to a permitted server
failure command where applicable.

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
10. Telecom callbacks never invent remote signaling state; Railway snapshots remain authoritative.

## Diagnostics contract

Record timestamps, state transitions, terminal reason, selected ICE candidate type,
round-trip time, jitter, packet loss and recovery attempts. Never record SDP bodies,
media, authentication tokens, encryption keys or TURN credentials.
