import { summarizeSelectedIceCandidatePair } from './iceDiagnostics';

describe('ICE diagnostics', () => {
  test.each([
    ['relay', 'relay', 'srflx', 'relay'],
    ['srflx', 'srflx', 'host', 'srflx'],
    ['host', 'host', 'host', 'host'],
  ])('classifies a %s path without exposing addresses', (_label, localType, remoteType, expectedPath) => {
    const summary = summarizeSelectedIceCandidatePair([
      { id: 'transport-1', type: 'transport', selectedCandidatePairId: 'pair-1' },
      {
        id: 'pair-1',
        type: 'candidate-pair',
        localCandidateId: 'local-1',
        remoteCandidateId: 'remote-1',
        state: 'succeeded',
      },
      { id: 'local-1', type: 'local-candidate', candidateType: localType, protocol: 'udp', address: '192.0.2.1' },
      { id: 'remote-1', type: 'remote-candidate', candidateType: remoteType, address: '198.51.100.2' },
    ]);

    expect(summary).toEqual({
      path: expectedPath,
      localCandidateType: localType,
      remoteCandidateType: remoteType,
      protocol: 'udp',
    });
    expect(JSON.stringify(summary)).not.toContain('192.0.2.1');
    expect(JSON.stringify(summary)).not.toContain('198.51.100.2');
  });

  test('supports nominated candidate pairs when transport stats omit the selected id', () => {
    expect(summarizeSelectedIceCandidatePair([
      { id: 'pair-1', type: 'candidate-pair', nominated: true, state: 'succeeded', localCandidateId: 'local-1', remoteCandidateId: 'remote-1' },
      { id: 'local-1', candidateType: 'relay' },
      { id: 'remote-1', candidateType: 'host' },
    ])?.path).toBe('relay');
  });
});
