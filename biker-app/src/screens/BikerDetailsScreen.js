import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Surface, useTheme, IconButton, Menu, Divider } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import SheetService from '../api/SheetService';
import BrandMark from '../components/BrandMark';
import CountryPicker from '../components/CountryPicker';

const BikerDetailsScreen = ({ navigation, route }) => {
    const { name, email, password, provider, providerId, photo } = route.params;
    const theme = useTheme();

    const [phone, setPhone] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('Zimbabwe');
    const [countryCode, setCountryCode] = useState('ZW');
    const [callingCode, setCallingCode] = useState('+263');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [licenseNumber, setLicenseNumber] = useState('');
    const [vehicleType, setVehicleType] = useState('bike');
    const [showTypeMenu, setShowTypeMenu] = useState(false);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = async () => {
        if (!phone || !city || !vehicleNumber || !licenseNumber) {
            setError('Please fill in all remaining fields');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Combine calling code and phone
            const fullPhone = callingCode + phone.replace(/[^0-9]/g, '');

            // Global License Validation (broad alphanumeric 5-20 chars, at least one digit)
            const licenseRegex = /^(?=.*\d)[a-zA-Z0-9- ]{5,20}$/;
            if (!licenseRegex.test(licenseNumber)) {
                setError('Invalid Driver License format. (5-20 alphanumeric characters required)');
                setLoading(false);
                return;
            }

            let res;
            if (provider) {
                // Provider auth registration for bikers
                res = await SheetService.providerAuth({
                    email,
                    name,
                    provider,
                    providerId,
                    role: 'biker',
                    photo,
                    vehicleDetails: `License: ${licenseNumber}`,
                    vehicleNumber,
                    phone: fullPhone,
                    city,
                    country,
                    countryCode
                });
            } else {
                // Direct manual registration
                res = await SheetService.registerUser({
                    email,
                    name,
                    password,
                    phone: fullPhone,
                    role: 'biker',
                    vehicleNumber,
                    vehicleType: 'bike',
                    vehicleDetails: `License: ${licenseNumber}`,
                    city,
                    country,
                    countryCode,
                });
            }

            if (res.success) {
                navigation.replace('BikerApp');
            } else {
                setError(res.message || 'Failed to register account');
            }
        } catch (e) {
            setError(e.message || 'An error occurred. Please try again.');
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
                    <Animated.View entering={FadeInDown.duration(800)} style={styles.header}>
                        <BrandMark size={40} subtitle="biker profile registration" />
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(200).duration(800)}>
                        <Surface style={styles.surface} elevation={0}>

                            {/* Fixed to Motorbike for the Biker app version */}
                            <Text style={styles.sectionLabel}>VEHICLE INFORMATION (MOTORBIKE)</Text>

                            <CustomInput
                                label="Vehicle Number"
                                value={vehicleNumber}
                                onChangeText={setVehicleNumber}
                                placeholder="ABC 1234"
                                style={styles.input}
                                autoCapitalize="characters"
                                textColor="#FFFFFF"
                            />

                            <CustomInput
                                label="Driver License Number"
                                value={licenseNumber}
                                onChangeText={setLicenseNumber}
                                placeholder="e.g. L-12345678"
                                style={styles.input}
                                autoCapitalize="characters"
                                textColor="#FFFFFF"
                            />

                            <Divider style={styles.divider} />

                            <Text style={styles.sectionLabel}>CONTACT & LOCATION</Text>

                            {/* Phone with Country Code Selector */}
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
                                    style={[styles.input, { flex: 1 }]}
                                    textColor="#888"
                                />
                            </View>

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}

                            <CustomButton
                                title="complete registration"
                                onPress={handleRegister}
                                loading={loading}
                                disabled={loading}
                                style={styles.button}
                                labelStyle={styles.buttonLabel}
                            />
                        </Surface>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(500).duration(800)} style={styles.footer}>
                        <Text style={styles.footerText}>
                            Want to change basic info?{" "}
                            <Text style={styles.link} onPress={() => navigation.goBack()}>
                                Go Back
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
    surface: { borderRadius: 24, padding: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    sectionLabel: { color: '#00FD3F', fontSize: 10, fontWeight: 'normal', letterSpacing: 1.5, marginBottom: 16, marginTop: 8 },
    input: { marginBottom: 12, backgroundColor: 'transparent' },
    divider: { marginVertical: 20, backgroundColor: 'rgba(255,255,255,0.05)' },
    selectAnchor: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    selectText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'normal' },
    menuContent: { backgroundColor: '#1A1A1A', borderRadius: 12 },
    menuItemText: { color: '#FFFFFF' },
    phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    countryTrigger: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        height: 56, // matches CustomInput
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    countryCodeText: { color: '#00FD3F', fontWeight: 'normal', fontSize: 16 },
    row: { flexDirection: 'row', marginBottom: 0 },
    errorText: { color: '#ff6b6b', textAlign: 'center', marginVertical: 16, fontSize: 13 },
    button: { height: 56, borderRadius: 16, backgroundColor: '#00FD3F', justifyContent: 'center', marginTop: 12 },
    buttonLabel: { color: '#000', fontSize: 18, fontWeight: 'normal' },
    footer: { marginTop: 32, alignItems: 'center' },
    footerText: { color: '#888', fontSize: 15 },
    link: { color: '#00FD3F', fontWeight: 'normal' },
});

export default BikerDetailsScreen;
