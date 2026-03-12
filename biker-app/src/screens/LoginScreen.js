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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/SheetService';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = ({ navigation, route, setUser }) => {
    const params = route?.params || {};
    const theme = useTheme();
    const [role, setRole] = useState(params.role || 'user');
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

    // ── Manual Login ──────────────────────────────────────────────
    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            setError('Please enter both email and password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await SheetService.loginUser(email.trim(), password.trim(), role);

            if (res.success) {
                await AsyncStorage.setItem('chosenRole', role);
                if (setUser) setUser(res.data.user);
                if (role === 'biker') {
                    navigation.replace('BikerApp');
                } else {
                    navigation.replace('MainApp');
                }
            } else {
                setError(res.message || 'Invalid credentials');
            }
        } catch (e) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Handle backend login/register after Google OAuth ──
    const handleProviderAuth = async (userEmail, name, photo, providerId, providerName) => {
        const res = await SheetService.providerAuth({
            email: userEmail,
            name,
            provider: providerName,
            providerId,
            role,
            photo
        });

        if (res?.success) {
            await AsyncStorage.setItem('chosenRole', role);
            if (setUser) setUser(res.data.user);
            navigation.replace(role === 'biker' ? 'BikerApp' : 'MainApp');
        } else {
            setError(res?.message || `Failed to sign in with ${providerName}. Try again.`);
        }
    };

    // ── Google Sign-In ──────────────────────────────────────────────
    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setError('');

        try {
            if (!supabase) {
                setError('Authentication service not configured');
                setGoogleLoading(false);
                return;
            }

            const redirectUrl = makeRedirectUri({ scheme: 'bikerapp', path: 'auth/callback' });

            const { data, error: authError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: false,
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
                        if (!supaUser) throw new Error('No user from Google sign-in');

                        const googleEmail = supaUser.email;
                        const name = supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || googleEmail.split('@')[0];
                        const photo = supaUser.user_metadata?.avatar_url || null;

                        await handleProviderAuth(googleEmail, name, photo, supaUser.id, 'google');
                    } else {
                        setError('Sign-in was cancelled or failed. Please try again.');
                    }
                } else {
                    setError('Sign-in cancelled');
                }
            }
        } catch (e) {
            console.error('[LoginScreen] Google Sign-In Error:', e);
            setError(e.message || 'Google sign-in failed. Please try again.');
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
                        <BrandMark size={50} subtitle="" />
                    </Animated.View>

                    {/* Welcome Text */}
                    <Animated.View entering={FadeInDown.delay(100).duration(800)} style={styles.welcomeSection}>
                        <Text style={styles.welcomeTitle}>Welcome Back</Text>
                        <Text style={styles.welcomeSubtitle}>
                            Sign in to continue
                        </Text>
                    </Animated.View>

                    {/* Role Toggle */}
                    <Animated.View entering={FadeInDown.delay(200).duration(800)}>
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

                    {/* Auth Form and Buttons */}
                    <Animated.View entering={FadeInDown.delay(300).duration(800)}>
                        <Surface style={styles.surface} elevation={0}>
                            {error ? (
                                <View style={styles.errorBox}>
                                    <IconButton icon={bi('alert-circle')} size={18} iconColor="#ff6b6b" style={{ margin: 0 }} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            {/* Manual Login Fields */}
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
                                activeOutlineColor="#3277FF"
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
                                activeOutlineColor="#3277FF"
                                theme={{ colors: { background: 'rgba(255,255,255,0.02)', text: '#FFF', placeholder: '#666' } }}
                            />

                            <TouchableOpacity
                                style={styles.loginButton}
                                onPress={handleLogin}
                                disabled={loading || googleLoading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : (
                                    <Text style={styles.loginButtonText}>Sign In</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.dividerContainer}>
                                <View style={styles.divider} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.divider} />
                            </View>

                            {/* Google Button */}
                            <TouchableOpacity
                                style={styles.googleButton}
                                onPress={handleGoogleSignIn}
                                disabled={loading || googleLoading}
                                activeOpacity={0.8}
                            >
                                {googleLoading ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <>
                                        <View style={styles.providerIconWrap}>
                                            <IconButton icon={bi('google')} size={20} iconColor="#FFF" style={{ margin: 0 }} />
                                        </View>
                                        <Text style={styles.providerButtonText}>Continue with Google</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                        </Surface>
                    </Animated.View>

                    {/* Notice at bottom */}
                    <Animated.View entering={FadeInUp.delay(400).duration(800)} style={styles.footer}>
                        <Text style={styles.termsText}>
                            Don't have an account?{' '}
                            <Text style={styles.link} onPress={() => navigation.navigate('Register', { role })}>Create one</Text>
                        </Text>
                        <Text style={[styles.termsText, { marginTop: 16, fontSize: 12 }]}>
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
    content: { flex: 1, justifyContent: 'center', padding: 24, paddingVertical: 40 },
    header: { marginBottom: 20, alignItems: 'center' },
    welcomeSection: { alignItems: 'center', marginBottom: 24 },
    welcomeTitle: {
        fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center',
    },
    welcomeSubtitle: {
        fontSize: 14, color: '#777', marginTop: 4, textAlign: 'center',
    },
    roleContainer: {
        flexDirection: 'row', justifyContent: 'center', marginBottom: 24, gap: 12,
    },
    roleButton: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25,
        borderWidth: 1, borderColor: '#333', backgroundColor: 'rgba(255,255,255,0.02)', gap: 4,
    },
    roleButtonActive: {
        backgroundColor: '#3277FF', borderColor: '#3277FF',
        shadowColor: '#3277FF', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
    },
    roleText: { color: '#888', fontWeight: 'normal', fontSize: 13 },
    roleTextActive: { color: '#000', fontWeight: '600', fontSize: 13 },
    surface: {
        borderRadius: 20, padding: 20, backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    },
    errorBox: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 10, padding: 10, marginBottom: 16, gap: 8,
    },
    errorText: { color: '#ff6b6b', fontSize: 12, flex: 1 },
    input: {
        marginBottom: 16, height: 50, fontSize: 14,
    },
    loginButton: {
        backgroundColor: '#3277FF', borderRadius: 12, height: 48,
        alignItems: 'center', justifyContent: 'center', marginTop: 8,
    },
    loginButtonText: { color: '#000', fontSize: 15, fontWeight: 'bold' },
    dividerContainer: {
        flexDirection: 'row', alignItems: 'center', marginVertical: 20,
    },
    divider: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
    dividerText: { marginHorizontal: 12, color: '#666', fontSize: 12 },
    googleButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#1A1A1A', borderRadius: 12, height: 48,
        borderWidth: 1, borderColor: '#333', gap: 10,
    },
    providerIconWrap: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center',
    },
    providerButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    footer: { marginTop: 24, alignItems: 'center' },
    termsText: { color: '#777', fontSize: 14, textAlign: 'center' },
    link: { color: '#3277FF', fontWeight: '600' },
});

export default LoginScreen;
