import { getIceServers } from './iceServers';

test('uses STUN by default', () => {
    expect(getIceServers({})).toEqual([{ urls: ['stun:stun.l.google.com:19302'] }]);
});

test('adds configured TURN with its environment credentials and retains STUN', () => {
    expect(getIceServers({
        REACT_APP_STUN_URLS: 'stun:stun.example.test:3478, stun:backup.example.test:3478',
        REACT_APP_TURN_URLS: 'turn:relay.example.test:3478?transport=udp, turns:relay.example.test:5349',
        REACT_APP_TURN_USERNAME: 'ephemeral-user',
        REACT_APP_TURN_CREDENTIAL: 'ephemeral-secret',
    })).toEqual([
        { urls: ['stun:stun.example.test:3478', 'stun:backup.example.test:3478'] },
        {
            urls: ['turn:relay.example.test:3478?transport=udp', 'turns:relay.example.test:5349'],
            username: 'ephemeral-user',
            credential: 'ephemeral-secret',
        },
    ]);
});

test('ignores TURN configuration without both credentials', () => {
    expect(getIceServers({ REACT_APP_TURN_URLS: 'turn:relay.example.test:3478', REACT_APP_TURN_USERNAME: 'user' }))
        .toEqual([{ urls: ['stun:stun.l.google.com:19302'] }]);
});
