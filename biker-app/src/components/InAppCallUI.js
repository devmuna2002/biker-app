import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
    Modal,
    Platform,
    Vibration,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Text, Avatar, IconButton, useTheme, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { bi } from './AppIcon';

const { width, height } = Dimensions.get('window');

/**
 * Modern In-App Call UI
 * Designed to feel like a premium VoIP experience (WhatsApp/iOS inspired)
 */
const InAppCallUI = ({
    visible,
    status, // 'calling', 'incoming', 'connected', 'busy', 'ended'
    recipientName,
    recipientPhoto,
    onEndCall,
    onAcceptCall,
    onRejectCall,
}) => {
    const theme = useTheme();
    const [timer, setTimer] = useState(0);
    const timerInterval = useRef(null);

    // Pulse animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const pulseAlpha = useRef(new Animated.Value(0.3)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (status === 'connected') {
            setTimer(0);
            timerInterval.current = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        } else {
            if (timerInterval.current) clearInterval(timerInterval.current);
        }

        if (status === 'calling' || status === 'incoming') {
            Animated.loop(
                Animated.parallel([
                    Animated.sequence([
                        Animated.timing(pulseAnim, { toValue: 1.5, duration: 2000, useNativeDriver: true }),
                        Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
                    ]),
                    Animated.sequence([
                        Animated.timing(pulseAlpha, { toValue: 0, duration: 2000, useNativeDriver: true }),
                        Animated.timing(pulseAlpha, { toValue: 0.3, duration: 0, useNativeDriver: true }),
                    ])
                ])
            ).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(floatAnim, { toValue: -15, duration: 1500, useNativeDriver: true }),
                    Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
                ])
            ).start();

            if (status === 'incoming') {
                Vibration.vibrate([500, 1000, 500, 1000], true);
            }
        } else {
            Vibration.cancel();
        }

        return () => {
            if (timerInterval.current) clearInterval(timerInterval.current);
            Vibration.cancel();
        };
    }, [status]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaker, setIsSpeaker] = useState(false);
    const [isMonitoring, setIsMonitoring] = useState(false);

    const toggleMute = () => {
        const next = !isMuted;
        setIsMuted(next);
        CallService.toggleMute(next);
    };

    const toggleSpeaker = () => {
        const next = !isSpeaker;
        setIsSpeaker(next);
        CallService.toggleSpeaker(next);
    };

    const toggleMonitoring = () => {
        // This simulates 'hearing oneself' by adjusting audio mode if supported,
        // or just giving a visual cue that the mic is active.
        setIsMonitoring(!isMonitoring);
        // Sidetone usually depends on OS/Hardware, but we can toggle playback mode
        AudioModule.setAudioModeAsync({
            playsInSilentModeIOS: true,
            allowsRecordingIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: !isSpeaker,
        }).catch(() => { });
    };

    if (!visible) return null;

    const isConnected = status === 'connected';

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View style={styles.container}>
                <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />

                <LinearGradient
                    colors={['rgba(20,20,20,0.6)', 'rgba(0,0,0,0.95)']}
                    style={StyleSheet.absoluteFill}
                />

                {/* Ambient dynamic backlights */}
                <View style={styles.ambientLights}>
                    <View style={[styles.lightBlob, { backgroundColor: isConnected ? '#2ECC71' : '#00FD3F', left: -50, top: -50, opacity: 0.15 }]} />
                    <View style={[styles.lightBlob, { backgroundColor: '#9B59B6', right: -50, bottom: -50, opacity: 0.1 }]} />
                </View>

                {/* Animated Background Pulse */}
                {(status === 'calling' || status === 'incoming') && (
                    <View style={styles.pulseContainer}>
                        <Animated.View
                            style={[
                                styles.bgPulse,
                                {
                                    transform: [{ scale: pulseAnim }],
                                    opacity: pulseAlpha,
                                    borderColor: status === 'incoming' ? '#2ECC71' : '#00FD3F'
                                }
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.bgPulse,
                                {
                                    transform: [{ scale: pulseAnim.interpolate({ inputRange: [1, 1.5], outputRange: [0.8, 1.25] }) }],
                                    opacity: pulseAlpha.interpolate({ inputRange: [0, 0.3], outputRange: [0, 0.15] }),
                                    borderColor: status === 'incoming' ? '#2ECC71' : '#00FD3F'
                                }
                            ]}
                        />
                    </View>
                )}

                <View style={styles.content}>
                    <View style={styles.header}>
                        <Surface style={styles.securedBadge} elevation={0}>
                            <IconButton icon={bi('shield-check')} size={12} iconColor="#2ECC71" style={{ margin: 0 }} />
                            <Text style={styles.encryptedText}>SECURE END-TO-END WIFI CALL</Text>
                        </Surface>
                    </View>

                    <View style={styles.profileSection}>
                        <Animated.View style={[
                            styles.avatarContainer,
                            { transform: [{ translateY: floatAnim }] }
                        ]}>
                            {recipientPhoto ? (
                                <Avatar.Image size={140} source={{ uri: recipientPhoto }} style={styles.avatar} />
                            ) : (
                                <Avatar.Text size={140} label={recipientName?.[0]?.toUpperCase() || 'U'} style={styles.avatar} color="#000" />
                            )}
                            {isConnected && (
                                <View style={styles.liveIndicator}>
                                    <View style={styles.liveDot} />
                                </View>
                            )}
                        </Animated.View>

                        <Text style={styles.name}>{recipientName || 'Biker'}</Text>

                        <View style={styles.statusContainer}>
                            {isConnected && <View style={styles.timerDot} />}
                            <Text style={[
                                styles.statusText,
                                { color: isConnected ? '#2ECC71' : 'rgba(255,255,255,0.5)' }
                            ]}>
                                {status === 'connected' ? formatTime(timer) :
                                    status === 'incoming' ? 'Incoming...' :
                                        status === 'calling' ? 'Calling...' :
                                            status === 'busy' ? 'User Busy' :
                                                status === 'ended' ? 'Call Ended' : 'Connecting...'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        {status === 'incoming' ? (
                            <View style={styles.incomingRow}>
                                <TouchableOpacity style={styles.callActionWrapper} onPress={onRejectCall}>
                                    <LinearGradient colors={['#FF4B2B', '#FF416C']} style={styles.actionBtn}>
                                        <IconButton icon={bi('phone-hangup')} size={30} iconColor="#FFF" />
                                    </LinearGradient>
                                    <Text style={styles.btnLabel}>Decline</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.callActionWrapper} onPress={onAcceptCall}>
                                    <LinearGradient colors={['#00b09b', '#96c93d']} style={styles.actionBtn}>
                                        <IconButton icon={bi('phone-check')} size={30} iconColor="#FFF" />
                                    </LinearGradient>
                                    <Text style={styles.btnLabel}>Accept</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.controlsLayer}>
                                <View style={styles.utilityGrid}>
                                    <TouchableOpacity onPress={toggleMute}>
                                        <BlurView intensity={isMuted ? 80 : 20} tint={isMuted ? "dark" : "light"} style={styles.glassBtn}>
                                            <IconButton icon={bi(isMuted ? 'microphone-off' : 'microphone')} size={26} iconColor={isMuted ? "#E74C3C" : "#FFF"} />
                                            <Text style={[styles.utilLabel, isMuted && { color: '#E74C3C' }]}>Mute</Text>
                                        </BlurView>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={toggleSpeaker}>
                                        <BlurView intensity={isSpeaker ? 80 : 20} tint={isSpeaker ? "dark" : "light"} style={styles.glassBtn}>
                                            <IconButton icon={bi(isSpeaker ? 'volume-high' : 'volume-medium')} size={26} iconColor={isSpeaker ? "#2ECC71" : "#FFF"} />
                                            <Text style={[styles.utilLabel, isSpeaker && { color: '#2ECC71' }]}>Speaker</Text>
                                        </BlurView>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={toggleMonitoring}>
                                        <BlurView intensity={isMonitoring ? 80 : 20} tint={isMonitoring ? "dark" : "light"} style={styles.glassBtn}>
                                            <IconButton icon={bi('hearing')} size={26} iconColor={isMonitoring ? "#F1C40F" : "#FFF"} />
                                            <Text style={[styles.utilLabel, isMonitoring && { color: '#F1C40F' }]}>Monitor</Text>
                                        </BlurView>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => Alert.alert('Keypad', 'Numbers dialed during call will use DTMF signaling.')}>
                                        <BlurView intensity={20} tint="light" style={styles.glassBtn}>
                                            <IconButton icon={bi('numeric')} size={26} iconColor="#FFF" />
                                            <Text style={styles.utilLabel}>Keypad</Text>
                                        </BlurView>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity style={styles.hangupWrapper} onPress={onEndCall}>
                                    <LinearGradient colors={['#E74C3C', '#C0392B']} style={styles.bigHangupBtn}>
                                        <IconButton icon={bi('phone-hangup')} size={38} iconColor="#FFF" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 60,
        zIndex: 10,
    },
    ambientLights: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    lightBlob: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
    },
    pulseContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bgPulse: {
        position: 'absolute',
        width: width * 0.7,
        height: width * 0.7,
        borderRadius: width * 0.35,
        borderWidth: 2,
    },
    header: {
        alignItems: 'center',
    },
    securedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingRight: 12,
        paddingLeft: 4,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    encryptedText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    profileSection: {
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        padding: 5,
        borderRadius: 80,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    avatar: {
        backgroundColor: '#2D3436',
    },
    liveIndicator: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#000',
        borderWidth: 3,
        borderColor: '#2ECC71',
        justifyContent: 'center',
        alignItems: 'center',
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#2ECC71',
    },
    name: {
        color: '#FFF',
        fontSize: 34,
        fontWeight: '900',
        marginTop: 25,
        letterSpacing: -0.5,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    timerDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#2ECC71',
        marginRight: 8,
    },
    statusText: {
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    footer: {
        width: '100%',
        paddingHorizontal: 30,
    },
    incomingRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    callActionWrapper: {
        alignItems: 'center',
        gap: 10,
    },
    actionBtn: {
        width: 76,
        height: 76,
        borderRadius: 38,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    controlsLayer: {
        alignItems: 'center',
    },
    utilityGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 40,
    },
    glassBtn: {
        width: 70,
        height: 85,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    utilLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        fontWeight: '700',
        marginTop: -5,
    },
    bigHangupBtn: {
        width: 84,
        height: 84,
        borderRadius: 42,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#E74C3C',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 12,
    },
    btnLabel: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});

export default InAppCallUI;
