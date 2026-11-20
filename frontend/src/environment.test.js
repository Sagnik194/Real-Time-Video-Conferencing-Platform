import server from './environment';

test('uses the deployed API by default when no frontend API URL is configured', () => {
    expect(server).toBe('https://real-time-video-conferencing-platform-1.onrender.com');
});
