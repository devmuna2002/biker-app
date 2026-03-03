import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Text, Surface, useTheme, IconButton } from 'react-native-paper';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    FadeInDown,
    FadeInUp
} from 'react-native-reanimated';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import SheetService from '../api/SheetService';
import BrandMark from '../components/BrandMark';

const LoginScreen = ({ navigation, route }) => {
    const params = route?.params || {};
    const theme = useTheme();
    const [role, setRole] = useState(params.role || 'user'); // 'user' | 'biker'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please enter email and password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await SheetService.loginUser(email, password, role);

            if (result.success) {
                if (role === 'biker') {
                    navigation.replace('BikerApp');
                } else {
                    navigation.replace('MainApp');
                }
            } else {
                setError(result.message || 'Login failed');
            }
        } catch (e) {
            setError(e.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider) => {
        if (provider === 'Google') {
            setLoading(true);
            setError('');
            try {
                const res = await SheetService.signInWithGoogle();
                if (!res.success) {
                    setError(res.message);
                }
                // Redirect will be handled by Supabase/Browser
            } catch (err) {
                setError('Google Login failed');
            } finally {
                setLoading(false);
            }
        } else {
            console.log(`Social Login with ${provider}`);
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
                        <BrandMark
                            size={50}
                            subtitle="Welcome Back"
                        />
                    </Animated.View>

                    {/* Role Toggle */}
                    <Animated.View entering={FadeInDown.delay(100).duration(800)}>
                        <View style={styles.roleContainer}>
                            <TouchableOpacity
                                style={[styles.roleButton, role === 'user' && styles.roleButtonActive]}
                                onPress={() => setRole('user')}
                            >
                                <Text style={[styles.roleText, role === 'user' && styles.roleTextActive]}>Customer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.roleButton, role === 'biker' && styles.roleButtonActive]}
                                onPress={() => setRole('biker')}
                            >
                                <Text style={[styles.roleText, role === 'biker' && styles.roleTextActive]}>Biker</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(200).duration(800)}>
                        <Surface style={styles.surface} elevation={0}>
                            <CustomInput
                                label="Email or ID"
                                value={email}
                                onChangeText={(text) => { setEmail(text); setError(''); }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholder="Enter your credentials"
                                style={styles.input}
                                textColor="#FFFFFF"
                                activeOutlineColor="#00FD3F"
                            />

                            <CustomInput
                                label="Password"
                                value={password}
                                onChangeText={(text) => { setPassword(text); setError(''); }}
                                secureTextEntry
                                placeholder="••••••••"
                                style={styles.input}
                                textColor="#FFFFFF"
                                activeOutlineColor="#00FD3F"
                            />

                            <TouchableOpacity style={styles.forgotPassword} onPress={() => console.log('Forgot Password')}>
                                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                            </TouchableOpacity>

                            {error ? (
                                <Text style={styles.errorText}>{error}</Text>
                            ) : null}

                            <CustomButton
                                title="Sign In"
                                onPress={handleLogin}
                                loading={loading}
                                disabled={loading}
                                style={styles.button}
                                labelStyle={styles.buttonLabel}
                            />
                        </Surface>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(300).duration(800)} style={styles.dividerContainer}>
                        <View style={styles.divider} />
                        <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                        <View style={styles.divider} />
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.socialContainer}>
                        <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialLogin('Google')}>
                            <IconButton icon="google" size={24} iconColor="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialLogin('Apple')}>
                            <IconButton icon="apple" size={24} iconColor="#FFF" />
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(500).duration(800)} style={styles.footer}>
                        <Text style={styles.footerText}>
                            Don't have an account?{" "}
                            <Text style={styles.link} onPress={() => navigation.navigate('Register', { role })}>
                                Register
                            </Text>
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
    header: { marginBottom: 32, alignItems: 'center' },
    headerTitle: { color: '#888', marginTop: 8, fontSize: 16 },
    roleContainer: {
        flexDirection: 'row', justifyContent: 'center', marginBottom: 24, gap: 12,
    },
    roleButton: {
        paddingHorizontal: 28, paddingVertical: 12, borderRadius: 25, borderWidth: 1, borderColor: '#333',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    roleButtonActive: {
        backgroundColor: '#00FD3F', borderColor: '#00FD3F',
        shadowColor: '#00FD3F', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
    },
    roleText: { color: '#888', fontWeight: 'normal' },
    roleTextActive: { color: '#000' },
    surface: { borderRadius: 24, padding: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    input: { marginBottom: 16, backgroundColor: 'transparent' },
    forgotPassword: { alignSelf: 'flex-end', marginBottom: 24 },
    forgotPasswordText: { color: '#00FD3F', fontSize: 13, fontWeight: 'normal' },
    errorText: { color: '#ff6b6b', textAlign: 'center', marginBottom: 16, fontSize: 13 },
    button: { height: 56, borderRadius: 16, backgroundColor: '#00FD3F', justifyContent: 'center' },
    buttonLabel: { color: '#000', fontSize: 18, fontWeight: 'normal' },
    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 32 },
    divider: { flex: 1, height: 1, backgroundColor: '#222' },
    dividerText: { color: '#444', marginHorizontal: 16, fontSize: 10, fontWeight: 'normal' },
    socialContainer: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
    socialButton: {
        width: 60, height: 60, borderRadius: 30, backgroundColor: '#1A1A1A',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333'
    },
    footer: { marginTop: 40, alignItems: 'center' },
    footerText: { color: '#888', fontSize: 15 },
    link: { color: '#00FD3F', fontWeight: 'normal' },
});

export default LoginScreen;
