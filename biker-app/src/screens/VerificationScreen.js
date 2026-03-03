import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { Text, Surface, useTheme, TextInput } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import CustomButton from '../components/CustomButton';
import SheetService from '../api/SheetService';
import BrandMark from '../components/BrandMark';

const VerificationScreen = ({ navigation, route }) => {
    const { email, role, userData, isBikerStep2 = false } = route.params;
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(60);

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleVerify = async () => {
        if (code.length < 6) {
            setError('Please enter the 6-digit code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const verifyRes = await SheetService.verifyOtp(email, code, 'email_verification', role);
            if (verifyRes.success) {
                // If verified, proceed with final registration
                const registerRes = await SheetService.registerUser(userData);

                if (registerRes.success) {
                    const user = registerRes.data.user;

                    // Handle trial for new bikers after verification
                    if (role === 'biker') {
                        try {
                            const userId = user.id;
                            const startDate = new Date();
                            const expiry = new Date(startDate);
                            expiry.setDate(expiry.getDate() + 30);

                            await SheetService.createBikerSubscription(userId, {
                                subscriptionType: 'trial',
                                amount: 0,
                                currency: 'USD',
                                startDate: startDate.toISOString().split('T')[0],
                                expiryDate: expiry.toISOString().split('T')[0],
                                subscriptionStatus: 'active',
                                notes: 'Registration 30-day free trial'
                            });
                        } catch (trialErr) {
                            console.log('[Verification] Trial creation failed:', trialErr.message);
                        }
                    }

                    // Direct navigation based on role
                    if (role === 'biker') {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'BikerApp' }],
                        });
                    } else {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'MainApp' }],
                        });
                    }
                } else {
                    setError(registerRes.message || 'Registration failed after verification');
                }
            } else {
                setError(verifyRes.message || 'Invalid verification code');
            }
        } catch (err) {
            setError(err.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setLoading(true);
        try {
            const res = await SheetService.generateOtp(email, 'email_verification', role);
            if (res.success) {
                setTimer(60);
                Alert.alert('Sent', 'A new verification code has been sent to your email.');
            } else {
                setError(res.message || 'Failed to resend code');
            }
        } catch (err) {
            setError('Error resending code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: '#0B0B0B' }]}
        >
            <View style={styles.content}>
                <Animated.View entering={FadeInDown.duration(800)} style={styles.header}>
                    <BrandMark size={40} subtitle="Verify Your Email" />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200).duration(800)}>
                    <Surface style={styles.surface} elevation={0}>
                        <Text style={styles.instruction}>
                            We've sent a 6-digit verification code to
                            <Text style={styles.emailText}> {email}</Text>.
                            Please enter it below to complete your registration.
                        </Text>

                        <TextInput
                            value={code}
                            onChangeText={(val) => {
                                setCode(val.replace(/[^0-9]/g, '').slice(0, 6));
                                setError('');
                            }}
                            keyboardType="number-pad"
                            placeholder="000000"
                            mode="outlined"
                            style={styles.otpInput}
                            outlineColor="rgba(255,255,255,0.1)"
                            activeOutlineColor="#00FD3F"
                            textColor="#FFFFFF"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            maxLength={6}
                        />

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        <CustomButton
                            title="Verify & Create Account"
                            onPress={handleVerify}
                            loading={loading}
                            disabled={loading || code.length < 6}
                            style={styles.button}
                            labelStyle={styles.buttonLabel}
                        />

                        <View style={styles.resendContainer}>
                            <Text style={styles.resendText}>Didn't receive a code? </Text>
                            {timer > 0 ? (
                                <Text style={styles.timerText}>Resend in {timer}s</Text>
                            ) : (
                                <TouchableOpacity onPress={handleResend}>
                                    <Text style={styles.resendLink}>Resend Code</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </Surface>
                </Animated.View>

                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backText}>Change Email</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, padding: 24, justifyContent: 'center' },
    header: { marginBottom: 40, alignItems: 'center' },
    surface: {
        borderRadius: 24,
        padding: 24,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    instruction: {
        color: '#AAA',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32
    },
    emailText: { color: '#00FD3F', fontWeight: 'bold' },
    otpInput: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        textAlign: 'center',
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 8,
        height: 70,
        marginBottom: 12
    },
    errorText: { color: '#ff6b6b', textAlign: 'center', marginBottom: 16, fontSize: 13 },
    button: { height: 56, borderRadius: 16, backgroundColor: '#00FD3F', justifyContent: 'center', marginTop: 12 },
    buttonLabel: { color: '#000', fontSize: 18, fontWeight: '900' },
    resendContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
    resendText: { color: '#777' },
    resendLink: { color: '#00FD3F', fontWeight: 'bold' },
    timerText: { color: '#555' },
    backButton: { marginTop: 32, alignItems: 'center' },
    backText: { color: '#00FD3F', fontWeight: 'bold' }
});

export default VerificationScreen;
