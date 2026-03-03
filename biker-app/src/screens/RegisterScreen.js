import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, ScrollView } from 'react-native';
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
import CountryPicker from '../components/CountryPicker';

const RegisterScreen = ({ navigation, route }) => {
    const params = route?.params || {};
    const theme = useTheme();
    const [role, setRole] = useState(params.role || 'user'); // 'user' | 'biker'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('Zimbabwe');
    const [countryCode, setCountryCode] = useState('ZW');
    const [callingCode, setCallingCode] = useState('+263');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [plans, setPlans] = useState([]);
    const [subscriptionType, setSubscriptionType] = useState('weekly');

    useEffect(() => {
        // No longer fetching plans for registration
    }, [role]);

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

    const handleRegister = async () => {
        if (!email || !password || !name || (role === 'user' && !phone)) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Combine calling code and phone for customer
            const fullPhone = role === 'user' ? (callingCode + phone.replace(/[^0-9]/g, '')) : '';

            // Direct registration bypassing OTP Verification
            const res = await SheetService.registerUser({
                name,
                email,
                password,
                phone: fullPhone,
                city,
                country,
                countryCode,
                role: 'user'
            });

            if (res.success) {
                navigation.replace('MainApp');
            } else {
                setError(res.message || 'Failed to register account');
            }
        } catch (e) {
            setError(e.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
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
                            size={40}
                            subtitle="create account"
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
                                label="Full Name"
                                value={name}
                                onChangeText={setName}
                                style={styles.input}
                                textColor="#FFFFFF"
                            />

                            <CustomInput
                                label="Email"
                                value={email}
                                onChangeText={(text) => { setEmail(text); setError(''); }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholder="your@email.com"
                                style={styles.input}
                                textColor="#FFFFFF"
                            />

                            <CustomInput
                                label="Password"
                                value={password}
                                onChangeText={(text) => { setPassword(text); setError(''); }}
                                secureTextEntry
                                placeholder="Min. 8 characters"
                                style={styles.input}
                                textColor="#FFFFFF"
                            />

                            {role === 'user' && (
                                <Animated.View entering={FadeInDown}>
                                    <View style={styles.phoneRow}>
                                        <TouchableOpacity
                                            style={styles.countryTrigger}
                                            onPress={() => setShowCountryPicker(true)}
                                        >
                                            <Text style={styles.countryCodeText}>{callingCode}</Text>
                                        </TouchableOpacity>
                                        <CustomInput
                                            label="Phone Number"
                                            value={phone}
                                            onChangeText={setPhone}
                                            keyboardType="phone-pad"
                                            placeholder="771 234 567"
                                            containerStyle={{ flex: 1 }}
                                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                            textColor="#FFFFFF"
                                        />
                                    </View>
                                    <View style={styles.row}>
                                        <CustomInput
                                            label="City"
                                            value={city}
                                            onChangeText={setCity}
                                            placeholder="Harare"
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            textColor="#FFFFFF"
                                        />
                                        <CustomInput
                                            label="Country"
                                            value={country}
                                            onChangeText={setCountry}
                                            editable={false}
                                            placeholder="Country"
                                            style={[styles.input, { flex: 1 }]}
                                            textColor="#888"
                                        />
                                    </View>
                                </Animated.View>
                            )}

                            {error ? (
                                <Text style={styles.errorText}>{error}</Text>
                            ) : null}

                            <CustomButton
                                title={role === 'biker' ? "continue to biker profile" : "create account"}
                                onPress={() => {
                                    if (role === 'biker') {
                                        if (!name || !email || !password) {
                                            setError('Please complete basic info first');
                                            return;
                                        }
                                        navigation.navigate('BikerDetails', { name, email, password });
                                    } else {
                                        handleRegister();
                                    }
                                }}
                                loading={loading}
                                disabled={loading}
                                style={styles.button}
                                labelStyle={styles.buttonLabel}
                            />
                        </Surface>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(400).duration(800)} style={styles.footer}>
                        <Text style={styles.footerText}>
                            Already have an account?{" "}
                            <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
                                Sign In
                            </Text>
                        </Text>
                    </Animated.View>
                </View>
            </ScrollView>

            <CountryPicker
                visible={showCountryPicker}
                onDismiss={() => setShowCountryPicker(false)}
                onSelect={(val) => {
                    setCountry(val.name);
                    setCountryCode(val.code);
                    setCallingCode(val.callingCode);
                }}
            />
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    content: { flex: 1, padding: 24, paddingVertical: 40 },
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
    input: { marginBottom: 12, backgroundColor: 'transparent' },
    phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    countryTrigger: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        height: 56,
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    countryCodeText: { color: '#00FD3F', fontWeight: 'bold', fontSize: 16 },
    row: { flexDirection: 'row', marginBottom: 0 },
    bikerSection: { marginTop: 8 },
    planSection: { marginTop: 16, marginBottom: 16 },
    planLabel: { color: '#555', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
    planGrid: { flexDirection: 'row', gap: 10 },
    planItem: {
        flex: 1, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#333',
        alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.01)'
    },
    planItemActive: { backgroundColor: '#00FD3F', borderColor: '#00FD3F' },
    planItemText: { color: '#888', fontSize: 12, fontWeight: 'normal' },
    planItemTextActive: { color: '#000' },
    planItemPrice: { color: '#555', fontSize: 10, marginTop: 2 },
    planItemPriceActive: { color: '#000' },
    errorText: { color: '#ff6b6b', textAlign: 'center', marginBottom: 16, fontSize: 13 },
    button: { height: 56, borderRadius: 16, backgroundColor: '#00FD3F', justifyContent: 'center', marginTop: 12 },
    buttonLabel: { color: '#000', fontSize: 18, fontWeight: 'normal' },
    footer: { marginTop: 32, marginBottom: 20, alignItems: 'center' },
    footerText: { color: '#888', fontSize: 15 },
    link: { color: '#00FD3F', fontWeight: 'normal' },
});

export default RegisterScreen;
