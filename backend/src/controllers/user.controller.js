import httpStatus from 'http-status';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { User } from '../models/user.model.js';
import { Meeting } from '../models/meeting.model.js';

const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const sessionTtlHours = Math.min(720, Math.max(1, Number(process.env.SESSION_TTL_HOURS) || 24));
const serverError = (res, error) => {
    console.error('Request failed:', error?.name || 'Error');
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: 'An unexpected error occurred.' });
};

const login = async (req, res) => {
    const { username, password } = req.body || {};
    if (!validText(username, 80) || !validText(password, 200)) return res.status(httpStatus.BAD_REQUEST).json({ message: 'Username and password are required.' });
    try {
        const user = await User.findOne({ username: username.trim() });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(httpStatus.UNAUTHORIZED).json({ message: 'Invalid username or password.' });
        user.token = crypto.randomBytes(32).toString('hex');
        user.tokenExpiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);
        await user.save();
        return res.status(httpStatus.OK).json({ token: user.token });
    } catch (error) { return serverError(res, error); }
};

const register = async (req, res) => {
    const { name, username, password } = req.body || {};
    if (!validText(name, 100) || !validText(username, 80) || !validText(password, 200) || password.length < 8) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: 'Provide a name, username, and password of at least 8 characters.' });
    }
    try {
        const cleanUsername = username.trim();
        if (await User.exists({ username: cleanUsername })) return res.status(httpStatus.CONFLICT).json({ message: 'User already exists.' });
        const newUser = new User({ name: name.trim(), username: cleanUsername, password: await bcrypt.hash(password, 12) });
        await newUser.save();
        return res.status(httpStatus.CREATED).json({ message: 'User Registered' });
    } catch (error) {
        if (error?.code === 11000) return res.status(httpStatus.CONFLICT).json({ message: 'User already exists.' });
        return serverError(res, error);
    }
};

const getAuthenticatedUser = async (req, res) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '') || req.body?.token;
    if (!validText(token, 256)) {
        res.status(httpStatus.UNAUTHORIZED).json({ message: 'Authentication required.' });
        return null;
    }
    const user = await User.findOne({ token });
    if (!user) res.status(httpStatus.UNAUTHORIZED).json({ message: 'Session expired. Please sign in again.' });
    else if (user.tokenExpiresAt && user.tokenExpiresAt.getTime() <= Date.now()) {
        user.token = undefined;
        user.tokenExpiresAt = undefined;
        await user.save();
        res.status(httpStatus.UNAUTHORIZED).json({ message: 'Session expired. Please sign in again.' });
        return null;
    } else if (!user.tokenExpiresAt) {
        // Existing sessions are migrated on first use and receive a bounded lifetime.
        user.tokenExpiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);
        await user.save();
    }
    return user;
};

const logout = async (req, res) => {
    try {
        const user = await getAuthenticatedUser(req, res);
        if (!user) return;
        user.token = undefined;
        user.tokenExpiresAt = undefined;
        await user.save();
        return res.status(httpStatus.OK).json({ message: 'Signed out.' });
    } catch (error) { return serverError(res, error); }
};

const getUserHistory = async (req, res) => {
    try {
        const user = await getAuthenticatedUser(req, res);
        if (!user) return;
        const meetings = await Meeting.find({ user_id: user.username }).sort({ date: -1 }).limit(100).lean();
        return res.status(httpStatus.OK).json(meetings);
    } catch (error) { return serverError(res, error); }
};

const addToHistory = async (req, res) => {
    const meetingCode = req.body?.meeting_code;
    if (!validText(meetingCode, 128)) return res.status(httpStatus.BAD_REQUEST).json({ message: 'A valid meeting code is required.' });
    try {
        const user = await getAuthenticatedUser(req, res);
        if (!user) return;
        await Meeting.create({ user_id: user.username, meetingCode: meetingCode.trim() });
        return res.status(httpStatus.CREATED).json({ message: 'Added code to history' });
    } catch (error) { return serverError(res, error); }
};

export { login, register, logout, getUserHistory, addToHistory };
