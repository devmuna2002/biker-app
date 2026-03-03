import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, FlatList } from 'react-native';
import { Text, TextInput, Avatar, IconButton, Button, useTheme, Divider, Portal, Modal, Searchbar, Badge } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Switch } from 'react-native-paper';
import { useAppTheme } from '../context/ThemeContext';
import SheetService from '../api/SheetService';
import { bi } from '../components/AppIcon';
import mapStyle from '../theme/mapStyle.json';

const ProfileSettingsScreen = ({ navigation }) => {
    const theme = useTheme();
    const { isDarkMode, toggleTheme } = useAppTheme();
    const user = SheetService.currentUser || {};
    const isDriver = String(user?.role || '').toLowerCase() === 'biker' || String(user?.role || '').toLowerCase() === 'driver';
    const [name, setName] = useState(user.name || '');
    const [phone, setPhone] = useState(user.phone || '');
    const [photo, setPhoto] = useState(user.photo || '');
    const [email, setEmail] = useState(user.email || ''); // Added email support
    const [city, setCity] = useState(user.city || '');
    const [country, setCountry] = useState(user.country || '');
    const [countryCode, setCountryCode] = useState(user.countryCode || '');
    const [licensePhoto, setLicensePhoto] = useState(user.licenseVerificationPhoto || '');
    const [verificationStatus, setVerificationStatus] = useState(user.verificationStatus || 'pending');
    const [subscription, setSubscription] = useState(null);
    const [subLoading, setSubLoading] = useState(false);
    const initialServiceArea = user?.serviceArea && user.serviceArea.lat != null && user.serviceArea.lng != null
        ? { lat: Number(user.serviceArea.lat), lng: Number(user.serviceArea.lng) }
        : null;
    const [serviceAreaCenter, setServiceAreaCenter] = useState(initialServiceArea);
    const [serviceAreaRadiusKm, setServiceAreaRadiusKm] = useState(Number(user?.serviceArea?.radiusKm) || 5);
    const [serviceAreaModalVisible, setServiceAreaModalVisible] = useState(false);
    const [serviceAreaRegion, setServiceAreaRegion] = useState(
        initialServiceArea
            ? {
                latitude: Number(initialServiceArea.lat),
                longitude: Number(initialServiceArea.lng),
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
            }
            : null,
    );
    const [serviceAreaResolving, setServiceAreaResolving] = useState(false);
    const [countryModalVisible, setCountryModalVisible] = useState(false);
    const [countryQuery, setCountryQuery] = useState('');
    const [cityModalVisible, setCityModalVisible] = useState(false);
    const [cityQuery, setCityQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const popularCountries = useMemo(
        () => [
            { code: 'us', label: 'United States' },
            { code: 'gb', label: 'United Kingdom' },
            { code: 'za', label: 'South Africa' },
            { code: 'ke', label: 'Kenya' },
            { code: 'ng', label: 'Nigeria' },
            { code: 'ae', label: 'United Arab Emirates' },
            { code: 'in', label: 'India' },
            { code: 'sg', label: 'Singapore' },
        ],
        [],
    );

    // fetch subscription for driver
    const loadSubscription = useCallback(async () => {
        if (!user?.id || !isDriver) return;
        setSubLoading(true);
        try {
            const res = await SheetService.getBikerSubscriptions(user.id, { timeout: 30000 });
            if (res?.data) {
                const subs = Array.isArray(res.data) ? res.data : res.data.subscriptions || [];
                const now = new Date();
                subs.forEach(s => {
                    if (s.expiryDate && new Date(s.expiryDate) < now) {
                        s.subscriptionStatus = 'expired';
                    }
                });
                const activeSub = subs.find(s => s.subscriptionStatus === 'active') || subs[0] || null;
                setSubscription(activeSub);
            }
        } catch (e) {
            console.log('[ProfileSettings] failed to load subscription', e?.message);
        } finally {
            setSubLoading(false);
        }
    }, [user?.id, isDriver]);

    useEffect(() => {
        loadSubscription();
    }, [loadSubscription]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadSubscription();
        });
        return unsubscribe;
    }, [navigation, loadSubscription]);

    const [countrySuggestions, setCountrySuggestions] = useState(popularCountries);
    const [countryLoading, setCountryLoading] = useState(false);

    const [citySuggestions, setCitySuggestions] = useState([]);
    const [cityLoading, setCityLoading] = useState(false);

    useEffect(() => {
        if (!countryModalVisible) return;
        let active = true;
        const t = setTimeout(async () => {
            const q = countryQuery.trim();
            if (q.length < 1) {
                setCountrySuggestions(popularCountries);
                return;
            }

            setCountryLoading(true);
            try {
                const res = await SheetService.searchCountries(q);
                if (!active) return;
                setCountrySuggestions(res?.data?.suggestions || []);
            } catch {
                if (!active) return;
                setCountrySuggestions([]);
            } finally {
                if (active) setCountryLoading(false);
            }
        }, 250);

        return () => {
            active = false;
            clearTimeout(t);
        };
    }, [countryQuery, countryModalVisible, popularCountries]);

    useEffect(() => {
        if (!cityModalVisible) return;
        let active = true;
        const t = setTimeout(async () => {
            const q = cityQuery.trim();
            if (q.length < 2) {
                setCitySuggestions([]);
                return;
            }

            setCityLoading(true);
            try {
                const res = await SheetService.searchCities(q, countryCode);
                if (!active) return;
                setCitySuggestions(res?.data?.suggestions || []);
            } catch {
                if (!active) return;
                setCitySuggestions([]);
            } finally {
                if (active) setCityLoading(false);
            }
        }, 250);

        return () => {
            active = false;
            clearTimeout(t);
        };
    }, [cityQuery, cityModalVisible, countryCode]);

    const pickImage = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission required', 'Please allow photo library access to upload a profile picture.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.35,
            base64: true,
        });

        if (!result.canceled) {
            const b64 = result.assets?.[0]?.base64;
            if (!b64) return;
            // Keep uploads reasonably small (base64 expands size ~33%).
            if (b64.length > 500000) {
                Alert.alert('Image too large', 'Please crop tighter or pick a smaller image.');
                return;
            }
            setPhoto(`data:image/jpeg;base64,${b64}`);
        }
    };

    const pickLicenseImage = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission required', 'Please allow photo library access to upload your verification photo.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3], // Wider for license + face
            quality: 0.35,
            base64: true,
        });

        if (!result.canceled) {
            const b64 = result.assets?.[0]?.base64;
            if (!b64) return;
            if (b64.length > 500000) {
                Alert.alert('Image too large', 'Please crop tighter or pick a smaller image.');
                return;
            }
            setLicensePhoto(`data:image/jpeg;base64,${b64}`);
        }
    };

    const setServiceAreaFromCoord = async ({ lat, lng }) => {
        const center = { lat: Number(lat), lng: Number(lng) };
        if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;

        setServiceAreaCenter(center);
        setServiceAreaRegion({
            latitude: center.lat,
            longitude: center.lng,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
        });

        // Best-effort: derive country/city from the map pin.
        setServiceAreaResolving(true);
        try {
            const [a] = await Location.reverseGeocodeAsync({
                latitude: center.lat,
                longitude: center.lng,
            });
            if (a) {
                if (a.country) setCountry(a.country);
                const cc = String(a.isoCountryCode || '').toLowerCase();
                if (cc) setCountryCode(cc);

                const c = a.city || a.subregion || a.region || '';
                if (c) setCity(c);
            }
        } catch {
            // ignore
        } finally {
            setServiceAreaResolving(false);
        }
    };

    const openServiceAreaModal = async () => {
        setServiceAreaModalVisible(true);
        if (serviceAreaRegion) return;
        try {
            const perm = await Location.requestForegroundPermissionsAsync();
            if (perm.status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({});
            await setServiceAreaFromCoord({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        } catch {
            // ignore
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Build payload - only include fields that have actual values to avoid
            // backend 400 validation errors (forbidNonWhitelisted is enabled)
            const rawPayload = {
                name: name?.trim() || undefined,
                phone: phone?.trim() || undefined,
                photo: photo || undefined,
                contactEmail: email?.trim() || undefined,
                city: city?.trim() || undefined,
                country: country?.trim() || undefined,
                countryCode: countryCode?.trim() || undefined,
                serviceAreaLat: serviceAreaCenter?.lat != null ? Number(serviceAreaCenter.lat) : undefined,
                serviceAreaLng: serviceAreaCenter?.lng != null ? Number(serviceAreaCenter.lng) : undefined,
                serviceAreaRadiusKm: serviceAreaCenter ? Number(serviceAreaRadiusKm) : undefined,
                licenseVerificationPhoto: licensePhoto || undefined,
            };

            // Strip keys where value is undefined
            const payload = Object.fromEntries(
                Object.entries(rawPayload).filter(([, v]) => v !== undefined)
            );

            if (Object.keys(payload).length === 0) {
                Alert.alert('No Changes', 'Nothing to save.');
                return;
            }

            const res = await SheetService.updateProfile(payload);

            if (res?.success) {
                Alert.alert('Success', res.message || 'Profile updated successfully!');
                if (navigation.canGoBack()) {
                    navigation.goBack();
                } else {
                    const next = SheetService.currentUser?.role === 'biker' ? 'BikerApp' : 'Home';
                    navigation.navigate(next);
                }
            } else {
                Alert.alert('Error', res?.message || 'Failed to update profile');
            }
        } catch (e) {
            const msg = e?.response?.data?.message;
            const displayMsg = Array.isArray(msg) ? msg.join('\n') : msg || e?.message || 'Failed to update profile';
            Alert.alert('Error', displayMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
                <IconButton
                    icon={bi('arrow-left')}
                    size={28}
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            const next = SheetService.currentUser?.role === 'biker' ? 'BikerApp' : 'Home';
                            navigation.navigate(next);
                        }
                    }}
                    iconColor={theme.colors.text}
                />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile settings</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.avatarContainer}>
                    <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
                        {photo ? (
                            <Avatar.Image size={100} source={{ uri: photo }} />
                        ) : (
                            <Avatar.Text size={100} label={name[0] || 'U'} backgroundColor={theme.colors.primary} color={theme.colors.onPrimary} />
                        )}
                        <View style={[styles.plusButton, { backgroundColor: theme.colors.secondary }]}>
                            <IconButton icon={bi('camera')} size={20} iconColor="#000" />
                        </View>
                    </TouchableOpacity>
                    <Text style={[styles.changePhotoText, { color: theme.colors.primary }]}>Change Photo</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            label="Name"
                            value={name}
                            onChangeText={setName}
                            mode="flat"
                            style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                            textColor={theme.colors.text}
                            placeholderTextColor={theme.colors.placeholder}
                            underlineColor="transparent"
                            activeUnderlineColor={theme.colors.primary}
                            theme={{ colors: { onSurfaceVariant: theme.colors.placeholder } }}
                        />
                    </View>

                    {isDriver && (
                        <View style={styles.subscriptionInfo}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Subscription</Text>
                            {subLoading ? (
                                <Text>Loading...</Text>
                            ) : subscription ? (
                                <Text style={{ color: subscription.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C' }}>
                                    {String(subscription.subscriptionType).charAt(0).toUpperCase() + String(subscription.subscriptionType).slice(1)} – {String(subscription.subscriptionStatus).charAt(0).toUpperCase() + String(subscription.subscriptionStatus).slice(1)}
                                </Text>
                            ) : (
                                <View>
                                    <Text style={{ color: '#E74C3C' }}>No active subscription.</Text>
                                    <Text style={{ color: theme.colors.primary, marginTop: 8 }} onPress={() => navigation.navigate('Subscription')}>Tap here to choose a plan</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {isDriver && (
                        <View style={[styles.subscriptionInfo, { marginTop: 10 }]}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Identity Verification</Text>
                            <Text style={[styles.label, { marginBottom: 10, color: theme.colors.secondaryText }]}>
                                Upload a photo of yourself holding your drivers license next to your face.
                            </Text>

                            <TouchableOpacity
                                onPress={pickLicenseImage}
                                style={[styles.licenseUploadBox, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }]}
                            >
                                {licensePhoto ? (
                                    <Avatar.Image size={120} source={{ uri: licensePhoto }} style={{ borderRadius: 8 }} />
                                ) : (
                                    <View style={styles.uploadPlaceholder}>
                                        <IconButton icon={bi('camera-plus')} size={40} iconColor={theme.colors.primary} />
                                        <Text style={{ color: theme.colors.secondaryText, fontSize: 12 }}>Tap to capture/upload</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                                <Text style={[styles.label, { color: theme.colors.secondaryText }]}>Account: </Text>
                                <Badge
                                    style={{
                                        backgroundColor: '#2ECC71',
                                        color: '#fff',
                                        paddingHorizontal: 10
                                    }}
                                >
                                    VERIFIED
                                </Badge>
                            </View>
                        </View>
                    )}
                    <View style={styles.inputContainer}>
                        <TextInput
                            label="Phone"
                            value={phone}
                            onChangeText={setPhone}
                            mode="flat"
                            style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                            textColor={theme.colors.text}
                            placeholderTextColor={theme.colors.placeholder}
                            underlineColor="transparent"
                            activeUnderlineColor={theme.colors.primary}
                            theme={{ colors: { onSurfaceVariant: theme.colors.placeholder } }}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            mode="flat"
                            style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                            textColor={theme.colors.text}
                            placeholderTextColor={theme.colors.placeholder}
                            keyboardType="email-address"
                            underlineColor="transparent"
                            activeUnderlineColor={theme.colors.primary}
                            theme={{ colors: { onSurfaceVariant: theme.colors.placeholder } }}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.citySelector, { borderBottomColor: theme.colors.outline }]}
                        onPress={() => {
                            setCountryQuery('');
                            setCountryModalVisible(true);
                        }}
                    >
                        <View style={styles.cityLabelContainer}>
                            <Text style={[styles.label, { color: theme.colors.secondaryText }]}>Country</Text>
                            <Text style={[styles.cityName, { color: theme.colors.text }]}>{country || 'Select country'}</Text>
                        </View>
                        <IconButton icon={bi('chevron-right')} size={24} iconColor={theme.colors.secondaryText} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.citySelector, { borderBottomColor: theme.colors.outline }]}
                        onPress={() => {
                            setCityQuery('');
                            setCityModalVisible(true);
                        }}
                    >
                        <View style={styles.cityLabelContainer}>
                            <Text style={[styles.label, { color: theme.colors.secondaryText }]}>City</Text>
                            <Text style={[styles.cityName, { color: theme.colors.text }]}>
                                {city || (country ? 'Select city' : 'Select country first')}
                            </Text>
                        </View>
                        <IconButton icon={bi('chevron-right')} size={24} iconColor={theme.colors.secondaryText} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.citySelector, { borderBottomColor: theme.colors.outline }]}
                        onPress={openServiceAreaModal}
                    >
                        <View style={styles.cityLabelContainer}>
                            <Text style={[styles.label, { color: theme.colors.secondaryText }]}>{isDriver ? 'Area of business' : 'My area'}</Text>
                            <Text style={[styles.cityName, { color: theme.colors.text }]}>
                                {serviceAreaCenter
                                    ? `${serviceAreaRadiusKm} km radius • ${city || country || 'Map pin'}`
                                    : 'Set on map'}
                            </Text>
                            {serviceAreaResolving ? (
                                <Text style={{ color: theme.colors.secondaryText, marginTop: 4 }}>Detecting location...</Text>
                            ) : null}
                        </View>
                        <IconButton icon={bi('map-marker-radius')} size={24} iconColor={theme.colors.secondaryText} />
                    </TouchableOpacity>

                    <Divider style={{ marginVertical: 10, backgroundColor: theme.colors.outline }} />

                    <Text style={[styles.sectionTitle, { color: theme.colors.secondaryText }]}>Preferences</Text>

                    <View style={styles.preferenceItem}>
                        <View style={styles.preferenceLabel}>
                            <IconButton icon={bi('weather-night')} size={20} iconColor={theme.colors.primary} />
                            <Text style={[styles.preferenceText, { color: theme.colors.text }]}>Dark Mode</Text>
                        </View>
                        <Switch
                            value={isDarkMode}
                            onValueChange={toggleTheme}
                            color={theme.colors.primary}
                        />
                    </View>
                </View>
            </ScrollView>

            <Button
                mode="contained"
                style={[styles.saveButton, { backgroundColor: theme.colors.secondary }]}
                contentStyle={styles.saveButtonContent}
                labelStyle={[styles.saveButtonLabel, { color: '#000' }]}
                onPress={handleSave}
                loading={loading}
            >
                Save Changes
            </Button>

            <Button
                mode="text"
                onPress={async () => {
                    await SheetService.logout();
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }}
                style={{ marginBottom: 4 }}
                textColor={theme.colors.error}
            >
                Log Out
            </Button>

            <Button
                mode="text"
                onPress={() => {
                    Alert.alert(
                        'Delete Account',
                        'Are you sure you want to delete your account? This action is permanent and cannot be undone.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Confirm Delete',
                                style: 'destructive',
                                onPress: async () => {
                                    const res = await SheetService.deleteAccount(user.id || user.legacyId);
                                    if (res.success) {
                                        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                                    }
                                }
                            }
                        ]
                    );
                }}
                style={{ marginBottom: 20 }}
                textColor={theme.colors.error}
                labelStyle={{ opacity: 0.6, fontSize: 12 }}
            >
                Wipe Data & Delete Account
            </Button>

            <Portal>
                <Modal
                    visible={countryModalVisible}
                    onDismiss={() => setCountryModalVisible(false)}
                    contentContainerStyle={[styles.cityModal, { backgroundColor: theme.colors.surface }]}
                >
                    <Text style={[styles.cityModalTitle, { color: theme.colors.text }]}>Choose your country</Text>
                    <Searchbar
                        placeholder="Search country"
                        value={countryQuery}
                        onChangeText={setCountryQuery}
                        style={[styles.citySearch, { backgroundColor: theme.colors.background }]}
                        inputStyle={{ color: theme.colors.text }}
                        iconColor={theme.colors.secondaryText}
                        placeholderTextColor={theme.colors.secondaryText}
                    />
                    {countryLoading && (
                        <Text style={{ color: theme.colors.secondaryText, marginBottom: 8 }}>Searching...</Text>
                    )}
                    <FlatList
                        data={countrySuggestions}
                        keyExtractor={(item) => String(item.code || item.label)}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => {
                                    setCountry(item.label);
                                    setCountryCode(String(item.code || '').toLowerCase());
                                    setCity('');
                                    setCountryModalVisible(false);
                                }}
                                style={[styles.cityRow, { borderBottomColor: theme.colors.outline }]}
                            >
                                <Text style={[styles.cityRowText, { color: theme.colors.text }]}>{item.label}</Text>
                                {!!item.code && (
                                    <Text style={[styles.cityRowSubText, { color: theme.colors.secondaryText }]}>{String(item.code).toUpperCase()}</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    />
                </Modal>

                <Modal
                    visible={cityModalVisible}
                    onDismiss={() => setCityModalVisible(false)}
                    contentContainerStyle={[styles.cityModal, { backgroundColor: theme.colors.surface }]}
                >
                    <Text style={[styles.cityModalTitle, { color: theme.colors.text }]}>Choose your city</Text>
                    <Text style={{ color: theme.colors.secondaryText, marginBottom: 8 }}>
                        {country ? `Country: ${country}` : 'Tip: choose a country first for better results.'}
                    </Text>
                    <Searchbar
                        placeholder="Search city"
                        value={cityQuery}
                        onChangeText={setCityQuery}
                        style={[styles.citySearch, { backgroundColor: theme.colors.background }]}
                        inputStyle={{ color: theme.colors.text }}
                        iconColor={theme.colors.secondaryText}
                        placeholderTextColor={theme.colors.secondaryText}
                    />
                    {cityLoading && (
                        <Text style={{ color: theme.colors.secondaryText, marginBottom: 8 }}>Searching...</Text>
                    )}
                    <FlatList
                        data={citySuggestions}
                        keyExtractor={(item) => String(item.placeId || item.label)}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => {
                                    setCity(item.city || item.label);
                                    if (!country && item.country) setCountry(item.country);
                                    if (!countryCode && item.countryCode) setCountryCode(String(item.countryCode).toLowerCase());
                                    setCityModalVisible(false);
                                }}
                                style={[styles.cityRow, { borderBottomColor: theme.colors.outline }]}
                            >
                                <Text style={[styles.cityRowText, { color: theme.colors.text }]}>{item.city || item.label}</Text>
                                {(item.state || item.country) && (
                                    <Text style={[styles.cityRowSubText, { color: theme.colors.secondaryText }]}>
                                        {[item.state, item.country].filter(Boolean).join(', ')}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}
                    />
                </Modal>

                <Modal
                    visible={serviceAreaModalVisible}
                    onDismiss={() => setServiceAreaModalVisible(false)}
                    contentContainerStyle={[styles.serviceAreaModal, { backgroundColor: theme.colors.surface }]}
                >
                    <Text style={[styles.cityModalTitle, { color: theme.colors.text }]}>{isDriver ? 'Set your area of business' : 'Set your area'}</Text>
                    <Text style={{ color: theme.colors.secondaryText, marginBottom: 10 }}>
                        This helps match you with nearby people and nearby service providers.
                    </Text>

                    <View style={styles.serviceAreaMapWrap}>
                        <MapView
                            provider={PROVIDER_GOOGLE}
                            style={styles.serviceAreaMap}
                            initialRegion={
                                serviceAreaRegion || {
                                    latitude: 0,
                                    longitude: 0,
                                    latitudeDelta: 60,
                                    longitudeDelta: 60,
                                }
                            }
                            region={serviceAreaRegion || undefined}
                            customMapStyle={mapStyle}
                            userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
                            onLongPress={(e) => {
                                const c = e?.nativeEvent?.coordinate;
                                if (!c) return;
                                setServiceAreaFromCoord({ lat: c.latitude, lng: c.longitude });
                            }}
                        >
                            {serviceAreaCenter?.lat != null && serviceAreaCenter?.lng != null && (
                                <>
                                    <Circle
                                        center={{ latitude: serviceAreaCenter.lat, longitude: serviceAreaCenter.lng }}
                                        radius={Math.max(1, Number(serviceAreaRadiusKm || 5)) * 1000}
                                        strokeColor="rgba(0,253,63,0.6)"
                                        fillColor="rgba(0,253,63,0.12)"
                                    />
                                    <Marker
                                        coordinate={{ latitude: serviceAreaCenter.lat, longitude: serviceAreaCenter.lng }}
                                        draggable
                                        onDragEnd={(e) => {
                                            const c = e?.nativeEvent?.coordinate;
                                            if (!c) return;
                                            setServiceAreaFromCoord({ lat: c.latitude, lng: c.longitude });
                                        }}
                                    />
                                </>
                            )}
                        </MapView>
                    </View>

                    <View style={styles.radiusRow}>
                        {[2, 5, 10, 20].map((km) => {
                            const active = Number(serviceAreaRadiusKm) === km;
                            return (
                                <TouchableOpacity
                                    key={String(km)}
                                    style={[styles.radiusChip, active && styles.radiusChipActive]}
                                    onPress={() => setServiceAreaRadiusKm(km)}
                                >
                                    <Text style={[styles.radiusChipText, active && styles.radiusChipTextActive]}>{km} km</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.serviceAreaActions}>
                        <Button
                            mode="outlined"
                            textColor={theme.colors.text}
                            style={styles.serviceAreaBtn}
                            onPress={async () => {
                                try {
                                    const perm = await Location.requestForegroundPermissionsAsync();
                                    if (perm.status !== 'granted') {
                                        Alert.alert('Permission required', 'Enable location permission to use your current location.');
                                        return;
                                    }
                                    const loc = await Location.getCurrentPositionAsync({});
                                    await setServiceAreaFromCoord({ lat: loc.coords.latitude, lng: loc.coords.longitude });
                                } catch {
                                    // ignore
                                }
                            }}
                        >
                            Use my location
                        </Button>
                        <Button
                            mode="contained"
                            buttonColor={theme.colors.secondary}
                            textColor="#000"
                            style={styles.serviceAreaBtn}
                            onPress={() => setServiceAreaModalVisible(false)}
                        >
                            Done
                        </Button>
                    </View>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    avatarContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 10,
    },
    licenseUploadBox: {
        width: '100%',
        height: 150,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    uploadPlaceholder: {
        alignItems: 'center',
    },
    plusButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderRadius: 20,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#000',
    },
    changePhotoText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    form: {
        marginTop: 10,
    },
    inputContainer: {
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    input: {
        height: 56,
    },
    citySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        paddingVertical: 15,
        marginTop: 5,
    },
    cityLabelContainer: {
        flex: 1,
    },
    label: {
        fontSize: 12,
        marginBottom: 4,
    },
    cityName: {
        fontSize: 16,
        fontWeight: '500',
    },
    saveButton: {
        margin: 20,
        borderRadius: 16,
        elevation: 4,
    },
    saveButtonContent: {
        height: 56,
    },
    saveButtonLabel: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    subscriptionInfo: {
        marginHorizontal: 20,
        marginBottom: 20,
    },
    preferenceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    preferenceLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: -10,
    },
    preferenceText: {
        fontSize: 16,
        fontWeight: '500',
    },

    cityModal: {
        marginHorizontal: 18,
        borderRadius: 18,
        padding: 16,
        maxHeight: '70%',
        alignSelf: 'center',
        justifyContent: 'center',
    },
    serviceAreaModal: {
        marginHorizontal: 18,
        borderRadius: 18,
        padding: 16,
        maxHeight: '80%',
        alignSelf: 'center',
        justifyContent: 'center',
    },
    serviceAreaMapWrap: {
        height: 260,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 12,
    },
    serviceAreaMap: {
        width: '100%',
        height: '100%',
    },
    radiusRow: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    radiusChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    radiusChipActive: {
        backgroundColor: 'rgba(0,253,63,0.18)',
        borderColor: 'rgba(0,253,63,0.5)',
    },
    radiusChipText: {
        fontWeight: '800',
        color: '#BDC3C7',
    },
    radiusChipTextActive: {
        color: '#00FD3F',
    },
    serviceAreaActions: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'space-between',
    },
    serviceAreaBtn: {
        flex: 1,
        borderRadius: 14,
    },
    cityModalTitle: {
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 10,
    },
    citySearch: {
        borderRadius: 12,
        marginBottom: 10,
    },
    cityRow: {
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    cityRowText: {
        fontSize: 15,
        fontWeight: '700',
    },
    cityRowSubText: {
        marginTop: 4,
        fontSize: 12,
        fontWeight: '600',
    },
});

export default ProfileSettingsScreen;
