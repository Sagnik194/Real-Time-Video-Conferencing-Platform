import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import bcrypt from 'bcrypt';
import { User } from '../src/models/user.model.js';
import { Meeting } from '../src/models/meeting.model.js';
import { addToHistory, getUserHistory, login, logout } from '../src/controllers/user.controller.js';

const response = () => ({
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set(name, value) { this.headers[name] = value; return this; },
});

const request = (body = {}, token = '') => ({
    body,
    query: {},
    get: name => name.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : undefined,
});

test('login issues an expiring token without changing legacy password hashes', async t => {
    const now = Date.now();
    const legacyHash = await bcrypt.hash('old-password', 4);
    const user = { username: 'legacy-user', password: legacyHash, save: mock.fn(async () => {}) };
    t.mock.method(User, 'findOne', async () => user);
    const res = response();

    await login(request({ username: 'legacy-user', password: 'old-password' }), res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body.token, /^[a-f0-9]{64}$/);
    assert.ok(user.tokenExpiresAt instanceof Date);
    assert.ok(user.tokenExpiresAt.getTime() > now);
    assert.equal(user.password, legacyHash);
    assert.equal(user.save.mock.callCount(), 1);
});

test('expired sessions are rejected and invalidated server side', async t => {
    const user = { username: 'member', token: 'expired', tokenExpiresAt: new Date(Date.now() - 1000), save: mock.fn(async () => {}) };
    t.mock.method(User, 'findOne', async () => user);
    const res = response();

    await getUserHistory(request({}, 'expired'), res);

    assert.equal(res.statusCode, 401);
    assert.equal(user.token, undefined);
    assert.equal(user.tokenExpiresAt, undefined);
    assert.equal(user.save.mock.callCount(), 1);
});

test('legacy sessions receive an expiry and continue to read meeting history', async t => {
    const user = { username: 'legacy-user', token: 'legacy-token', save: mock.fn(async () => {}) };
    t.mock.method(User, 'findOne', async () => user);
    t.mock.method(Meeting, 'find', () => ({
        sort() { return this; },
        limit() { return this; },
        lean: async () => [{ meetingCode: 'old-meeting' }],
    }));
    const res = response();

    await getUserHistory(request({}, 'legacy-token'), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body[0].meetingCode, 'old-meeting');
    assert.ok(user.tokenExpiresAt instanceof Date);
    assert.equal(user.save.mock.callCount(), 1);
});

test('logout invalidates the current token and meeting history remains authenticated', async t => {
    const user = { username: 'member', token: 'active-token', tokenExpiresAt: new Date(Date.now() + 60000), save: mock.fn(async () => {}) };
    t.mock.method(User, 'findOne', async () => user);
    t.mock.method(Meeting, 'create', async doc => doc);
    const logoutRes = response();
    await logout(request({}, 'active-token'), logoutRes);
    assert.equal(logoutRes.statusCode, 200);
    assert.equal(user.token, undefined);

    const deniedRes = response();
    await addToHistory(request({ meeting_code: 'meeting-1' }, ''), deniedRes);
    assert.equal(deniedRes.statusCode, 401);
});
