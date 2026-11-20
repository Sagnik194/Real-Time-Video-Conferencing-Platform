const splitUrls = (value) => (value || '').split(',').map(url => url.trim()).filter(Boolean);

export const getIceServers = (env = process.env) => {
    const stunUrls = splitUrls(env.REACT_APP_STUN_URLS || 'stun:stun.l.google.com:19302');
    const turnUrls = splitUrls(env.REACT_APP_TURN_URLS);
    const servers = stunUrls.length ? [{ urls: stunUrls }] : [];

    if (turnUrls.length && env.REACT_APP_TURN_USERNAME && env.REACT_APP_TURN_CREDENTIAL) {
        servers.push({
            urls: turnUrls,
            username: env.REACT_APP_TURN_USERNAME,
            credential: env.REACT_APP_TURN_CREDENTIAL,
        });
    }

    return servers;
};
