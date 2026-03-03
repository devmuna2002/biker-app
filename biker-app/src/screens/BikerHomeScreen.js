import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Alert, TouchableOpacity, Linking, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withDelay, withSpring } from 'react-native-reanimated';
import { Text, Surface, Switch, Button, Avatar, IconButton, useTheme, Divider, Badge, Portal, Modal } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { PROVIDER_GOOGLE, Polyline, Marker } from 'react-native-maps';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import SheetService from '../api/SheetService';
import CallService from '../api/CallService';
import TelemetryOverlay from '../components/TelemetryOverlay';
import mapStyle from '../theme/mapStyle.json';

const { width, height } = Dimensions.get('window');

const DRIVER_LOCATION_INTERVAL_MS = 5000;

const Pulse = ({ delay = 0 }) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        scale.value = withDelay(delay, withRepeat(withTiming(3, { duration: 3000 }), -1, false));
        opacity.value = withDelay(delay, withRepeat(withTiming(0, { duration: 3000 }), -1, false));
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return <Animated.View style={[styles.pulse, animatedStyle]} />;
};

// Service type icons and labels
const SERVICE_ICON = { bike: 'motorbike', courier: 'package-variant-closed', local_services: 'store', city_to_city: 'bus-multiple' };
const SERVICE_LABEL = { bike: 'Biker', courier: 'Send a package', local_services: 'Local services', city_to_city: 'City to City' };

const BikerHomeScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const mapRef = useRef(null);
    const socketRef = useRef(null);
    const insets = useSafeAreaInsets();

    const [isOnline, setIsOnline] = useState(false);
    const [activeJob, setActiveJob] = useState(null);
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [location, setLocation] = useState(null);
    const [routeCoords, setRouteCoords] = useState([]);
    const [user, setUser] = useState(SheetService.currentUser);
    const [dashboard, setDashboard] = useState(null);
    const [showSubscription, setShowSubscription] = useState(false);
    const [subscription, setSubscription] = useState(null);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [isCalling, setIsCalling] = useState(false);
    const [callState, setCallState] = useState('idle');
    const [showWelcome, setShowWelcome] = useState(false);
    const [ambientPlaces, setAmbientPlaces] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // Animated values for button feedback
    const dashboardScale = useSharedValue(1);
    const subScale = useSharedValue(1);
    const onlineScale = useSharedValue(1);

    const createPressStyle = (scaleValue) => useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(scaleValue.value, { damping: 15, stiffness: 150 }) }]
    }));

    const handlePressIn = (scaleValue) => { scaleValue.value = 0.94; };
    const handlePressOut = (scaleValue) => { scaleValue.value = 1.0; };

    useEffect(() => {
        const checkTutorial = async () => {
            await AsyncStorage.setItem('hasSeenBikerTutorial', 'true');
            setShowWelcome(false);
        };
        checkTutorial();
    }, []);

    const dismissWelcome = async () => {
        await AsyncStorage.setItem('hasSeenBikerTutorial', 'true');
        setShowWelcome(false);
    };

    useFocusEffect(
        React.useCallback(() => {
            const currentUser = SheetService.currentUser;
            setUser(currentUser);

            // Redirect to profile settings if license photo is missing
            if (currentUser && !currentUser.licenseVerificationPhoto) {
                Alert.alert(
                    'Verification Required',
                    'A photo of yourself holding your driver license is required for admin approval before you can go online.',
                    [
                        {
                            text: 'Upload Now',
                            onPress: () => navigation.navigate('ProfileSettings'),
                            style: 'default'
                        }
                    ],
                    { cancelable: false }
                );
            }
        }, [navigation])
    );

    // --------------------------
    // 1️⃣ LIVE LOCATION TRACKING
    // --------------------------
    useEffect(() => {
        let subscription;
        let lastSent = 0;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                const sa = SheetService.currentUser?.serviceArea;
                if (sa?.lat != null && sa?.lng != null) {
                    setLocation({
                        latitude: Number(sa.lat),
                        longitude: Number(sa.lng),
                        latitudeDelta: 0.08,
                        longitudeDelta: 0.08,
                    });
                }
                return;
            }

            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 3000,
                    distanceInterval: 5,
                },
                async (loc) => {
                    const coords = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    };

                    setLocation({
                        ...coords,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    });

                    const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
                    if (Math.abs(speedKmh - currentSpeed) >= 2 || speedKmh === 0) {
                        setCurrentSpeed(speedKmh);
                    }

                    if (isOnline) {
                        const now = Date.now();
                        if (now - lastSent >= DRIVER_LOCATION_INTERVAL_MS) {
                            lastSent = now;
                            try {
                                await SheetService.updateDriverLocation({
                                    lat: coords.latitude,
                                    lng: coords.longitude,
                                    speedMps: loc.coords.speed || 0,
                                    headingDeg: loc.coords.heading || 0,
                                    accuracyM: loc.coords.accuracy || 0,
                                });
                            } catch { }

                            if (activeJob?.orderId && socketRef.current?.connected) {
                                socketRef.current.emit('driver_location', {
                                    orderId: activeJob.orderId,
                                    lat: coords.latitude,
                                    lng: coords.longitude,
                                    speedMps: loc.coords.speed || 0,
                                    headingDeg: loc.coords.heading || 0,
                                    accuracyM: loc.coords.accuracy || 0,
                                    ts: now,
                                });
                            }
                        }
                    }
                }
            );
        })();

        return () => subscription?.remove();
    }, [isOnline, activeJob?.orderId]);

    // Auto-follow map
    const lastAnimatePos = useRef(null);
    useEffect(() => {
        if (location && mapRef.current) {
            // Only animate if moved more than ~10 meters or first time
            const dist = lastAnimatePos.current ?
                Math.sqrt(Math.pow(location.latitude - lastAnimatePos.current.latitude, 2) + Math.pow(location.longitude - lastAnimatePos.current.longitude, 2)) * 111000 : 100;

            if (dist > 10) {
                mapRef.current.animateCamera({
                    center: location,
                    zoom: activeJob ? 17 : 14,
                }, { duration: 1000 });
                lastAnimatePos.current = location;
            }
        }
    }, [location, !!activeJob]);

    // Dashboard + subscription
    useEffect(() => {
        if (!location?.latitude || !location?.longitude) return;
        let cancelled = false;

        const load = async () => {
            setIsSyncing(true);
            try {
                const init = await SheetService.dashboardInit({
                    lat: location.latitude,
                    lng: location.longitude,
                    radiusKm: 5,
                }, { timeout: 8000 });
                if (cancelled) return;
                if (init?.success) {
                    setDashboard(curr => JSON.stringify(curr) === JSON.stringify(init.data) ? curr : init.data);
                    const merged = {
                        ...(SheetService.currentUser || {}),
                        ...(init.data.user || {}),
                    };
                    setUser(curr => JSON.stringify(curr) === JSON.stringify(merged) ? curr : merged);
                }
            } catch { } finally {
                if (!cancelled) setIsSyncing(false);
            }
        };

        load();
        const interval = setInterval(load, 45000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [location?.latitude, location?.longitude]);

    // Load biker subscription
    const loadSubscription = useCallback(async () => {
        if (!user?.id) return;
        try {
            const res = await SheetService.getBikerSubscriptions(user.id, { timeout: 15000 });
            if (res?.data) {
                const subs = Array.isArray(res.data) ? res.data : res.data.subscriptions || [];
                const now = new Date();
                subs.forEach(s => {
                    if (s.expiryDate && new Date(s.expiryDate) < now) {
                        s.subscriptionStatus = 'expired';
                    }
                });
                const activeSub = subs.find(s => s.subscriptionStatus === 'active') || subs[0] || null;

                // Also check for trial status if no active sub
                const trialExpiry = user.trialExpiryDate ? new Date(user.trialExpiryDate) : null;
                const trialActive = trialExpiry && trialExpiry > now;

                setSubscription(activeSub);

                // Update the global user object if status changed or trial status merged
                const updated = {
                    ...user,
                    subscriptionStatus: (activeSub?.subscriptionStatus === 'active' || trialActive) ? 'active' : 'inactive',
                    subscriptionExpiryDate: activeSub?.expiryDate || user.trialExpiryDate,
                };

                // Only trigger re-render if something actually changed
                setUser(curr => {
                    const hasChanged = curr.subscriptionStatus !== updated.subscriptionStatus ||
                        curr.subscriptionExpiryDate !== updated.subscriptionExpiryDate;
                    if (hasChanged) {
                        SheetService.currentUser = updated;
                        return updated;
                    }
                    return curr;
                });
            }
        } catch (e) {
            console.log('[BikerHomeScreen] Failed to load subscription:', e?.message);
        }
    }, [user?.id, user?.subscriptionStatus]);

    useEffect(() => {
        loadSubscription();
        const interval = setInterval(loadSubscription, 60000);
        return () => clearInterval(interval);
    }, [loadSubscription]);

    useFocusEffect(
        React.useCallback(() => {
            setUser(SheetService.currentUser);
            loadSubscription(); // Force refresh whenever we come back to this screen
        }, [loadSubscription])
    );

    // Load ambient places for the map (restaurants/shops for visual richness)
    useEffect(() => {
        if (!location?.latitude || !location?.longitude) return;
        let cancelled = false;

        const fetchPlaces = async () => {
            try {
                const res = await SheetService.getNearbyProviders({
                    lat: location.latitude,
                    lng: location.longitude,
                    kind: 'restaurant',
                    radiusM: 3000,
                    limit: 12
                });
                if (!cancelled && res?.data?.providers) {
                    setAmbientPlaces(res.data.providers);
                }
            } catch (e) {
                // ignore
            }
        };

        fetchPlaces();
        const interval = setInterval(fetchPlaces, 60000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [location?.latitude, location?.longitude]);

    // Online status init
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const me = await SheetService.driverMe();
                if (!isMounted) return;
                setIsOnline(Boolean(me?.data?.isOnline));
                // initial subscription from backend
                if (me?.data) {
                    setSubscription({
                        subscriptionStatus: me.data.subscriptionStatus,
                        expiryDate: me.data.subscriptionExpiryDate,
                    });
                }
            } catch { }
        })();
        return () => { isMounted = false; };
    }, []);

    // initialize call socket whenever we have a user id
    useEffect(() => {
        if (user?.id) {
            CallService.init(user.id);
        }
    }, [user?.id]);

    // Socket + active order poll
    useEffect(() => {
        let interval;
        let cancelled = false;

        const start = async () => {
            if (!isOnline) {
                try { socketRef.current?.disconnect(); } catch { }
                socketRef.current = null;
                setActiveJob(null);
                setRouteCoords([]);
                setPendingOrders([]);
                return;
            }

            try {
                socketRef.current = await SheetService.connectTrackingSocket();

                // Register with backend
                if (SheetService.currentUser?.id) {
                    socketRef.current.emit('register', {
                        userId: SheetService.currentUser.id,
                        userType: 'driver'
                    });
                }

                // Listen for new incoming orders — backend emits 'new_order_request' (legacy)
                socketRef.current.on('new_order_request', (order) => {
                    if (!cancelled) {
                        setPendingOrders(prev => {
                            const exists = prev.find(o => o.orderId === order.orderId || o.id === order.id);
                            if (exists) return prev;
                            return [...prev, normalizeOrder(order)];
                        });
                    }
                });

                // Backend order-flow emits 'order_assigned' to user:{id} room after confirmOrder()
                socketRef.current.on('order_assigned', (payload) => {
                    if (!cancelled) {
                        // payload has { order: { id, status, serviceType, pickupAddress, dropoffAddress, priceCents }, customer: { id, name, phone } }
                        const order = payload?.order || payload;
                        const customer = payload?.customer || {};
                        const normalized = normalizeOrder({
                            ...order,
                            orderId: order.id || order.orderId,
                            pickupAddress: order.pickupAddress,
                            dropoffAddress: order.dropoffAddress,
                            priceCents: order.priceCents || order.finalPriceCents,
                            customerName: customer.name,
                            customerPhone: customer.phone,
                        });
                        setPendingOrders(prev => {
                            const exists = prev.find(o => o.orderId === normalized.orderId);
                            if (exists) return prev;
                            return [...prev, normalized];
                        });
                    }
                });
            } catch {
                socketRef.current = null;
            }

            const normalizeOrder = (o) => ({
                orderId: o.id || o.orderId,
                status: o.status,
                pickup: o.pickup?.address || o.pickupAddress,
                dropoff: o.dropoff?.address || o.dropoffAddress,
                pickupCoords: o.pickup?.coords || o.pickupCoords || { lat: o.pickupLat, lng: o.pickupLng },
                dropoffCoords: o.dropoff?.coords || o.dropoffCoords || { lat: o.dropoffLat, lng: o.dropoffLng },
                routePoints: o.routePoints,
                price: `$${((o.priceCents || 0) / 100).toFixed(2)}`,
                priceCents: o.priceCents,
                distanceKm: o.distanceKm,
                etaMinutes: o.etaMinutes,
                serviceType: o.serviceType,
                customerName: o.customer?.name || o.customerName,
                customerPhone: o.customer?.phone || o.customerPhone,
                notes: o.notes,
                itemDescription: o.itemDescription || o.description,
                providerName: o.providerName || o.pickupStoreName,
            });

            const loadActive = async () => {
                try {
                    const res = await SheetService.getDriverActiveOrder();
                    const o = res?.data?.order;
                    if (!o) {
                        setActiveJob(null);
                        setRouteCoords([]);
                        return;
                    }
                    setActiveJob(normalizeOrder(o));

                    if (location?.latitude && location?.longitude) {
                        // Use route points from customer if available
                        if (activeJob?.routePoints && activeJob.routePoints.length > 0) {
                            setRouteCoords(activeJob.routePoints);
                        } else {
                            // Fallback: Get road route from OSRM
                            const to = o.status === 'assigned' ? o.pickup?.coords : o.dropoff?.coords;
                            if (to?.lat && to?.lng) {
                                try {
                                    const url = `https://router.project-osrm.org/route/v1/driving/${location.longitude},${location.latitude};${to.lng},${to.lat}?overview=full&geometries=geojson`;
                                    const response = await fetch(url);
                                    const data = await response.json();

                                    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
                                        const coords = data.routes[0].geometry.coordinates;
                                        setRouteCoords(coords.map(c => ({ latitude: c[1], longitude: c[0] })));
                                    } else {
                                        setRouteCoords([]);
                                    }
                                } catch (err) {
                                    console.log('Route error:', err);
                                    setRouteCoords([]);
                                }
                            }
                        }
                    }
                } catch { }
            };

            await loadActive();
            interval = setInterval(loadActive, 5000);
        };

        start();
        return () => {
            cancelled = true;
            if (interval) clearInterval(interval);
            try { socketRef.current?.disconnect(); } catch { }
            socketRef.current = null;
        };
    }, [isOnline, location?.latitude, location?.longitude]);

    const toggleOnline = async () => {
        const newState = !isOnline;

        // Check if user has active trial or active subscription
        const now = new Date();
        const trialActive = user?.trialExpiryDate && new Date(user.trialExpiryDate) > now;
        const subActive = subscription?.subscriptionStatus === 'active';

        // Show informative alert if going online without subscription/trial
        if (newState && !subActive && !trialActive) {
            Alert.alert(
                'Restricted Mode',
                'Your free trial has expired. You can view incoming requests but cannot accept them until you subscribe.',
                [
                    { text: 'View Requests', style: 'default' },
                    { text: 'Subscribe', onPress: () => navigation.navigate('Subscription'), style: 'cancel' }
                ]
            );
        }

        setIsOnline(newState);
        try {
            const res = await SheetService.setDriverOnline(newState);
            // Handle graceful failure (no biker profile, etc.)
            if (res?.success === false) {
                setIsOnline(!newState);
                Alert.alert(
                    'Cannot change status',
                    res?.message || 'Could not update online status. Please ensure your driver profile is complete.',
                    [
                        { text: 'OK', style: 'default' },
                        { text: 'Profile Settings', onPress: () => navigation.navigate('ProfileSettings') }
                    ]
                );
                return;
            }
            // Sync the actual state from server response
            if (res?.data?.isOnline !== undefined) {
                setIsOnline(res.data.isOnline);
            }
        } catch (e) {
            setIsOnline(!newState);
            const errData = e?.response?.data;
            const msg = Array.isArray(errData?.message)
                ? errData.message.join('\n')
                : errData?.message || e?.message || 'Unable to change online status';
            Alert.alert('Cannot go online', msg);
        }
    };


    const updateStatus = async (next) => {
        if (!activeJob?.orderId) return;
        try {
            await SheetService.updateDriverOrderStatus(activeJob.orderId, next);
            const res = await SheetService.getDriverActiveOrder();
            const o = res?.data?.order;
            if (!o) {
                setActiveJob(null);
                setRouteCoords([]);
            }
        } catch (e) {
            Alert.alert('Failed', e?.message || 'Status update failed');
        }
    };

    const handleAcceptOrder = async (order) => {
        const now = new Date();
        const trialActive = user?.trialExpiryDate && new Date(user.trialExpiryDate) > now;
        const subActive = subscription?.subscriptionStatus === 'active';

        if (!subActive && !trialActive) {
            Alert.alert(
                'Action Required',
                'Your free trial has expired. Please subscribe to continue accepting orders.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Subscribe Now', onPress: () => navigation.navigate('Subscription') }
                ]
            );
            return;
        }

        try {
            await SheetService.acceptOrder(order.orderId);
            setPendingOrders([]);
            // Reload active job
            const res = await SheetService.getDriverActiveOrder();
            if (res?.data?.order) {
                const o = res.data.order;
                setActiveJob({
                    orderId: o.id,
                    status: o.status,
                    pickup: o.pickup?.address,
                    dropoff: o.dropoff?.address,
                    pickupCoords: o.pickup?.coords || order.pickupCoords,
                    dropoffCoords: o.dropoff?.coords || order.dropoffCoords,
                    routePoints: order.routePoints,
                    price: `$${((o.priceCents || 0) / 100).toFixed(2)}`,
                    priceCents: o.priceCents,
                    distanceKm: o.distanceKm,
                    etaMinutes: o.etaMinutes,
                    serviceType: o.serviceType,
                    customerName: o.customer?.name || o.customerName,
                    customerPhone: o.customer?.phone || o.customerPhone,
                    notes: o.notes,
                    itemDescription: o.itemDescription,
                    providerName: o.providerName,
                });
            }
        } catch (e) {
            Alert.alert('Accept Failed', e?.message || 'Could not accept this order.');
        }
    };

    const handleDeclineOrder = (orderId) => {
        setPendingOrders(prev => prev.filter(o => o.orderId !== orderId));
    };

    const handleCallCustomer = async () => {
        const userId = SheetService.currentUser?.id;
        const customerName = activeJob?.customerName || 'Customer';
        const customerPhone = activeJob?.customerPhone;

        // first check for WebRTC support
        const isWebRTCSupported = CallService.checkSupport ? CallService.checkSupport() : false;
        if (!isWebRTCSupported) {
            if (customerPhone) {
                Alert.alert(
                    'Call',
                    `Call ${customerName} at ${customerPhone}?`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Call 📞',
                            onPress: () => {
                                SheetService.recordCall({
                                    orderId: activeJob?.orderId,
                                    phoneNumber: customerPhone,
                                    name: customerName,
                                    type: 'outgoing'
                                }).catch(() => { });
                                Linking.openURL(`tel:${customerPhone}`).catch(() => {
                                    Alert.alert('Error', 'Could not make call');
                                });
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Call', 'Customer phone number not available. A development build is required for in‑app VoIP.');
            }
            return;
        }

        if (!userId) {
            Alert.alert('Error', 'Please log in to make calls');
            return;
        }

        Alert.alert(
            'Voice Call',
            `Start a voice call with ${customerName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Call 📞',
                    onPress: async () => {
                        setIsCalling(true);
                        setCallState('calling');

                        // requirement: record call
                        SheetService.recordCall({
                            orderId: activeJob?.orderId,
                            phoneNumber: customerPhone || 'VoIP',
                            name: customerName,
                            type: 'outgoing'
                        }).catch(() => { });

                        // ensure call service is initialized
                        CallService.init(userId);
                        CallService.onCallStateChange = (state) => {
                            setCallState(state);
                            if (state === 'ended' || state === 'busy') {
                                setIsCalling(false);
                            }
                        };

                        const targetId = customerName.replace(/\s+/g, '_').toLowerCase();
                        await CallService.initiateCall(targetId, userId);
                    }
                }
            ]
        );
    };

    const handleChatCustomer = () => {
        navigation.navigate('Chat', {
            orderId: activeJob?.orderId,
            recipientName: activeJob?.customerName || 'Customer',
            recipientRole: 'customer',
        });
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'assigned': return 'Going to Pickup';
            case 'picked_up': return 'Picked Up – En route';
            case 'in_transit': return 'In Transit';
            case 'completed': return 'Completed ✓';
            default: return String(status || '').toUpperCase();
        }
    };

    const getNextActionLabel = (status) => {
        switch (status) {
            case 'assigned': return 'Mark as Picked Up';
            case 'picked_up': return 'Start Transit';
            case 'in_transit': return 'Complete Delivery';
            default: return null;
        }
    };

    const getNextStatus = (status) => {
        switch (status) {
            case 'assigned': return 'picked_up';
            case 'picked_up': return 'in_transit';
            case 'in_transit': return 'completed';
            default: return null;
        }
    };

    return (
        <View style={styles.container}>

            {/* Map Layer */}
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                region={location}
                initialRegion={location}
                customMapStyle={mapStyle}
                showsUserLocation={true}
                showsTraffic={true}
                showsBuildings={true}
                showsIndoors={true}
                showsPointsOfInterest={true}
                userInterfaceStyle="dark"
            >
                {/* Ambient Places */}
                {!activeJob && ambientPlaces.map(p => (
                    <Marker
                        key={`ambient-${p.id}`}
                        coordinate={{ latitude: p.lat, longitude: p.lng }}
                        title={p.name}
                        description={p.address}
                        tracksViewChanges={false}
                    >
                        <Surface style={[styles.placeMarker, { borderColor: p.kind === 'pharmacy' ? '#E74C3C' : p.kind === 'school' ? '#3498DB' : '#A8E05F' }]} elevation={2}>
                            <IconButton
                                icon={p.kind === 'pharmacy' ? 'medical-bag' : p.kind === 'grocery' ? 'cart' : p.kind === 'school' ? 'school' : 'silverware-fork-knife'}
                                size={14}
                                iconColor={p.kind === 'pharmacy' ? '#E74C3C' : p.kind === 'school' ? '#3498DB' : '#A8E05F'}
                                style={{ margin: 0 }}
                            />
                        </Surface>
                    </Marker>
                ))}

                {/* Active Job Markers */}
                {activeJob && (
                    <>
                        <Marker
                            coordinate={activeJob.pickupCoords}
                            title="Pickup"
                            description={activeJob.pickup}
                        >
                            <Surface style={[styles.jobMarker, { borderColor: '#2ECC71' }]} elevation={4}>
                                <IconButton icon="package-variant-closed" size={18} iconColor="#2ECC71" style={{ margin: 0 }} />
                            </Surface>
                        </Marker>
                        <Marker
                            coordinate={activeJob.dropoffCoords}
                            title="Dropoff"
                            description={activeJob.dropoff}
                        >
                            <Surface style={[styles.jobMarker, { borderColor: '#E74C3C' }]} elevation={4}>
                                <IconButton icon="flag-checkered" size={18} iconColor="#E74C3C" style={{ margin: 0 }} />
                            </Surface>
                        </Marker>
                    </>
                )}

                {routeCoords.length > 0 && (
                    <>
                        <Polyline
                            coordinates={routeCoords}
                            strokeWidth={12}
                            strokeColor="rgba(46, 204, 113, 0.3)"
                        />
                        <Polyline
                            coordinates={routeCoords}
                            strokeWidth={5}
                            strokeColor="#2ECC71"
                            lineCap="round"
                            lineJoin="round"
                        />
                    </>
                )}
            </MapView>

            {/* Radar Overlay */}
            {isOnline && !activeJob && (
                <View style={styles.radarContainer} pointerEvents="none">
                    <Pulse delay={0} />
                    <Pulse delay={1000} />
                    <Pulse delay={2000} />
                    <View style={styles.radarCenter}>
                        <Avatar.Icon size={40} icon="motorbike" backgroundColor="#000" color="#A8E05F" />
                    </View>
                </View>
            )}

            {/* Sync Indicator */}
            {isSyncing && (
                <View style={styles.syncIndicator}>
                    <IconButton icon="cloud-sync" size={14} iconColor="#2ECC71" style={{ margin: 0 }} />
                    <Text style={styles.syncText}>Syncing Live Data...</Text>
                </View>
            )}

            {/* Top Bar */}
            <View style={styles.topBar}>
                <Animated.View style={createPressStyle(onlineScale)}>
                    <TouchableOpacity
                        activeOpacity={1}
                        onPressIn={() => handlePressIn(onlineScale)}
                        onPressOut={() => handlePressOut(onlineScale)}
                        onPress={toggleOnline}
                        style={[styles.statusPill, { backgroundColor: theme.colors.surface }]}
                    >
                        <Text style={[styles.statusText, { color: theme.colors.text }]}>
                            {isOnline ? (subscription?.subscriptionStatus === 'active' ? 'Online' : 'Restricted') : 'Offline'}
                        </Text>
                        {subscription?.subscriptionStatus !== 'active' && (
                            <View style={[styles.subWarningDot, { backgroundColor: theme.colors.error }]} />
                        )}
                        <Switch
                            value={isOnline}
                            onValueChange={toggleOnline}
                            color={subscription?.subscriptionStatus === 'active' ? theme.colors.secondary : theme.colors.error}
                        />
                    </TouchableOpacity>
                </Animated.View>

                {/* Subscription Status Badge */}
                <Animated.View style={createPressStyle(subScale)}>
                    <TouchableOpacity
                        style={[
                            styles.subBadge,
                            { borderColor: subscription?.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C' }
                        ]}
                        activeOpacity={1}
                        onPressIn={() => handlePressIn(subScale)}
                        onPressOut={() => handlePressOut(subScale)}
                        onPress={() => navigation.navigate('Subscription')}
                    >
                        <View style={[
                            styles.subBadgeDot,
                            { backgroundColor: subscription?.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C' }
                        ]} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.subBadgeTitle} numberOfLines={1}>
                                {subscription?.subscriptionStatus === 'active'
                                    ? (subscription.subscriptionType
                                        ? String(subscription.subscriptionType).charAt(0).toUpperCase() + String(subscription.subscriptionType).slice(1) + ' Plan'
                                        : 'Subscribed')
                                    : (user?.trialExpiryDate && new Date(user.trialExpiryDate) > new Date() ? 'Free Trial' : 'No Subscription')}
                            </Text>
                            <Text style={[
                                styles.subBadgeStatus,
                                { color: (subscription?.subscriptionStatus === 'active' || (user?.trialExpiryDate && new Date(user.trialExpiryDate) > new Date())) ? '#2ECC71' : '#E74C3C' }
                            ]}>
                                {subscription?.subscriptionStatus === 'active'
                                    ? (subscription.expiryDate
                                        ? `Expires ${new Date(subscription.expiryDate).toLocaleDateString()}`
                                        : 'Active')
                                    : (user?.trialExpiryDate && new Date(user.trialExpiryDate) > new Date()
                                        ? `Ends ${new Date(user.trialExpiryDate).toLocaleDateString()}`
                                        : 'Tap to Subscribe')}
                            </Text>
                        </View>
                        <IconButton icon="chevron-right" size={16} iconColor="#7F8C8D" style={{ margin: 0 }} />
                    </TouchableOpacity>
                </Animated.View>

                {isOnline && pendingOrders.length > 0 && (
                    <View style={styles.pendingBadgeWrapper}>
                        <IconButton icon="bell-ring" size={22} iconColor="#F39C12" />
                        <Badge style={styles.badge}>{pendingOrders.length}</Badge>
                    </View>
                )}
            </View>

            {/* Floating Content when NO active job */}
            {!activeJob && (
                <View style={[styles.bottomOverlay, { bottom: 90 + insets.bottom }]}>
                    {isOnline && pendingOrders.length > 0 && (
                        <ScrollView style={{ maxHeight: height * 0.45 }} showsVerticalScrollIndicator={false}>
                            {pendingOrders.map((order) => (
                                <Surface key={order.orderId} style={[styles.pendingCard, { backgroundColor: theme.colors.surface }]} elevation={8}>
                                    {/* Service Type Banner */}
                                    <View style={styles.serviceTypeBanner}>
                                        <IconButton
                                            icon={SERVICE_ICON[order.serviceType] || 'motorbike'}
                                            size={20}
                                            iconColor="#F39C12"
                                            style={{ margin: 0 }}
                                        />
                                        <Text style={styles.serviceTypeText}>
                                            {SERVICE_LABEL[order.serviceType] || order.serviceType || 'Ride Request'}
                                        </Text>
                                        <Text style={styles.orderIdSmall}>#{order.orderId}</Text>
                                    </View>

                                    <Divider style={{ backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 }} />

                                    {/* Route */}
                                    <View style={styles.routeBlock}>
                                        <View style={styles.routeRow}>
                                            <View style={[styles.routeDot, { backgroundColor: '#2ECC71' }]} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.routeRowLabel}>PICKUP</Text>
                                                <Text style={styles.routeRowAddr} numberOfLines={2}>{order.pickup || 'Address not set'}</Text>
                                                {order.providerName && (
                                                    <Text style={styles.providerTag}>📍 {order.providerName}</Text>
                                                )}
                                            </View>
                                        </View>
                                        <View style={styles.routeLine} />
                                        <View style={styles.routeRow}>
                                            <View style={[styles.routeDot, { backgroundColor: '#E74C3C' }]} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.routeRowLabel}>DROPOFF</Text>
                                                <Text style={styles.routeRowAddr} numberOfLines={2}>{order.dropoff || 'Address not set'}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Meta chips */}
                                    <View style={styles.metaRow}>
                                        <View style={styles.metaChip}>
                                            <Text style={styles.metaLabel}>FARE</Text>
                                            <Text style={[styles.metaValue, { color: '#2ECC71' }]}>{order.price || '--'}</Text>
                                        </View>
                                        {order.distanceKm && (
                                            <View style={styles.metaChip}>
                                                <Text style={styles.metaLabel}>DIST</Text>
                                                <Text style={styles.metaValue}>{Number(order.distanceKm).toFixed(1)} km</Text>
                                            </View>
                                        )}
                                        {order.etaMinutes && (
                                            <View style={styles.metaChip}>
                                                <Text style={styles.metaLabel}>ETA</Text>
                                                <Text style={styles.metaValue}>{order.etaMinutes} min</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Customer Info */}
                                    {order.customerName && (
                                        <View style={styles.customerRow}>
                                            <Avatar.Icon size={28} icon="account" backgroundColor="#252525" color="#BDC3C7" />
                                            <View style={{ marginLeft: 8, flex: 1 }}>
                                                <Text style={styles.customerName}>{order.customerName}</Text>
                                                {order.customerPhone && (
                                                    <Text style={styles.customerPhone}>{order.customerPhone}</Text>
                                                )}
                                            </View>
                                        </View>
                                    )}

                                    {/* Notes */}
                                    {order.notes && (
                                        <View style={styles.notesBox}>
                                            <Text style={styles.notesLabel}>📝 Customer Note</Text>
                                            <Text style={styles.notesText}>{order.notes}</Text>
                                        </View>
                                    )}

                                    {order.itemDescription && (
                                        <View style={[styles.notesBox, { borderColor: '#2ECC7133' }]}>
                                            <Text style={[styles.notesLabel, { color: '#2ECC71' }]}>📦 Items</Text>
                                            <Text style={styles.notesText}>{order.itemDescription}</Text>
                                        </View>
                                    )}

                                    {/* Accept / Decline */}
                                    <View style={styles.acceptRow}>
                                        {(subscription?.subscriptionStatus === 'active' || (user?.trialExpiryDate && new Date(user.trialExpiryDate) > new Date())) ? (
                                            <>
                                                <Button
                                                    mode="outlined"
                                                    textColor="#E74C3C"
                                                    style={{ flex: 1, borderColor: '#E74C3C', borderRadius: 12 }}
                                                    onPress={() => handleDeclineOrder(order.orderId)}
                                                >
                                                    Decline
                                                </Button>
                                                <Button
                                                    mode="contained"
                                                    buttonColor="#2ECC71"
                                                    textColor="#000"
                                                    style={{ flex: 2, borderRadius: 12, marginLeft: 10 }}
                                                    onPress={() => handleAcceptOrder(order)}
                                                >
                                                    ✓ Accept
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                mode="contained"
                                                buttonColor="#F39C12"
                                                textColor="#000"
                                                style={{ flex: 1, borderRadius: 12 }}
                                                onPress={() => navigation.navigate('Subscription')}
                                                icon="lock"
                                            >
                                                Subscribe to Accept
                                            </Button>
                                        )}
                                    </View>
                                </Surface>
                            ))}
                        </ScrollView>
                    )}

                    {isOnline && pendingOrders.length === 0 && (
                        <Surface style={[styles.requestCard, { backgroundColor: theme.colors.surface }]} elevation={5}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.greenTitle}>Looking for assignments</Text>
                                <IconButton icon="radar" size={20} />
                            </View>
                            <Text style={[styles.userName, { color: theme.colors.text }]}>Stay online to receive orders.</Text>
                            <Text style={styles.distanceText}>Nearby orders will appear here automatically.</Text>
                        </Surface>
                    )}

                    {/* Profile Card */}
                    <Surface style={[styles.profileCard, { backgroundColor: theme.colors.surface }]} elevation={3}>
                        <View style={styles.profileHeader}>
                            <TouchableOpacity onPress={() => navigation.navigate('ProfileSettings')}>
                                {user?.photo ? (
                                    <Avatar.Image size={50} source={{ uri: user.photo }} />
                                ) : (
                                    <Avatar.Icon size={50} icon="account" />
                                )}
                            </TouchableOpacity>
                            <View style={styles.profileInfo}>
                                <Text style={[styles.driverName, { color: theme.colors.text }]}>{user?.name || 'Biker'}</Text>
                                <Text style={styles.driverLevel}>Driver</Text>
                            </View>
                            <TouchableOpacity style={styles.balanceBox} onPress={() => setShowSubscription(true)}>
                                <Text style={styles.balanceLabel}>Subscription</Text>
                                <Text style={[styles.balanceValue, { color: subscription?.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C' }]}>
                                    {subscription?.subscriptionStatus ? String(subscription.subscriptionStatus).charAt(0).toUpperCase() + String(subscription.subscriptionStatus).slice(1) : 'None'}
                                </Text>
                                <Text style={styles.commissionDebt}>{subscription?.subscriptionType ? String(subscription.subscriptionType).charAt(0).toUpperCase() + String(subscription.subscriptionType).slice(1) : '--'}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.statsStrip}>
                            <View style={styles.statBox}>
                                <IconButton icon="check-circle" size={20} iconColor={theme.colors.secondary} style={styles.statIcon} />
                                <Text style={styles.statVal}>{dashboard?.stats?.completedOrders ?? '--'}</Text>
                                <Text style={styles.statLab}>Completed</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <IconButton icon="star" size={20} iconColor="#F1C40F" style={styles.statIcon} />
                                <Text style={styles.statVal}>{user?.rating?.toFixed(1) || '5.0'}</Text>
                                <Text style={styles.statLab}>Rating</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <IconButton icon="bell" size={20} iconColor="#BDC3C7" style={styles.statIcon} />
                                <Text style={styles.statVal}>{dashboard?.notifications?.unreadCount ?? 0}</Text>
                                <Text style={styles.statLab}>Alerts</Text>
                            </View>
                        </View>
                    </Surface>
                </View>
            )}

            {/* Subscription Overlay */}
            {showSubscription && (
                <View style={styles.subscriptionOverlay}>
                    <Surface style={[styles.subscriptionCard, { backgroundColor: theme.colors.surface }]} elevation={10}>
                        <View style={styles.subscriptionHeader}>
                            <Text style={[styles.subscriptionTitle, { color: theme.colors.text }]}>Subscription Status</Text>
                            <IconButton icon="close" size={24} iconColor={theme.colors.text} onPress={() => setShowSubscription(false)} />
                        </View>
                        <Divider style={{ marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                        {subscription ? (
                            <>
                                <View style={styles.subscriptionSection}>
                                    <Text style={styles.subscriptionLabel}>Current Plan</Text>
                                    <Text style={[styles.subscriptionAmount, { color: subscription.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C' }]}>
                                        {String(subscription.subscriptionType).charAt(0).toUpperCase() + String(subscription.subscriptionType).slice(1)}
                                    </Text>
                                </View>
                                <View style={styles.subscriptionSection}>
                                    <Text style={styles.subscriptionLabel}>Status</Text>
                                    <Text style={[styles.subscriptionAmount, { color: subscription.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C' }]}>
                                        {String(subscription.subscriptionStatus).charAt(0).toUpperCase() + String(subscription.subscriptionStatus).slice(1)}
                                    </Text>
                                </View>
                                <View style={styles.subscriptionSection}>
                                    <Text style={styles.subscriptionLabel}>Amount</Text>
                                    <Text style={[styles.subscriptionAmount, { color: theme.colors.secondary }]}>
                                        ${((subscription.amount || 0) / 100).toFixed(2)}
                                    </Text>
                                </View>
                                {subscription.expiryDate && (
                                    <View style={styles.subscriptionSection}>
                                        <Text style={styles.subscriptionLabel}>Expires</Text>
                                        <Text style={[styles.subscriptionAmount, { color: theme.colors.text }]}>
                                            {new Date(subscription.expiryDate).toLocaleDateString()}
                                        </Text>
                                    </View>
                                )}
                                <Text style={styles.subscriptionNote}>Manage your subscription in the app settings or contact support for details.</Text>
                            </>
                        ) : (
                            <>
                                <View style={styles.subscriptionSection}>
                                    <Text style={[styles.subscriptionAmount, { color: '#E74C3C' }]}>No Active Subscription</Text>
                                </View>
                                <Text style={styles.subscriptionNote}>You need an active subscription to accept rides.</Text>
                                <Button
                                    mode="outlined"
                                    textColor={theme.colors.secondary}
                                    style={{ marginTop: 20 }}
                                    onPress={() => {
                                        setShowSubscription(false);
                                        navigation.navigate('Subscription');
                                    }}
                                >
                                    Choose a plan
                                </Button>
                            </>
                        )}
                    </Surface>
                </View>
            )}

            {/* bottom navigation: dashboard, subscription, chat, history, profile */}
            <Surface
                style={[
                    styles.bottomNav,
                    {
                        paddingBottom: Math.max(insets.bottom, 12),
                        height: 75 + Math.max(insets.bottom, 12)
                    }
                ]}
                elevation={4}
            >
                <Animated.View style={[{ flex: 1 }, createPressStyle(dashboardScale)]}>
                    <TouchableOpacity
                        style={styles.navItem}
                        activeOpacity={1}
                        onPressIn={() => handlePressIn(dashboardScale)}
                        onPressOut={() => handlePressOut(dashboardScale)}
                        onPress={() => navigation.navigate('Dashboard')}
                    >
                        <IconButton icon="view-dashboard" size={24} iconColor="#BDC3C7" pointerEvents="none" />
                        <Text style={styles.navText}>Dashboard</Text>
                    </TouchableOpacity>
                </Animated.View>
                <TouchableOpacity style={styles.navItem} onPress={() => setShowSubscription(true)}>
                    <IconButton icon="credit-card" size={24} iconColor={subscription?.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C'} />
                    <Text style={styles.navText}>Subscription</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('RequestHistory')}>
                    <IconButton icon="history" size={24} iconColor="#BDC3C7" />
                    <Text style={styles.navText}>History</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('ProfileSettings')}>
                    <IconButton icon="account" size={24} iconColor="#BDC3C7" />
                    <Text style={styles.navText}>Profile</Text>
                </TouchableOpacity>
            </Surface>

            {/* Active Job State */}
            {activeJob && (
                <View style={styles.activeJobContainer}>
                    <TelemetryOverlay currentSpeed={currentSpeed} speedLimit={60} />

                    <Surface style={styles.jobCard} elevation={12}>
                        {/* Status Banner */}
                        <View style={styles.statusBanner}>
                            <View style={[styles.statusDot, { backgroundColor: activeJob.status === 'in_transit' ? '#3498DB' : activeJob.status === 'completed' ? '#2ECC71' : '#F39C12' }]} />
                            <Text style={styles.statusBannerText}>{getStatusLabel(activeJob.status)}</Text>
                            <Text style={styles.orderIdBadge}>#{activeJob.orderId}</Text>
                        </View>

                        {/* Service Type */}
                        {activeJob.serviceType && (
                            <View style={styles.serviceTypeRow}>
                                <IconButton
                                    icon={SERVICE_ICON[activeJob.serviceType] || 'motorbike'}
                                    size={16}
                                    iconColor="#F39C12"
                                    style={{ margin: 0 }}
                                />
                                <Text style={styles.serviceTypeChip}>
                                    {SERVICE_LABEL[activeJob.serviceType] || activeJob.serviceType}
                                </Text>
                            </View>
                        )}

                        <Divider style={{ backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 }} />

                        {/* Route Info */}
                        <View style={styles.routeBlock}>
                            <View style={styles.routeRow}>
                                <View style={[styles.routeDot, { backgroundColor: '#2ECC71' }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.routeRowLabel}>PICKUP</Text>
                                    <Text style={styles.routeRowAddr} numberOfLines={2}>{activeJob.pickup || 'Address not set'}</Text>
                                    {activeJob.providerName && (
                                        <Text style={styles.providerTag}>📍 From: {activeJob.providerName}</Text>
                                    )}
                                </View>
                            </View>
                            <View style={styles.routeLine} />
                            <View style={styles.routeRow}>
                                <View style={[styles.routeDot, { backgroundColor: '#E74C3C' }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.routeRowLabel}>DROPOFF</Text>
                                    <Text style={styles.routeRowAddr} numberOfLines={2}>{activeJob.dropoff || 'Address not set'}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Meta Row */}
                        <View style={styles.metaRow}>
                            <View style={styles.metaChip}>
                                <Text style={styles.metaLabel}>Fare</Text>
                                <Text style={[styles.metaValue, { color: '#2ECC71' }]}>{activeJob.price || '--'}</Text>
                            </View>
                            {activeJob.distanceKm && (
                                <View style={styles.metaChip}>
                                    <Text style={styles.metaLabel}>Distance</Text>
                                    <Text style={styles.metaValue}>{Number(activeJob.distanceKm).toFixed(1)} km</Text>
                                </View>
                            )}
                            {activeJob.etaMinutes && (
                                <View style={styles.metaChip}>
                                    <Text style={styles.metaLabel}>ETA</Text>
                                    <Text style={styles.metaValue}>{activeJob.etaMinutes} min</Text>
                                </View>
                            )}
                        </View>

                        {/* Customer Info */}
                        {activeJob.customerName && (
                            <View style={styles.customerRow}>
                                <Avatar.Icon size={32} icon="account" backgroundColor="#252525" color="#BDC3C7" />
                                <View style={{ marginLeft: 10, flex: 1 }}>
                                    <Text style={styles.customerName}>{activeJob.customerName}</Text>
                                    {activeJob.customerPhone && (
                                        <Text style={styles.customerPhone}>{activeJob.customerPhone}</Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Notes */}
                        {activeJob.notes && (
                            <View style={styles.notesBox}>
                                <Text style={styles.notesLabel}>📝 Note</Text>
                                <Text style={styles.notesText}>{activeJob.notes}</Text>
                            </View>
                        )}

                        {activeJob.itemDescription && (
                            <View style={[styles.notesBox, { borderColor: '#2ECC7133' }]}>
                                <Text style={[styles.notesLabel, { color: '#2ECC71' }]}>📦 Items</Text>
                                <Text style={styles.notesText}>{activeJob.itemDescription}</Text>
                            </View>
                        )}

                        <Divider style={{ backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 }} />

                        {/* call state indicator */}
                        {callState !== 'idle' && (
                            <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 8 }}>
                                {callState === 'calling' ? 'Calling...' :
                                    callState === 'connected' ? 'Connected' :
                                        callState === 'busy' ? 'Line Busy' :
                                            'Connecting...'}
                            </Text>
                        )}

                        {/* Action Buttons */}
                        <View style={styles.actionRow}>
                            {/* Call / Chat Buttons */}
                            {isCalling ? (
                                <TouchableOpacity
                                    style={styles.commBtn}
                                    onPress={() => {
                                        CallService.endCall();
                                        setIsCalling(false);
                                        setCallState('idle');
                                    }}
                                >
                                    <IconButton icon="phone-hangup" size={22} iconColor="#E74C3C" style={{ margin: 0 }} />
                                    <Text style={styles.commBtnText}>Hang Up</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.commBtn} onPress={handleCallCustomer}>
                                    <IconButton icon="phone" size={22} iconColor="#2ECC71" style={{ margin: 0 }} />
                                    <Text style={styles.commBtnText}>Call</Text>
                                </TouchableOpacity>
                            )}

                            {!isCalling && (
                                <TouchableOpacity style={styles.commBtn} onPress={handleChatCustomer}>
                                    <IconButton icon="chat" size={22} iconColor="#3498DB" style={{ margin: 0 }} />
                                    <Text style={styles.commBtnText}>Chat</Text>
                                </TouchableOpacity>
                            )}

                            {/* Status Progression Button */}
                            {getNextStatus(activeJob.status) && (
                                <Button
                                    mode="contained"
                                    buttonColor={activeJob.status === 'in_transit' ? '#2ECC71' : '#F39C12'}
                                    textColor="#000"
                                    style={{ flex: 1, borderRadius: 12 }}
                                    onPress={() => updateStatus(getNextStatus(activeJob.status))}
                                >
                                    {getNextActionLabel(activeJob.status)}
                                </Button>
                            )}
                        </View>
                    </Surface>
                </View>
            )}
            <Portal>
                <Modal
                    visible={showWelcome}
                    onDismiss={dismissWelcome}
                    contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                >
                    <LinearGradient
                        colors={['#2ECC71', '#27AE60']}
                        style={styles.modalHeader}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <IconButton icon="motorbike" iconColor="#000" size={30} />
                        <Text style={styles.modalTitle}>Welcome, Biker!</Text>
                    </LinearGradient>

                    <ScrollView style={{ maxHeight: 400, padding: 20 }}>
                        <Text style={styles.welcomeSubtitle}>How to use Biker platform</Text>

                        <View style={styles.tipRow}>
                            <IconButton icon="gift" iconColor="#2ECC71" size={24} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.tipTitle}>30-Day Free Trial</Text>
                                <Text style={styles.tipDesc}>Your first 30 days are free! Start earning immediately with full access to all orders.</Text>
                            </View>
                        </View>

                        <View style={styles.tipRow}>
                            <IconButton icon="eye-outline" iconColor="#2ECC71" size={24} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.tipTitle}>Restricted Mode</Text>
                                <Text style={styles.tipDesc}>When your plan expires, you can still stay online to view incoming requests, but you must subscribe to accept them.</Text>
                            </View>
                        </View>

                        <View style={styles.tipRow}>
                            <IconButton icon="phone-in-talk" iconColor="#2ECC71" size={24} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.tipTitle}>In-App Calling</Text>
                                <Text style={styles.tipDesc}>Once you accept a job, you can call the customer for free through the app. All calls are logged for your safety.</Text>
                            </View>
                        </View>

                        <View style={styles.tipRow}>
                            <IconButton icon="delete-sweep" iconColor="#2ECC71" size={24} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.tipTitle}>History Clearing</Text>
                                <Text style={styles.tipDesc}>Every new subscription clears your old history for a fresh start. You can also wipe your account at any time.</Text>
                            </View>
                        </View>

                        <Divider style={{ marginVertical: 15 }} />
                        <Text style={{ textAlign: 'center', opacity: 0.6, fontSize: 12, marginBottom: 20 }}>
                            Drive safe and follow all local traffic laws.
                        </Text>
                    </ScrollView>

                    <Button
                        mode="contained"
                        onPress={dismissWelcome}
                        style={styles.modalBtn}
                        buttonColor="#2ECC71"
                        textColor="#000"
                    >
                        Start Earning!
                    </Button>
                </Modal>
            </Portal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    map: { ...StyleSheet.absoluteFillObject },
    radarContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    pulse: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(168, 224, 95, 0.1)', borderWidth: 1, borderColor: 'rgba(168, 224, 95, 0.3)' },
    radarCenter: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', elevation: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    topBar: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 10 },
    statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 25, elevation: 5 },
    statusText: { fontSize: 16, fontWeight: 'bold', marginRight: 10 },
    pendingBadgeWrapper: { position: 'relative', marginLeft: 10 },
    badge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#E74C3C' },
    bottomOverlay: { position: 'absolute', bottom: 90, left: 16, right: 16, zIndex: 20 },
    requestCard: { borderRadius: 25, padding: 20, marginBottom: 15, elevation: 10 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    greenTitle: { color: '#2ECC71', fontSize: 12, fontWeight: 'bold' },
    userName: { fontWeight: 'bold', fontSize: 16 },
    distanceText: { fontSize: 11, color: '#BDC3C7' },
    profileCard: { borderRadius: 25, padding: 20, marginTop: 12 },
    profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    profileInfo: { flex: 1, marginLeft: 12 },
    driverName: { fontWeight: 'bold', fontSize: 18 },
    driverLevel: { fontSize: 12, color: '#BDC3C7' },
    balanceBox: { alignItems: 'flex-end' },
    balanceLabel: { fontSize: 10, color: '#BDC3C7' },
    balanceValue: { fontSize: 18, fontWeight: 'bold' },
    commissionDebt: { fontSize: 10, color: '#A8E05F', fontWeight: 'bold' },
    statsStrip: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 20, padding: 15, justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    statBox: { alignItems: 'center' },
    statIcon: { margin: 0, padding: 0 },
    statVal: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
    statLab: { color: '#8E8E93', fontSize: 9 },
    statDivider: { width: 1, height: 25, backgroundColor: '#333' },
    bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 25, borderTopRightRadius: 25, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: 6, elevation: 20 },
    navItem: { alignItems: 'center', flex: 1 },
    navText: { fontSize: 10, color: '#BDC3C7', fontWeight: 'bold' },

    // Pending Order Card
    pendingCard: {
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F39C1233',
    },
    serviceTypeBanner: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    serviceTypeText: { color: '#F39C12', fontWeight: 'bold', fontSize: 13, flex: 1, marginLeft: 4 },
    orderIdSmall: { color: '#7F8C8D', fontSize: 11 },
    serviceTypeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    serviceTypeChip: { fontSize: 12, color: '#F39C12', fontWeight: '700', marginLeft: 4 },
    acceptRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    providerTag: { fontSize: 11, color: '#A8E05F', marginTop: 2 },

    // Active Job
    activeJobContainer: { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'flex-end' },
    jobCard: {
        margin: 12,
        marginBottom: 90,
        backgroundColor: 'rgba(15,15,15,0.97)',
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    statusBanner: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    statusBannerText: { color: '#FFF', fontWeight: 'bold', fontSize: 15, flex: 1 },
    orderIdBadge: { color: '#7F8C8D', fontSize: 12, backgroundColor: '#252525', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    routeBlock: { marginVertical: 4 },
    routeRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 40 },
    routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, marginRight: 12, flexShrink: 0 },
    routeLine: { width: 1, height: 14, backgroundColor: '#333', marginLeft: 4.5, marginVertical: 2 },
    routeRowLabel: { fontSize: 9, color: '#7F8C8D', fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
    routeRowAddr: { fontSize: 13, fontWeight: '600', color: '#FFF' },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
    metaChip: { backgroundColor: '#252525', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#333' },
    metaLabel: { fontSize: 9, color: '#7F8C8D', fontWeight: '800', letterSpacing: 0.5 },
    metaValue: { fontSize: 13, fontWeight: 'bold', color: '#FFF' },
    customerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 14, padding: 10, marginVertical: 6 },
    customerName: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    customerPhone: { color: '#7F8C8D', fontSize: 12 },
    notesBox: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 10, marginVertical: 4, borderWidth: 1, borderColor: '#F39C1233' },
    notesLabel: { fontSize: 11, color: '#F39C12', fontWeight: 'bold', marginBottom: 3 },
    notesText: { color: '#BDC3C7', fontSize: 13, lineHeight: 18 },
    actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    commBtn: { backgroundColor: '#1C1C1E', borderRadius: 12, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#333' },
    commBtnText: { color: '#BDC3C7', fontSize: 10, fontWeight: 'bold', marginTop: -2 },

    // Subscription Overlay
    subscriptionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, justifyContent: 'center', alignItems: 'center', padding: 20 },
    subscriptionCard: { width: '100%', borderRadius: 25, padding: 25 },
    subscriptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    subscriptionTitle: { fontSize: 20, fontWeight: 'bold' },
    subscriptionSection: { alignItems: 'center' },
    subscriptionLabel: { fontSize: 14, color: '#BDC3C7', marginBottom: 5 },
    subscriptionAmount: { fontSize: 32, fontWeight: 'bold' },
    subscriptionNote: { color: '#7F8C8D', textAlign: 'center', marginTop: 20, fontSize: 12 },
    modeSwitch: {
        position: 'absolute',
        top: 60,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    subWarningDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
    },
    modalContent: {
        margin: 20,
        borderRadius: 24,
        overflow: 'hidden',
        paddingBottom: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#000',
    },
    welcomeSubtitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
    },
    tipRow: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    tipTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    tipDesc: {
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.8,
    },
    modalBtn: {
        margin: 20,
        paddingVertical: 5,
        borderRadius: 12,
    },
    // New Styles
    categoryContainer: {
        marginLeft: 10,
        position: 'relative',
    },
    categoryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(26,26,26,0.95)',
        paddingRight: 8,
        paddingLeft: 4,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 5,
    },
    categoryText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
    dropdownMenu: {
        position: 'absolute',
        top: 45,
        right: 0,
        width: 160,
        backgroundColor: '#1A1A1A',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden',
        zIndex: 1000,
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    dropdownItemText: {
        color: '#FFF',
        fontSize: 14,
    },
    placeMarker: {
        padding: 4,
        backgroundColor: 'rgba(26,26,26,0.95)',
        borderRadius: 20,
        borderWidth: 2,
    },
    jobMarker: {
        padding: 4,
        backgroundColor: '#000',
        borderRadius: 25,
        borderWidth: 3,
    },
    subBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15,15,15,0.92)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1.5,
        elevation: 6,
        maxWidth: 175,
    },
    subBadgeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
        flexShrink: 0,
    },
    subBadgeTitle: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    subBadgeStatus: {
        fontSize: 10,
        fontWeight: '600',
    },
    syncIndicator: {
        position: 'absolute',
        top: 110,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 12,
        paddingLeft: 4,
        paddingVertical: 4,
        zIndex: 99,
        borderWidth: 1,
        borderColor: 'rgba(46, 204, 113, 0.3)',
    },
    syncText: {
        color: '#2ECC71',
        fontSize: 11,
        fontWeight: 'bold',
    },
});

export default BikerHomeScreen;
