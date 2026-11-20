const MAX_TRACKED_CLIENTS = 10000;

export const createRateLimiter = ({ limit, windowMs, now = Date.now, maxTrackedClients = MAX_TRACKED_CLIENTS }) => {
    const clients = new Map();

    return (req, res, next) => {
        const currentTime = now();
        const clientKey = req.ip || req.socket?.remoteAddress || 'unknown';
        let record = clients.get(clientKey);

        if (!record || currentTime - record.windowStart >= windowMs) {
            if (clients.size >= maxTrackedClients) {
                for (const [key, value] of clients) {
                    if (currentTime - value.windowStart >= windowMs) clients.delete(key);
                }
            }
            if (clients.size >= maxTrackedClients && !record) {
                res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
                return res.status(429).json({ message: 'Too many requests. Try again later.' });
            }
            record = { windowStart: currentTime, count: 0 };
            clients.set(clientKey, record);
        }

        record.count += 1;
        res.set('RateLimit-Limit', String(limit));
        res.set('RateLimit-Remaining', String(Math.max(0, limit - record.count)));
        res.set('RateLimit-Reset', String(Math.ceil((record.windowStart + windowMs - currentTime) / 1000)));
        if (record.count > limit) {
            res.set('Retry-After', String(Math.ceil((record.windowStart + windowMs - currentTime) / 1000)));
            return res.status(429).json({ message: 'Too many requests. Try again later.' });
        }
        return next();
    };
};

export const loginRateLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
export const registrationRateLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
