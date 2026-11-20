import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/middleware/authRateLimiters.js';

const invoke = (limiter, ip) => {
    let passed = false;
    const res = {
        headers: {},
        statusCode: 200,
        set(name, value) { this.headers[name] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
    limiter({ ip }, res, () => { passed = true; });
    return { passed, res };
};

test('rate limiter caps requests per IP and resets after its window', () => {
    let now = 1000;
    const limiter = createRateLimiter({ limit: 2, windowMs: 500, now: () => now });
    assert.equal(invoke(limiter, '192.0.2.1').passed, true);
    assert.equal(invoke(limiter, '192.0.2.1').passed, true);
    const limited = invoke(limiter, '192.0.2.1');
    assert.equal(limited.passed, false);
    assert.equal(limited.res.statusCode, 429);
    assert.ok(limited.res.headers['Retry-After']);
    assert.equal(invoke(limiter, '192.0.2.2').passed, true);
    now += 501;
    assert.equal(invoke(limiter, '192.0.2.1').passed, true);
});

test('rate limiter bounds tracked client state', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10000, now: () => 1000, maxTrackedClients: 1 });
    assert.equal(invoke(limiter, '192.0.2.1').passed, true);
    const excess = invoke(limiter, '192.0.2.2');
    assert.equal(excess.passed, false);
    assert.equal(excess.res.statusCode, 429);
});
