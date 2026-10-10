import { loadPulseCallHistory } from './callHistory';
import { writeCachedMessages } from '../utils';

const user = {
  uid: 'current-user',
  getIdToken: jest.fn().mockResolvedValue('token'),
};

function response(payload, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  };
}

describe('loadPulseCallHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    user.getIdToken.mockClear();
  });

  test('collects, deduplicates and sorts call events from direct conversations', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(response([
        {
          id: 'call-old',
          type: 'call',
          conversationId: 'conv-a',
          sessionId: 'session-old',
          createdAt: '2026-10-09T10:00:00.000Z',
          presentations: {
            'current-user': { kind: 'outgoing_unanswered', label: 'Geen antwoord' },
          },
        },
      ]))
      .mockResolvedValueOnce(response([
        {
          id: 'call-new',
          type: 'call',
          conversationId: 'conv-b',
          sessionId: 'session-new',
          createdAt: '2026-10-09T11:00:00.000Z',
          presentations: {
            'current-user': { kind: 'missed_incoming', label: 'Gemiste spraakoproep' },
          },
        },
      ]));
    const conversations = [
      {
        id: 'conv-a',
        members: ['current-user', 'a'],
        lastMessageType: 'call',
        lastMessageAt: '2026-10-09T10:00:00.000Z',
        lastCallEvent: {
          sessionId: 'session-old',
          presentations: {
            'current-user': { kind: 'outgoing_unanswered', label: 'Geen antwoord' },
          },
        },
      },
      { id: 'conv-b', members: ['current-user', 'b'] },
      { id: 'group', isGroup: true, members: ['current-user', 'a', 'b'] },
    ];

    const history = await loadPulseCallHistory({ user, conversations, fetchImpl });

    expect(history).toHaveLength(2);
    expect(history.map((item) => item.id)).toEqual(['call-new', 'call-old']);
    expect(history.map((item) => item.callKind)).toEqual(['missed_incoming', 'outgoing_unanswered']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('uses cached call events when the network is unavailable', async () => {
    writeCachedMessages('current-user', 'conv-a', [{
      id: 'cached-call',
      type: 'call',
      conversationId: 'conv-a',
      callKind: 'incoming_declined',
      direction: 'incoming',
      createdAt: '2026-10-09T12:00:00.000Z',
    }]);

    const history = await loadPulseCallHistory({
      user,
      conversations: [{ id: 'conv-a', members: ['current-user', 'a'] }],
      fetchImpl: jest.fn().mockRejectedValue(new Error('offline')),
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: 'cached-call', callKind: 'incoming_declined' });
  });

  test('reports a load failure when neither network nor cache is available', async () => {
    await expect(loadPulseCallHistory({
      user,
      conversations: [{ id: 'conv-a', members: ['current-user', 'a'] }],
      fetchImpl: jest.fn().mockRejectedValue(new Error('offline')),
    })).rejects.toThrow('call_history_load_failed');
  });
});

