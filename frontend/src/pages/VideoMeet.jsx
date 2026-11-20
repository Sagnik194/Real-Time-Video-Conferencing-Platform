import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import io from 'socket.io-client';
import { Badge, Button, IconButton, TextField } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import styles from '../styles/videoComponent.module.css';
import server from '../environment';
import { getIceServers } from '../utils/iceServers';

export default function VideoMeetComponent() {
    const { url: roomId = '' } = useParams();
    const navigate = useNavigate();
    const socketRef = useRef(null);
    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const peersRef = useRef(new Map());
    const screenAudioSendersRef = useRef(new Map());
    const remoteStreamsRef = useRef(new Map());
    const pendingCandidatesRef = useRef(new Map());
    const [username, setUsername] = useState('');
    const [joined, setJoined] = useState(false);
    const [videoOn, setVideoOn] = useState(true);
    const [audioOn, setAudioOn] = useState(true);
    const [screenOn, setScreenOn] = useState(false);
    const [screenAvailable, setScreenAvailable] = useState(false);
    const [videos, setVideos] = useState([]);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [chatOpen, setChatOpen] = useState(true);
    const [newMessages, setNewMessages] = useState(0);
    const [error, setError] = useState('');

    const stopScreenShare = useCallback(() => {
        screenStreamRef.current?.getTracks().forEach(track => { track.onended = null; track.stop(); });
        screenStreamRef.current = null;
        setScreenOn(false);
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
        peersRef.current.forEach((pc, peerId) => {
            const videoSender = pc.getTransceivers().find(item => item.receiver.track.kind === 'video')?.sender;
            if (videoSender) videoSender.replaceTrack(cameraTrack).catch(() => {});
            const screenAudioSender = screenAudioSendersRef.current.get(peerId);
            if (screenAudioSender) screenAudioSender.replaceTrack(null).catch(() => {});
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    }, []);

    const cleanup = useCallback(() => {
        socketRef.current?.disconnect();
        socketRef.current = null;
        peersRef.current.forEach(pc => pc.close());
        peersRef.current.clear();
        pendingCandidatesRef.current.clear();
        screenAudioSendersRef.current.clear();
        remoteStreamsRef.current.clear();
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        screenStreamRef.current?.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localStreamRef.current = null;
        screenStreamRef.current = null;
    }, []);

    useEffect(() => {
        setScreenAvailable(Boolean(navigator.mediaDevices?.getDisplayMedia));
        return cleanup;
    }, [cleanup]);

    const addPeer = useCallback((peerId, shouldOffer) => {
        if (peerId === socketRef.current?.id || peersRef.current.has(peerId)) return peersRef.current.get(peerId);
        const pc = new RTCPeerConnection({ iceServers: getIceServers() });
        peersRef.current.set(peerId, pc);
        const cameraStream = localStreamRef.current;
        const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
        (cameraStream?.getAudioTracks() || []).forEach(track => pc.addTrack(track, cameraStream));
        const displayAudioTrack = screenStreamRef.current?.getAudioTracks()[0];
        (cameraStream?.getVideoTracks() || []).forEach(track => {
            if (!screenTrack) pc.addTrack(track, cameraStream);
        });
        if (screenTrack && screenStreamRef.current) pc.addTrack(screenTrack, screenStreamRef.current);
        else if (!cameraStream?.getVideoTracks().length) pc.addTransceiver('video', { direction: 'sendrecv' });
        const screenAudioSender = displayAudioTrack
            ? pc.addTrack(displayAudioTrack, screenStreamRef.current)
            : pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
        screenAudioSendersRef.current.set(peerId, screenAudioSender);
        const remoteStream = new MediaStream();
        remoteStreamsRef.current.set(peerId, remoteStream);
        pc.onicecandidate = event => {
            if (event.candidate) socketRef.current?.emit('signal', peerId, { candidate: event.candidate });
        };
        pc.ontrack = event => {
            if (!remoteStream.getTracks().includes(event.track)) remoteStream.addTrack(event.track);
            event.track.onended = () => remoteStream.removeTrack(event.track);
            setVideos(current => [...current.filter(item => item.socketId !== peerId), { socketId: peerId, stream: remoteStream }]);
        };
        pc.onconnectionstatechange = () => {
            if (['failed', 'closed'].includes(pc.connectionState)) {
                pc.close();
                peersRef.current.delete(peerId);
                screenAudioSendersRef.current.delete(peerId);
                remoteStreamsRef.current.delete(peerId);
                setVideos(current => current.filter(item => item.socketId !== peerId));
            }
        };
        if (shouldOffer) pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
            socketRef.current?.emit('signal', peerId, { description: pc.localDescription });
        }).catch(() => setError('Unable to establish a peer connection.'));
        return pc;
    }, []);

    const handleSignal = useCallback(async (fromId, payload) => {
        try {
            const pc = addPeer(fromId, false);
            if (!pc) return;
            if (payload?.description) {
                await pc.setRemoteDescription(payload.description);
                const candidates = pendingCandidatesRef.current.get(fromId) || [];
                for (const candidate of candidates) await pc.addIceCandidate(candidate);
                pendingCandidatesRef.current.delete(fromId);
                if (payload.description.type === 'offer') {
                    await pc.setLocalDescription(await pc.createAnswer());
                    socketRef.current?.emit('signal', fromId, { description: pc.localDescription });
                }
            } else if (payload?.candidate) {
                if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
                else pendingCandidatesRef.current.set(fromId, [...(pendingCandidatesRef.current.get(fromId) || []), payload.candidate]);
            }
        } catch (e) {
            setError('A connection could not be established. Please rejoin the meeting.');
        }
    }, [addPeer]);

    const join = async () => {
        const displayName = username.trim();
        if (!displayName || !roomId.trim()) { setError('Enter a name to join.'); return; }
        setError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        } catch (e) {
            try {
                localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
                if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
                setAudioOn(false);
            } catch (videoError) {
                try {
                    localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
                    setVideoOn(false);
                } catch (audioError) { setError('Allow microphone or camera access to join the meeting.'); return; }
            }
        }
        const socket = io(server, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;
        socket.on('connect', () => socket.emit('join-call', roomId));
        socket.on('connect_error', () => setError('Could not connect to the meeting server.'));
        socket.on('meeting-error', text => setError(text));
        socket.on('user-joined', (id, clients) => {
            clients.filter(peerId => peerId !== socket.id).forEach(peerId => addPeer(peerId, socket.id < peerId));
        });
        socket.on('signal', handleSignal);
        socket.on('user-left', id => {
            peersRef.current.get(id)?.close();
            peersRef.current.delete(id);
            pendingCandidatesRef.current.delete(id);
            screenAudioSendersRef.current.delete(id);
            remoteStreamsRef.current.delete(id);
            setVideos(current => current.filter(item => item.socketId !== id));
        });
        socket.on('chat-message', (data, sender, senderId) => {
            setMessages(current => [...current, { data, sender }]);
            if (senderId !== socket.id) setNewMessages(current => current + 1);
        });
        setJoined(true);
    };

    const toggleVideo = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) { track.enabled = !track.enabled; setVideoOn(track.enabled); }
    };
    const toggleAudio = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) { track.enabled = !track.enabled; setAudioOn(track.enabled); }
    };
    const toggleScreen = async () => {
        if (screenOn) { stopScreenShare(); return; }
        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            } catch (captureError) {
                if (!['TypeError', 'OverconstrainedError', 'NotSupportedError'].includes(captureError.name)) throw captureError;
                stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            }
            screenStreamRef.current = stream;
            const track = stream.getVideoTracks()[0];
            if (!track) throw new Error('Display capture did not provide a video track.');
            track.onended = stopScreenShare;
            const displayAudioTrack = stream.getAudioTracks()[0] || null;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            for (const [peerId, pc] of peersRef.current.entries()) {
                if (screenStreamRef.current !== stream || track.readyState === 'ended') return;
                const videoSender = pc.getTransceivers().find(item => item.receiver.track.kind === 'video')?.sender;
                if (videoSender) await videoSender.replaceTrack(track);
                const audioSender = screenAudioSendersRef.current.get(peerId);
                if (audioSender) await audioSender.replaceTrack(displayAudioTrack);
            }
            if (screenStreamRef.current !== stream || track.readyState === 'ended') return;
            setScreenOn(true);
        } catch (e) {
            if (screenStreamRef.current) stopScreenShare();
            if (e.name !== 'NotAllowedError') setError('Screen sharing could not be started.');
        }
    };
    const sendMessage = () => {
        const text = message.trim();
        if (!text || !socketRef.current?.connected) return;
        socketRef.current.emit('chat-message', text, username.trim());
        setMessage('');
    };
    const endCall = () => { cleanup(); navigate('/'); };

    return <div>{!joined ? <div>
        <h2>Enter into Lobby</h2>
        <TextField label="Username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && join()} />
        <Button variant="contained" onClick={join}>Connect</Button>
        <p role="alert">{error}</p>
        <video ref={localVideoRef} autoPlay muted playsInline />
    </div> : <div className={styles.meetVideoContainer}>
        {chatOpen && <div className={styles.chatRoom}><div className={styles.chatContainer}>
            <h1>Chat</h1><div className={styles.chattingDisplay}>
                {messages.length ? messages.map((item, index) => <div style={{ marginBottom: 20 }} key={index}><p style={{ fontWeight: 'bold' }}>{item.sender}</p><p>{item.data}</p></div>) : <p>No Messages Yet</p>}
            </div><div className={styles.chattingArea}>
                <TextField value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} label="Enter Your chat" />
                <Button variant="contained" onClick={sendMessage}>Send</Button>
            </div>
        </div></div>}
        <div className={styles.buttonContainers}>
            <IconButton aria-label={videoOn ? 'Turn camera off' : 'Turn camera on'} onClick={toggleVideo} style={{ color: 'white' }}>{videoOn ? <VideocamIcon /> : <VideocamOffIcon />}</IconButton>
            <IconButton aria-label="End call" onClick={endCall} style={{ color: 'red' }}><CallEndIcon /></IconButton>
            <IconButton aria-label={audioOn ? 'Mute microphone' : 'Unmute microphone'} onClick={toggleAudio} style={{ color: 'white' }}>{audioOn ? <MicIcon /> : <MicOffIcon />}</IconButton>
            {screenAvailable && <IconButton aria-label={screenOn ? 'Stop screen sharing' : 'Start screen sharing'} onClick={toggleScreen} style={{ color: 'white' }}>{screenOn ? <StopScreenShareIcon /> : <ScreenShareIcon />}</IconButton>}
            <Badge badgeContent={newMessages} max={999} color="warning"><IconButton onClick={() => { setChatOpen(open => !open); setNewMessages(0); }} style={{ color: 'white' }}><ChatIcon /></IconButton></Badge>
        </div>
        <p role="alert">{error}</p>
        <video className={styles.meetUserVideo} ref={localVideoRef} autoPlay muted playsInline />
        <div className={styles.conferenceView}>{videos.map(video => <div key={video.socketId}><video ref={ref => { if (ref && ref.srcObject !== video.stream) ref.srcObject = video.stream; }} autoPlay playsInline /></div>)}</div>
    </div>}</div>;
}
