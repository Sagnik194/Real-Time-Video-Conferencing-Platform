import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        create: () => ({
            interceptors: { request: { use: jest.fn() } },
            get: jest.fn(async () => ({ data: [] })),
            post: jest.fn(async path => path === '/login'
                ? { status: 200, data: { token: 'test-session' } }
                : { status: 201, data: { message: 'User Registered' } }),
        }),
    },
}));

const openRoute = path => {
    window.history.pushState({}, '', path);
    return render(<App />);
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

test('landing route shows the Smeet identity and entry points', () => {
    openRoute('/');
    expect(screen.getByText('Smeet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /join as guest/i })).toHaveLength(2);
    expect(screen.getByRole('link', { name: /get started/i })).toBeInTheDocument();
});

test('login and registration screens retain their fields and mode switch', async () => {
    const { container } = openRoute('/auth');
    expect(screen.getByRole('heading', { name: /welcome to smeet/i })).toBeInTheDocument();
    expect(container.querySelector('#username')).toBeInTheDocument();
    expect(container.querySelector('#password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    await waitFor(() => expect(container.querySelector('#full-name')).toBeInTheDocument());
    expect(container.querySelector('#username')).toBeInTheDocument();
    expect(container.querySelector('#password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
});

test('authenticated dashboard and meeting history routes remain connected', async () => {
    localStorage.setItem('token', 'test-session');
    openRoute('/home');
    expect(screen.getByRole('heading', { name: /meet from anywhere/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Meeting history' }));
    await screen.findByText('Meeting history');
    await screen.findByText(/no meetings yet/i);
});

test('meeting route opens its lobby before media capture starts', () => {
    openRoute('/room-check');
    expect(screen.getByRole('heading', { name: /join the conversation/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join meeting' })).toBeInTheDocument();
});
