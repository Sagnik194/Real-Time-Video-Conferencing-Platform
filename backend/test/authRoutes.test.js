import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import userRoutes from '../src/routes/users.routes.js';

const startServer = async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/users', userRoutes);
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    return { server, baseUrl: `http://127.0.0.1:${port}/api/v1/users` };
};

test('login and registration routes enforce their separate IP limits', async t => {
    const { server, baseUrl } = await startServer();
    t.after(() => new Promise(resolve => server.close(resolve)));

    let loginResponse;
    for (let attempt = 0; attempt < 11; attempt += 1) {
        loginResponse = await fetch(`${baseUrl}/login`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
        });
    }
    assert.equal(loginResponse.status, 429);
    assert.equal((await loginResponse.json()).message, 'Too many requests. Try again later.');

    let registrationResponse;
    for (let attempt = 0; attempt < 6; attempt += 1) {
        registrationResponse = await fetch(`${baseUrl}/register`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
        });
    }
    assert.equal(registrationResponse.status, 429);
});
