// CallService.js
import { io } from 'socket.io-client';
import { Alert } from 'react-native';
import SheetService from './SheetService';

const SOCKET_URL = SheetService.resolveApiUrl ? SheetService.resolveApiUrl() : 'http://192.168.1.2:3003';

class CallService {
    static socket = null;
    static currentCallId = null;
    static onCallStateChange = null;
    static isWebRTCSupported = false;
    static userId = null;

    /** Check if device supports WebRTC */
    static checkSupport() {
        try {
            this.isWebRTCSupported = typeof global.RTCPeerConnection !== 'undefined';
        } catch (e) {
            this.isWebRTCSupported = false;
        }
        return this.isWebRTCSupported;
    }

    /** Initialize socket and auto-register user from SheetService */
    static init() {
        if (this.socket) return;

        this.userId = SheetService.getUserId?.();
        if (!this.userId) {
            console.warn('[CallService] No user ID found in SheetService');
        }

        try {
            this.socket = io(SOCKET_URL, {
                transports: ['websocket'],
                autoConnect: true,
            });

            this.socket.on('connect', () => {
                console.log('[CallService] Socket connected');
                if (this.userId) {
                    this.socket.emit('register_call', { userId: this.userId });
                }
            });

            // Incoming call
            this.socket.on('incoming_call', (data) => {
                const { from, callId } = data;
                this.currentCallId = callId;
                if (this.onCallStateChange) this.onCallStateChange('incoming', from);
            });

            // Call ended
            this.socket.on('call_ended', (data) => {
                console.log('[CallService] Call ended', data);
                this.currentCallId = null;
                if (this.onCallStateChange) this.onCallStateChange('idle');
            });

            // Called user busy
            this.socket.on('call_busy', (data) => {
                console.log('[CallService] Call busy', data);
                if (this.onCallStateChange) this.onCallStateChange('busy');
            });

            // Disconnect event
            this.socket.on('disconnect', () => {
                console.log('[CallService] Socket disconnected');
                this.currentCallId = null;
                if (this.onCallStateChange) this.onCallStateChange('idle');
            });
        } catch (e) {
            console.log('[CallService] init error:', e.message);
        }
    }

    /** Start a call to another user (auto uses registered user) */
    static async initiateCall(toUserId) {
        if (!this.userId) {
            Alert.alert('Error', 'You are not registered.');
            return false;
        }

        if (!this.socket?.connected) {
            Alert.alert('Error', 'Not connected. Try again.');
            return false;
        }

        this.currentCallId = 'call-' + Date.now();
        if (this.onCallStateChange) this.onCallStateChange('calling');

        this.socket.emit('initiate_call', {
            to: toUserId,
            from: this.userId,
            callId: this.currentCallId,
        });

        return true;
    }

    /** End the current call */
    static endCall() {
        if (this.currentCallId && this.socket?.connected) {
            this.socket.emit('end_call', { callId: this.currentCallId });
        }
        this.currentCallId = null;
        if (this.onCallStateChange) this.onCallStateChange('idle');
    }

    /** Disconnect socket completely */
    static disconnect() {
        this.endCall();
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

export default CallService;