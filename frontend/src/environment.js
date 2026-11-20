const defaultServer = 'https://real-time-video-conferencing-platform-1.onrender.com';
const server = (process.env.REACT_APP_SERVER_URL || defaultServer).replace(/\/+$/, '');


export default server;
