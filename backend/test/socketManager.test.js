import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSocketHandlers } from '../src/controllers/socketManager.js';

const createHarness = () => {
    const roomMembers = new Map();
    const sockets = new Map();
    const io = {
        sockets: { adapter: { rooms: roomMembers } },
        to(target) {
            return { emit(event, ...args) {
                const ids = sockets.has(target) ? [target] : [...(roomMembers.get(target) || [])];
                ids.forEach(id => sockets.get(id)?.receive(event, ...args));
            } };
        },
    };
    const roomMessages = new Map();
    const makeSocket = id => {
        const handlers = new Map();
        const received = [];
        const socket = {
            id,
            received,
            on(event, callback) { handlers.set(event, callback); },
            emit(event, ...args) { received.push([event, ...args]); },
            receive(event, ...args) { received.push([event, ...args]); },
            join(room) {
                if (!roomMembers.has(room)) roomMembers.set(room, new Set());
                roomMembers.get(room).add(id);
            },
            leave(room) {
                const members = roomMembers.get(room);
                members?.delete(id);
                if (members?.size === 0) roomMembers.delete(room);
            },
            to(room) {
                return { emit(event, ...args) {
                    for (const member of roomMembers.get(room) || []) {
                        if (member !== id) sockets.get(member)?.receive(event, ...args);
                    }
                } };
            },
            trigger(event, ...args) { return handlers.get(event)?.(...args); },
        };
        sockets.set(id, socket);
        registerSocketHandlers(io, socket, roomMessages);
        return socket;
    };
    return { makeSocket, roomMembers, roomMessages };
};

test('room moves clean membership, notify peers, and isolate chat and signaling', () => {
    const { makeSocket, roomMembers, roomMessages } = createHarness();
    const alice = makeSocket('alice');
    const bob = makeSocket('bob');
    const cara = makeSocket('cara');

    alice.trigger('join-call', ' alpha ');
    bob.trigger('join-call', 'alpha');
    cara.trigger('join-call', 'beta');
    assert.deepEqual([...roomMembers.get('alpha')], ['alice', 'bob']);

    alice.trigger('chat-message', 'alpha only', 'Alice');
    assert.equal(bob.received.filter(([event, text]) => event === 'chat-message' && text === 'alpha only').length, 1);
    assert.equal(cara.received.some(([event, text]) => event === 'chat-message' && text === 'alpha only'), false);

    alice.trigger('signal', 'cara', { description: 'cross-room' });
    assert.equal(cara.received.some(([event, from]) => event === 'signal' && from === 'alice'), false);
    alice.trigger('signal', 'bob', { description: 'same-room' });
    assert.equal(bob.received.some(([event, from]) => event === 'signal' && from === 'alice'), true);

    alice.trigger('join-call', 'beta');
    assert.deepEqual([...roomMembers.get('alpha')], ['bob']);
    assert.equal(bob.received.some(([event, id]) => event === 'user-left' && id === 'alice'), true);
    assert.deepEqual(new Set(roomMembers.get('beta')), new Set(['cara', 'alice']));

    const joinedBeforeRepeat = cara.received.filter(([event, id]) => event === 'user-joined' && id === 'alice').length;
    alice.trigger('join-call', 'beta');
    assert.equal(cara.received.filter(([event, id]) => event === 'user-joined' && id === 'alice').length, joinedBeforeRepeat);
    assert.equal(roomMembers.get('beta').size, 2);

    alice.trigger('chat-message', 'beta only', 'Alice');
    assert.equal(bob.received.some(([event, text]) => event === 'chat-message' && text === 'beta only'), false);
    assert.equal(cara.received.some(([event, text]) => event === 'chat-message' && text === 'beta only'), true);

    const solo = makeSocket('solo');
    solo.trigger('join-call', 'temporary');
    solo.trigger('chat-message', 'temporary message', 'Solo');
    solo.trigger('join-call', 'beta');
    assert.equal(roomMembers.has('temporary'), false);
    assert.equal(roomMessages.has('temporary'), false);
    const newcomer = makeSocket('newcomer');
    newcomer.trigger('join-call', 'temporary');
    assert.equal(newcomer.received.some(([event, text]) => event === 'chat-message' && text === 'temporary message'), false);

    newcomer.trigger('chat-message', 'last message', 'Newcomer');
    newcomer.trigger('disconnect');
    assert.equal(roomMembers.has('temporary'), false);
    assert.equal(roomMessages.has('temporary'), false);
});
