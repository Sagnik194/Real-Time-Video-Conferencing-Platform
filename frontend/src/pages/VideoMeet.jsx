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

const peerConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function VideoMeetComponent() {
    const { url: roomId = '' } = useParams();
    const navigate = useNavigate();
    const socketRef = useRef(null);
    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const peersRef = useRef(new Map());
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
        peersRef.current.forEach(pc => {
            const sender = pc.getSenders().find(item => item.track?.kind === 'video' || item.track === null);
            if (sender) sender.replaceTrack(cameraTrack).catch(() => {});
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    }, []);

    const cleanup = useCallback(() => {
        socketRef.current?.disconnect();
        socketRef.current = null;
        peersRef.current.forEach(pc => pc.close());
        peersRef.current.clear();
        pendingCandidatesRef.current.clear();
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        screenStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        screenStreamRef.current = null;
    }, []);

    useEffect(() => {
        setScreenAvailable(Boolean(navigator.mediaDevices?.getDisplayMedia));
        return cleanup;
    }, [cleanup]);

    const addPeer = useCallback((peerId, shouldOffer) => {
        if (peerId === socketRef.current?.id || peersRef.current.has(peerId)) return peersRef.current.get(peerId);
        const pc = new RTCPeerConnection(peerConfig);
        peersRef.current.set(peerId, pc);
        const cameraStream = localStreamRef.current;
        const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
        (cameraStream?.getAudioTracks() || []).forEach(track => pc.addTrack(track, cameraStream));
        if (screenTrack && screenStreamRef.current) pc.addTrack(screenTrack, screenStreamRef.current);
        else (cameraStream?.getVideoTracks() || []).forEach(track => pc.addTrack(track, cameraStream));
        pc.onicecandidate = event => {
            if (event.candidate) socketRef.current?.emit('signal', peerId, { candidate: event.candidate });
        };
        pc.ontrack = event => {
            const stream = event.streams[0];
            if (stream) setVideos(current => [...current.filter(item => item.socketId !== peerId), { socketId: peerId, stream }]);
        };
        pc.onconnectionstatechange = () => {
            if (['failed', 'closed'].includes(pc.connectionState)) {
                pc.close();
                peersRef.current.delete(peerId);
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
            clients.filter(peerId => peerId !== socket.id).forEach(peerId => addPeer(peerId, socket.id.localeCompare(peerId) < 0));
        });
        socket.on('signal', handleSignal);
        socket.on('user-left', id => {
            peersRef.current.get(id)?.close();
            peersRef.current.delete(id);
            pendingCandidatesRef.current.delete(id);
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
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            screenStreamRef.current = stream;
            const track = stream.getVideoTracks()[0];
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            for (const [peerId, pc] of peersRef.current.entries()) {
                const sender = pc.getSenders().find(item => item.track?.kind === 'video');
                if (sender) await sender.replaceTrack(track);
                else {
                    pc.addTrack(track, stream);
                    await pc.setLocalDescription(await pc.createOffer());
                    socketRef.current?.emit('signal', peerId, { description: pc.localDescription });
                }
            }
            track.onended = stopScreenShare;
            setScreenOn(true);
        } catch (e) {
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
            <IconButton onClick={toggleVideo} style={{ color: 'white' }}>{videoOn ? <VideocamIcon /> : <VideocamOffIcon />}</IconButton>
            <IconButton onClick={endCall} style={{ color: 'red' }}><CallEndIcon /></IconButton>
            <IconButton onClick={toggleAudio} style={{ color: 'white' }}>{audioOn ? <MicIcon /> : <MicOffIcon />}</IconButton>
            {screenAvailable && <IconButton onClick={toggleScreen} style={{ color: 'white' }}>{screenOn ? <StopScreenShareIcon /> : <ScreenShareIcon />}</IconButton>}
            <Badge badgeContent={newMessages} max={999} color="warning"><IconButton onClick={() => { setChatOpen(open => !open); setNewMessages(0); }} style={{ color: 'white' }}><ChatIcon /></IconButton></Badge>
        </div>
        <p role="alert">{error}</p>
        <video className={styles.meetUserVideo} ref={localVideoRef} autoPlay muted playsInline />
        <div className={styles.conferenceView}>{videos.map(video => <div key={video.socketId}><video ref={ref => { if (ref && ref.srcObject !== video.stream) ref.srcObject = video.stream; }} autoPlay playsInline /></div>)}</div>
    </div>}</div>;
}
