import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import io from 'socket.io-client';
import VideoMeetComponent from './VideoMeet';

jest.mock('socket.io-client', () => ({ __esModule: true, default: jest.fn() }));

class FakeMediaStream {
    constructor(tracks = []) { this.tracks = tracks; }
    getTracks() { return this.tracks; }
    getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
    getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
    addTrack(track) { if (!this.tracks.includes(track)) this.tracks.push(track); }
    removeTrack(track) { this.tracks = this.tracks.filter(item => item !== track); }
}

class FakePeerConnection {
    static instances = [];
    constructor(config) {
        this.config = config;
        this.senders = [];
        this.transceivers = [];
        this.connectionState = 'new';
        this.signalingState = 'stable';
        FakePeerConnection.instances.push(this);
    }
    addTrack(track, stream) {
        const sender = { track, stream, replaceTrack: jest.fn(async next => { sender.track = next; }) };
        this.senders.push(sender);
        this.transceivers.push({ sender, receiver: { track: { kind: track.kind } } });
        return sender;
    }
    addTransceiver(kind) {
        const sender = { track: null, replaceTrack: jest.fn(async next => { sender.track = next; }) };
        const transceiver = { sender, receiver: { track: { kind } } };
        this.senders.push(sender);
        this.transceivers.push(transceiver);
        return transceiver;
    }
    getSenders() { return this.senders; }
    getTransceivers() { return this.transceivers; }
    async createOffer() { return { type: 'offer', sdp: 'offer' }; }
    async createAnswer() { return { type: 'answer', sdp: 'answer' }; }
    async setLocalDescription(description) { this.localDescription = description; this.signalingState = 'have-local-offer'; }
    async setRemoteDescription(description) { this.remoteDescription = description; this.signalingState = 'stable'; }
    async addIceCandidate(candidate) { this.lastCandidate = candidate; }
    close() { this.connectionState = 'closed'; }
}

const makeTrack = kind => ({ kind, enabled: true, stop: jest.fn(), onended: null });
const makeStream = (...tracks) => new FakeMediaStream(tracks);

const createSocket = () => {
    const listeners = new Map();
    const socket = {
        id: 'local',
        connected: true,
        on: jest.fn((event, callback) => listeners.set(event, callback)),
        emit: jest.fn(),
        disconnect: jest.fn(),
        trigger: (event, ...args) => listeners.get(event)?.(...args),
    };
    return socket;
};

const joinMeeting = async (userStream, peerId = 'peer') => {
    const socket = createSocket();
    io.mockReturnValue(socket);
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: jest.fn(async () => userStream), getDisplayMedia: jest.fn() },
    });
    render(<MemoryRouter initialEntries={['/room-test']}>
        <Routes>
            <Route path='/:url' element={<VideoMeetComponent />} />
            <Route path='/' element={<div />} />
        </Routes>
    </MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Guest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join meeting' }));
    await screen.findByRole('button', { name: 'Turn camera off' });
    await screen.findByRole('button', { name: 'Start screen sharing' });
    socket.trigger('connect');
    socket.trigger('user-joined', peerId, ['local', peerId]);
    await waitFor(() => expect(FakePeerConnection.instances).toHaveLength(1));
    return { socket, pc: FakePeerConnection.instances[0] };
};

beforeEach(() => {
    FakePeerConnection.instances = [];
    global.RTCPeerConnection = FakePeerConnection;
    global.MediaStream = FakeMediaStream;
    io.mockReset();
});

test('lobby attaches the camera preview before the user joins', async () => {
    const stream = makeStream(makeTrack('video'), makeTrack('audio'));
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: jest.fn(async () => stream), getDisplayMedia: jest.fn() },
    });

    render(<MemoryRouter initialEntries={['/room-test']}>
        <Routes><Route path='/:url' element={<VideoMeetComponent />} /></Routes>
    </MemoryRouter>);

    await waitFor(() => expect(document.querySelector('video').srcObject).toBe(stream));
    expect(io).not.toHaveBeenCalled();
});

test('camera and microphone toggles change only their own tracks', async () => {
    const camera = makeTrack('video');
    const microphone = makeTrack('audio');
    const localStream = makeStream(camera, microphone);
    const { pc } = await joinMeeting(localStream);
    expect(document.querySelector('video').srcObject).toBe(localStream);

    fireEvent.click(screen.getByRole('button', { name: 'Turn camera off' }));
    expect(camera.enabled).toBe(false);
    expect(microphone.enabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Mute microphone' }));
    expect(camera.enabled).toBe(false);
    expect(microphone.enabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Turn camera on' }));
    expect(camera.enabled).toBe(true);
    expect(microphone.enabled).toBe(false);
    expect(pc.getSenders().find(sender => sender.track?.kind === 'video').track).toBe(camera);
});

test('WebRTC answers offers and applies ICE candidates that arrived early', async () => {
    const { socket, pc } = await joinMeeting(makeStream(makeTrack('video'), makeTrack('audio')), '0-peer');
    const candidate = { candidate: 'candidate:early' };

    await act(async () => { await socket.trigger('signal', '0-peer', { candidate }); });
    expect(pc.lastCandidate).toBeUndefined();
    await act(async () => {
        await socket.trigger('signal', '0-peer', { description: { type: 'offer', sdp: 'remote-offer' } });
    });

    expect(pc.remoteDescription).toEqual({ type: 'offer', sdp: 'remote-offer' });
    expect(pc.lastCandidate).toEqual(candidate);
    await waitFor(() => expect(socket.emit).toHaveBeenCalledWith('signal', '0-peer', {
        description: { type: 'answer', sdp: 'answer' },
    }));
});

test('video call chat displays incoming room messages and sends composed messages', async () => {
    const { socket } = await joinMeeting(makeStream(makeTrack('video'), makeTrack('audio')));

    act(() => socket.trigger('chat-message', 'Hello from the room', 'Another guest', 'peer'));
    expect(await screen.findByText('Hello from the room')).toBeInTheDocument();
    expect(screen.getByText('Another guest')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Write a message'), { target: { value: 'Hi there' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(socket.emit).toHaveBeenCalledWith('chat-message', 'Hi there', 'Guest');
});

test('screen audio uses a separate sender and both stop paths restore camera and microphone', async () => {
    const camera = makeTrack('video');
    const microphone = makeTrack('audio');
    const displayVideo = makeTrack('video');
    const displayAudio = makeTrack('audio');
    const displayStream = makeStream(displayVideo, displayAudio);
    const { pc } = await joinMeeting(makeStream(camera, microphone));
    navigator.mediaDevices.getDisplayMedia.mockResolvedValueOnce(displayStream).mockResolvedValueOnce(makeStream(makeTrack('video')));

    const remoteVideo = makeTrack('video');
    const remoteAudio = makeTrack('audio');
    act(() => {
        pc.ontrack({ track: remoteVideo, streams: [] });
        pc.ontrack({ track: remoteAudio, streams: [] });
    });
    const remoteElement = document.querySelectorAll('video')[1];
    await waitFor(() => expect(remoteElement.srcObject.getTracks()).toEqual(expect.arrayContaining([remoteVideo, remoteAudio])));

    fireEvent.click(screen.getByRole('button', { name: 'Start screen sharing' }));
    await screen.findByRole('button', { name: 'Stop screen sharing' });
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: true });
    expect(document.querySelector('video').srcObject).toBe(displayStream);
    const videoSender = pc.getTransceivers().find(item => item.receiver.track.kind === 'video').sender;
    const micSender = pc.getSenders().find(sender => sender.track === microphone);
    const screenAudioSender = pc.getSenders().find(sender => sender.track === displayAudio);
    expect(videoSender.track).toBe(displayVideo);
    expect(micSender.track).toBe(microphone);
    expect(screenAudioSender.track).toBe(displayAudio);

    act(() => displayVideo.onended());
    await screen.findByRole('button', { name: 'Start screen sharing' });
    expect(videoSender.track).toBe(camera);
    expect(micSender.track).toBe(microphone);
    expect(screenAudioSender.track).toBe(null);

    fireEvent.click(screen.getByRole('button', { name: 'Start screen sharing' }));
    await screen.findByRole('button', { name: 'Stop screen sharing' });
    fireEvent.click(screen.getByRole('button', { name: 'Stop screen sharing' }));
    await screen.findByRole('button', { name: 'Start screen sharing' });
    expect(videoSender.track).toBe(camera);
    expect(micSender.track).toBe(microphone);
});

test('screen sharing remains usable when the browser returns video without display audio', async () => {
    const camera = makeTrack('video');
    const microphone = makeTrack('audio');
    const displayVideo = makeTrack('video');
    const { pc } = await joinMeeting(makeStream(camera, microphone));
    navigator.mediaDevices.getDisplayMedia.mockRejectedValueOnce(new TypeError('display audio unsupported'))
        .mockResolvedValueOnce(makeStream(displayVideo));

    fireEvent.click(screen.getByRole('button', { name: 'Start screen sharing' }));
    await screen.findByRole('button', { name: 'Stop screen sharing' });

    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenNthCalledWith(1, { video: true, audio: true });
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenNthCalledWith(2, { video: true });
    expect(pc.getSenders().find(sender => sender.track === microphone).track).toBe(microphone);
    const displayAudioSender = pc.getTransceivers().find(item => item.receiver.track.kind === 'audio' && item.sender.track === null)?.sender;
    expect(displayAudioSender).toBeDefined();
});

test('ending a call closes peer connections and stops local media', async () => {
    const camera = makeTrack('video');
    const microphone = makeTrack('audio');
    const { socket, pc } = await joinMeeting(makeStream(camera, microphone));

    fireEvent.click(screen.getByRole('button', { name: 'End call' }));

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(pc.connectionState).toBe('closed');
    expect(camera.stop).toHaveBeenCalledTimes(1);
    expect(microphone.stop).toHaveBeenCalledTimes(1);
});
