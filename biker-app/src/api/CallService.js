// CallService.js
import { io } from 'socket.io-client';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioModule } from 'expo-audio';
import SheetService from './SheetService';

class CallService {
    static socket = null;
    static currentCallId = null;
    static onCallStateChange = null;
    static isWebRTCSupported = false;
    static userId = null;
    static rtcPeerConnection = null;
    static localStream = null;
    static remoteStream = null;
    static initiatorId = null;
    static lastCalledId = null;

    /** Check if device supports WebRTC */
    static checkSupport() {
        try {
            // In React Native with react-native-webrtc, RTCPeerConnection usually exists globally
            this.isWebRTCSupported = typeof global.RTCPeerConnection !== 'undefined' || typeof window.RTCPeerConnection !== 'undefined';
        } catch (e) {
            this.isWebRTCSupported = false;
        }
        return this.isWebRTCSupported;
    }

    /** Initialize socket and auto-register user */
    static async init(userId = null) {
        if (userId) this.userId = userId;
        const currentUserId = this.userId || SheetService.currentUser?.id;
        if (currentUserId) this.userId = currentUserId;

        if (this.socket) {
            if (this.socket.connected && this.userId) {
                this.socket.emit('register_call', { userId: String(this.userId) });
            }
            return;
        }

        const url = SheetService.getApiUrl ? SheetService.getApiUrl() : 'http://192.168.100.145:3003';
        const token = await AsyncStorage.getItem('auth_token');

        try {
            this.socket = io(url, {
                transports: ['websocket'],
                autoConnect: true,
                path: '/ws/tracking',
                auth: { token }
            });

            this.socket.on('connect', () => {
                if (this.userId) {
                    this.socket.emit('register_call', { userId: String(this.userId) });
                }
            });

            this.socket.on('incoming_call', (data) => {
                console.log('[CallService] Incoming call:', data);
                if (this.currentCallId && this.currentCallId !== data.callId) return; // Busy
                this.currentCallId = data.callId;
                this.initiatorId = data.from;
                if (this.onCallStateChange) this.onCallStateChange('incoming');
            });

            this.socket.on('call_accepted', async (data) => {
                console.log('[CallService] Call accepted, initiating WebRTC offer');
                if (this.onCallStateChange) this.onCallStateChange('connected');

                // Auto-record outgoing call for the initiator
                SheetService.recordCall({
                    userId: String(this.userId),
                    recipientId: String(data.by),
                    name: 'User Call',
                    type: 'outgoing',
                    startTime: new Date().toISOString()
                }).catch(err => console.error('[AGENT] Record call failed:', err));

                await this.createPeerConnection(data.by);
                const offer = await this.rtcPeerConnection.createOffer();
                await this.rtcPeerConnection.setLocalDescription(offer);
                this.socket.emit('call_offer', { to: data.by, offer, callId: this.currentCallId });
            });

            this.socket.on('call_offer', async (data) => {
                console.log('[CallService] Received WebRTC offer');
                await this.createPeerConnection(data.from);
                await this.rtcPeerConnection.setRemoteDescription(new global.RTCSessionDescription(data.offer));
                const answer = await this.rtcPeerConnection.createAnswer();
                await this.rtcPeerConnection.setLocalDescription(answer);
                this.socket.emit('call_answer', { to: data.from, answer, callId: this.currentCallId });
            });

            this.socket.on('call_answer', async (data) => {
                console.log('[CallService] Received WebRTC answer');
                if (this.rtcPeerConnection) {
                    await this.rtcPeerConnection.setRemoteDescription(new global.RTCSessionDescription(data.answer));
                }
            });

            this.socket.on('ice_candidate', async (data) => {
                if (this.rtcPeerConnection) {
                    try {
                        await this.rtcPeerConnection.addIceCandidate(new global.RTCIceCandidate(data.candidate));
                    } catch (e) { console.warn('[WebRTC] Candidate error', e); }
                }
            });

            this.socket.on('call_ended', () => {
                this.cleanUp();
                if (this.onCallStateChange) this.onCallStateChange('idle');
            });

            this.socket.on('call_busy', () => {
                this.cleanUp();
                if (this.onCallStateChange) this.onCallStateChange('busy');
            });

        } catch (e) {
            console.log('[CallService] init error:', e.message);
        }
    }

    static async createPeerConnection(targetId) {
        if (this.rtcPeerConnection) return;

        // Configure audio mode for call
        await this.prepareAudioMode();

        const config = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };

        this.rtcPeerConnection = new global.RTCPeerConnection(config);

        this.rtcPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice_candidate', { to: targetId, candidate: event.candidate, callId: this.currentCallId });
            }
        };

        this.rtcPeerConnection.onaddstream = (event) => {
            console.log('[WebRTC] Remote stream added');
            this.remoteStream = event.stream;
            // In a real app, you'd attach this stream to a <RTCView> or use an audio element
        };

        // Capture local mic
        try {
            const stream = await global.mediaDevices.getUserMedia({ audio: true, video: false });
            this.localStream = stream;
            this.rtcPeerConnection.addStream(stream);
        } catch (e) {
            console.warn('[WebRTC] Mic access failed', e);
        }
    }

    static async prepareAudioMode() {
        try {
            await AudioModule.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: true, // Typically for calls
                interruptionModeIOS: 1, // Do not mix
            });
        } catch (e) {
            console.log('[CallService] AudioMode error:', e.message);
        }
    }

    /** Start a call to another user */
    static async initiateCall(toUserId) {
        if (!this.userId) return false;
        if (!this.socket?.connected) return false;

        this.currentCallId = `call_${Date.now()}`;
        this.lastCalledId = toUserId;
        if (this.onCallStateChange) this.onCallStateChange('calling');

        this.socket.emit('initiate_call', {
            to: String(toUserId),
            from: String(this.userId),
            callId: this.currentCallId,
        });

        return true;
    }

    /** Accept an incoming call */
    static async acceptCall() {
        if (!this.socket?.connected || !this.currentCallId) return;

        // Auto-record incoming call for the receiver
        SheetService.recordCall({
            userId: String(this.userId),
            recipientId: String(this.initiatorId),
            name: 'User Call',
            type: 'incoming',
            startTime: new Date().toISOString()
        }).catch(err => console.error('[AGENT] Record call failed:', err));

        this.socket.emit('accept_call', {
            callId: this.currentCallId,
            to: String(this.userId),
            initiatorId: String(this.initiatorId),
        });
        if (this.onCallStateChange) this.onCallStateChange('connected');
    }

    /** End call and clean up */
    static endCall() {
        if (this.socket?.connected && this.currentCallId) {
            this.socket.emit('end_call', {
                callId: this.currentCallId,
                targetId: String(this.initiatorId || this.lastCalledId)
            });
        }
        this.cleanUp();
        if (this.onCallStateChange) this.onCallStateChange('ended');
        setTimeout(() => { if (this.onCallStateChange) this.onCallStateChange('idle'); }, 1500);
    }

    static toggleMute(muted) {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !muted;
            });
        }
    }

    static async toggleSpeaker(on) {
        try {
            await AudioModule.setAudioModeAsync({
                playThroughEarpieceAndroid: !on,
                playsInSilentModeIOS: true,
                allowsRecordingIOS: true,
            });
        } catch (e) {
            console.warn('[CallService] Speaker toggle failed', e);
        }
    }

    static cleanUp() {
        this.currentCallId = null;
        this.initiatorId = null;
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        if (this.rtcPeerConnection) {
            this.rtcPeerConnection.close();
            this.rtcPeerConnection = null;
        }
        // Reset audio mode
        AudioModule.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => { });
    }
}

export default CallService;
