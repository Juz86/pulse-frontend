# Pulse Backend Skeleton Firestore Indexes

Dit bestand noemt de belangrijkste queryrichtingen uit de skeleton waarvoor je in Firestore meestal indexes nodig zult hebben.

## Waarschijnlijk Nodig

### `devices`

Query:

- `where('userId', '==', targetUserId).where('status', '==', 'active')`

Doel:

- actieve devices voor key bundle lookup

### `messages`

Query:

- `where('conversationId', '==', convId).orderBy('createdAt', 'desc')`

Doel:

- mixed message feed per gesprek

### `message_recipients`

Query:

- `where('messageId', '==', messageId).where('recipientUserId', '==', uid).where('recipientDeviceId', '==', recipientDeviceId)`

Doel:

- receipt updates per recipient device

### `approved_contacts`

Query:

- `where('childId', '==', childUid)`

Doel:

- parent contactoverzicht

### `policy_events`

Query:

- `where('actorUid', '==', parentUid).orderBy('createdAt', 'desc')`

Doel:

- parent activity feed

## Opmerking

De exacte indexdefinities kunnen door Firestore zelf worden voorgesteld zodra je queries live uitvoert. Deze lijst is dus vooral bedoeld als implementatiehouvast.
