import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Surface, useTheme, IconButton, TextInput } from 'react-native-paper';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    FadeInDown,
    FadeInUp
} from 'react-native-reanimated';
import SheetService from '../api/SheetService';
import { bi } from '../components/AppIcon';
import BrandMark from '../components/BrandMark';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../api/SheetService';

WebBrowser.maybeCompleteAuthSession();

const RegisterScreen = ({ navigation, route }) => {
    const params = route?.params || {};
    const theme = useTheme();
    const [role, setRole] = useState(params.role || 'user');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState('');
    const [secureText, setSecureText] = useState(true);

    const titleOpacity = useSharedValue(0);
    const titleTranslateY = useSharedValue(-20);

    useEffect(() => {
        titleOpacity.value = withTiming(1, { duration: 800 });
        titleTranslateY.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.exp) });
    }, []);

    const titleStyle = useAnimatedStyle(() => ({
        opacity: titleOpacity.value,
        transform: [{ translateY: titleTranslateY.value }],
    }));

    // ── Manual Registration ──────────────────────────────────────────────
    const handleRegister = async () => {
        if (!name.trim() || !email.trim() || !password.trim()) {
            setError('Please fill in all fields');
            return;
        }

        if (role === 'biker') {
            // For bikers, move to BikerDetails to collect vehicle info
            navigation.navigate('BikerDetails', {
                name: name.trim(),
                email: email.trim(),
                password: password.trim(),
                role: 'biker'
            });
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await SheetService.registerUser({
                name: name.trim(),
                email: email.trim(),
                password: password.trim(),
                role: 'user',
            });

            if (res?.success) {
                navigation.replace('MainApp');
            } else {
                setError(res?.message || 'Registration failed');
            }
        } catch (e) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Handle provider registration ──
    const handleProviderRegister = async (userEmail, userName, photo, providerId, providerName) => {
        if (role === 'biker') {
            navigation.navigate('BikerDetails', {
                name: userName, email: userEmail, photo,
                provider: providerName,
                providerId,
                role: 'biker'
            });
            return;
        }

        const res = await SheetService.providerAuth({
            email: userEmail,
            name: userName,
            provider: providerName,
            providerId,
            role: 'user',
            photo
        });

        if (res?.success) {
            navigation.replace('MainApp');
        } else {
            setError(res?.message || 'Registration failed');
        }
    };

    // ── Google Sign-Up ──
    const handleGoogleSignUp = async () => {
        setGoogleLoading(true);
        setError('');

        try {
            if (!supabase) { setError('Auth not configured'); setGoogleLoading(false); return; }

            const redirectUrl = makeRedirectUri({ scheme: 'bikerapp', path: 'auth/callback' });

            const { data, error: authError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    queryParams: { prompt: 'select_account' },
                },
            });

            if (authError) throw authError;

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

                if (result.type === 'success' && result.url) {
                    const url = new URL(result.url);
                    const fragment = url.hash?.substring(1);
                    const params = new URLSearchParams(fragment);
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (accessToken) {
                        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (sessionError) throw sessionError;

                        const supaUser = sessionData?.user;
                        if (!supaUser) throw new Error('No user from Google');

                        const googleEmail = supaUser.email;
                        const googleName = supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || googleEmail.split('@')[0];
                        const photo = supaUser.user_metadata?.avatar_url || null;

                        await handleProviderRegister(googleEmail, googleName, photo, supaUser.id, 'google');
                    } else {
                        setError('Sign-up cancelled or failed.');
                    }
                } else {
                    setError('Sign-up cancelled');
                }
            }
        } catch (e) {
            console.error('[RegisterScreen] Google Error:', e);
            setError(e.message || 'Google sign-up failed.');
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: '#0B0B0B' }]}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.content}>
                    <Animated.View style={[styles.header, titleStyle]}>
                        <BrandMark size={40} subtitle="create account" />
                    </Animated.View>

                    {/* Role Toggle */}
                    <Animated.View entering={FadeInDown.delay(100).duration(800)}>
                        <View style={styles.roleContainer}>
                            <TouchableOpacity
                                style={[styles.roleButton, role === 'user' && styles.roleButtonActive]}
                                onPress={() => setRole('user')}
                            >
                                <IconButton icon={bi('account')} size={18} iconColor={role === 'user' ? '#000' : '#888'} style={{ margin: 0 }} />
                                <Text style={[styles.roleText, role === 'user' && styles.roleTextActive]}>Customer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.roleButton, role === 'biker' && styles.roleButtonActive]}
                                onPress={() => setRole('biker')}
                            >
                                <IconButton icon={bi('motorbike')} size={18} iconColor={role === 'biker' ? '#000' : '#888'} style={{ margin: 0 }} />
                                <Text style={[styles.roleText, role === 'biker' && styles.roleTextActive]}>Biker</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>

                    {/* Manual Form */}
                    <Animated.View entering={FadeInDown.delay(200).duration(800)}>
                        <Surface style={styles.surface} elevation={0}>
                            <View style={styles.infoCard}>
                                <Text style={styles.infoTitle}>
                                    {role === 'biker' ? 'Register as a Biker' : 'Create Your Account'}
                                </Text>
                            </View>

                            {error ? (
                                <View style={styles.errorBox}>
                                    <IconButton icon={bi('alert-circle')} size={18} iconColor="#ff6b6b" style={{ margin: 0 }} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            <TextInput
                                label="Full Name"
                                value={name}
                                onChangeText={setName}
                                mode="outlined"
                                autoCapitalize="words"
                                left={<TextInput.Icon icon={bi('account')} />}
                                style={styles.input}
                                outlineColor="rgba(255,255,255,0.1)"
                                activeOutlineColor="#00FD3F"
                                theme={{ colors: { background: 'rgba(255,255,255,0.02)', text: '#FFF', placeholder: '#666' } }}
                            />

                            <TextInput
                                label="Email"
                                value={email}
                                onChangeText={setEmail}
                                mode="outlined"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                left={<TextInput.Icon icon={bi('mail')} />}
                                style={styles.input}
                                outlineColor="rgba(255,255,255,0.1)"
                                activeOutlineColor="#00FD3F"
                                theme={{ colors: { background: 'rgba(255,255,255,0.02)', text: '#FFF', placeholder: '#666' } }}
                            />

                            <TextInput
                                label="Password"
                                value={password}
                                onChangeText={setPassword}
                                mode="outlined"
                                secureTextEntry={secureText}
                                left={<TextInput.Icon icon={bi('lock')} />}
                                right={<TextInput.Icon icon={bi(secureText ? 'eye-off' : 'eye')} onPress={() => setSecureText(!secureText)} forceTextInputFocus={false} />}
                                style={styles.input}
                                outlineColor="rgba(255,255,255,0.1)"
                                activeOutlineColor="#00FD3F"
                                theme={{ colors: { background: 'rgba(255,255,255,0.02)', text: '#FFF', placeholder: '#666' } }}
                            />

                            <TouchableOpacity
                                style={styles.registerButton}
                                onPress={handleRegister}
                                disabled={loading || googleLoading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : (
                                    <Text style={styles.registerButtonText}>
                                        {role === 'biker' ? 'Next: Vehicle Details' : 'Create Account'}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.dividerContainer}>
                                <View style={styles.divider} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.divider} />
                            </View>

                            <TouchableOpacity
                                style={styles.googleButton}
                                onPress={handleGoogleSignUp}
                                disabled={loading || googleLoading}
                                activeOpacity={0.8}
                            >
                                {googleLoading ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : (
                                    <>
                                        <IconButton icon={bi('google')} size={18} iconColor="#FFF" style={{ margin: 0 }} />
                                        <Text style={styles.googleButtonText}>
                                            {role === 'biker' ? 'Sign up with Google' : 'Sign up with Google'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </Surface>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(300).duration(800)} style={styles.footer}>
                        <Text style={styles.footerText}>
                            Already have an account?{" "}
                            <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
                                Sign In
                            </Text>
                        </Text>
                        <Text style={[styles.footerText, { marginTop: 16, fontSize: 12, textAlign: 'center' }]}>
                            By continuing, you agree to our{' '}
                            <Text style={styles.link}>Terms of Service</Text>
                            {' '}and{' '}
                            <Text style={styles.link}>Privacy Policy</Text>
                        </Text>
                    </Animated.View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    content: { flex: 1, padding: 24, paddingVertical: 40, justifyContent: 'center' },
    header: { marginBottom: 24, alignItems: 'center' },
    roleContainer: {
        flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 12,
    },
    roleButton: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25,
        borderWidth: 1, borderColor: '#333', backgroundColor: 'rgba(255,255,255,0.02)', gap: 4,
    },
    roleButtonActive: {
        backgroundColor: '#00FD3F', borderColor: '#00FD3F',
        shadowColor: '#00FD3F', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
    },
    roleText: { color: '#888', fontWeight: 'normal', fontSize: 13 },
    roleTextActive: { color: '#000', fontWeight: '600', fontSize: 13 },
    surface: {
        borderRadius: 20, padding: 20, backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    },
    infoCard: { alignItems: 'center', marginBottom: 20 },
    infoTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', textAlign: 'center' },
    errorBox: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 10, padding: 10, marginBottom: 16, gap: 8,
    },
    errorText: { color: '#ff6b6b', fontSize: 12, flex: 1 },
    input: {
        marginBottom: 16, height: 50, fontSize: 14,
    },
    registerButton: {
        backgroundColor: '#00FD3F', borderRadius: 12, height: 48,
        alignItems: 'center', justifyContent: 'center', marginTop: 8,
    },
    registerButtonText: { color: '#000', fontSize: 15, fontWeight: 'bold' },
    dividerContainer: {
        flexDirection: 'row', alignItems: 'center', marginVertical: 20,
    },
    divider: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
    dividerText: { marginHorizontal: 12, color: '#666', fontSize: 12 },
    googleButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#1A1A1A', borderRadius: 12, height: 48, gap: 6,
        borderWidth: 1, borderColor: '#333',
    },
    googleButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
    footer: { marginTop: 24, marginBottom: 20, alignItems: 'center' },
    footerText: { color: '#888', fontSize: 14 },
    link: { color: '#00FD3F', fontWeight: '600' },
});

export default RegisterScreen;
