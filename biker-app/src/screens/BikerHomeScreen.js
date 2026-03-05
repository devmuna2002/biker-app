import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Alert, TouchableOpacity, Linking, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withDelay, withSpring } from 'react-native-reanimated';
import { Text, Surface, Switch, Button, Avatar, IconButton, useTheme, Divider, Badge, Portal, Modal } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MapView, { PROVIDER_GOOGLE, Polyline, Marker } from 'react-native-maps';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as SafeAreaContext from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import SheetService from '../api/SheetService';
import CallService from '../api/CallService';
import TelemetryOverlay from '../components/TelemetryOverlay';
import { bi } from '../components/AppIcon';
import InAppCallUI from '../components/InAppCallUI';
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
const SERVICE_ICON = { bike: bi('motorbike'), courier: bi('package-variant-closed'), local_services: bi('store'), city_to_city: bi('bus') };
const SERVICE_LABEL = { bike: 'Biker', courier: 'Send a package', local_services: 'Local services', city_to_city: 'City to City' };

const BikerHomeScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const mapRef = useRef(null);
    const socketRef = useRef(null);
    const insets = SafeAreaContext.useSafeAreaInsets ? SafeAreaContext.useSafeAreaInsets() : { top: 0, bottom: 0, left: 0, right: 0 };

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
            // Admin approval requirement removed as requested.
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
        const interval = setInterval(load, 15000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [location?.latitude, location?.longitude]);

    // Load biker subscription
    const loadSubscription = useCallback(async () => {
        if (!user?.id) return;
        try {
            const res = await SheetService.getBikerSubscriptions(user.id, { timeout: 60000 });
            if (res?.data) {
                const subs = (Array.isArray(res.data) ? res.data : res.data.subscriptions || []).filter(s => !!s);
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
                        subscriptionStatus: me.data?.subscriptionStatus,
                        expiryDate: me.data?.subscriptionExpiryDate,
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
            CallService.onCallStateChange = (state) => {
                setCallState(state);
                if (state === 'incoming' || state === 'calling') setIsCalling(true);
                else if (state === 'idle' || state === 'ended' || state === 'busy') setIsCalling(false);
            };
        }
    }, [user?.id]);

    // Socket + active order poll
    const normalizeOrder = useCallback((o) => ({
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
        customerId: o.customer?.id || o.userId || o.customerId,
        notes: o.notes,
        itemDescription: o.itemDescription || o.description,
        providerName: o.providerName || o.pickupStoreName,
    }), []);

    // Socket Connection Management
    useEffect(() => {
        let cancelled = false;
        const connect = async () => {
            if (!isOnline) {
                if (socketRef.current) {
                    try { socketRef.current.disconnect(); } catch { }
                    socketRef.current = null;
                }
                setPendingOrders([]);
                return;
            }

            if (socketRef.current?.connected) {
                if (user?.id) {
                    socketRef.current.emit('register', {
                        userId: user.id,
                        userType: 'driver'
                    });
                }
                return;
            }

            try {
                const socket = await SheetService.connectTrackingSocket();
                if (cancelled) {
                    socket.disconnect();
                    return;
                }
                socketRef.current = socket;

                // Register with backend
                if (user?.id) {
                    socket.emit('register', {
                        userId: user.id,
                        userType: 'driver'
                    });
                }

                // Listen for new incoming orders
                socket.on('new_order_request', (order) => {
                    setPendingOrders(prev => {
                        const exists = prev.find(o => o.orderId === order.orderId || o.id === order.id);
                        if (exists) return prev;
                        return [...prev, normalizeOrder(order)];
                    });
                });

                // Backend order-flow emits 'order_assigned'
                socket.on('order_assigned', (payload) => {
                    const order = payload?.order || payload;
                    const customer = payload?.customer || {};
                    const normalized = normalizeOrder({
                        ...order,
                        orderId: order.id || order.orderId,
                        customerName: customer.name,
                        customerPhone: customer.phone,
                    });
                    setPendingOrders(prev => {
                        const exists = prev.find(o => o.orderId === normalized.orderId);
                        if (exists) return prev;
                        return [...prev, normalized];
                    });
                });
                // Listen for order status updates
                socket.on('order_status_update', (data) => {
                    if (data?.status === 'cancelled') {
                        setPendingOrders(prev => prev.filter(o => String(o.orderId) !== String(data.orderId)));
                        setActiveJob(prev => {
                            if (prev && String(prev.orderId) === String(data.orderId)) {
                                Alert.alert('Trip Cancelled', 'This trip has been cancelled by the customer.');
                                return null;
                            }
                            return prev;
                        });
                        setRouteCoords([]);
                    }
                });

                // Listen for publicly broadcasted cancellations (before assignment)
                socket.on('new_order_request_cancelled', (data) => {
                    setPendingOrders(prev => prev.filter(o => String(o.orderId) !== String(data.orderId)));
                });
            } catch (err) {
                console.warn('[Socket] Connect failed:', err);
            }
        };

        connect();
        return () => {
            cancelled = true;
            if (socketRef.current) {
                socketRef.current.off('order_status_update');
                socketRef.current.off('new_order_request_cancelled');
            }
        };
    }, [isOnline, user?.id]);

    // Active order polling & Route update
    useEffect(() => {
        let interval;
        if (!isOnline) {
            setActiveJob(null);
            setRouteCoords([]);
            return;
        }

        const refreshActiveJob = async () => {
            try {
                const res = await SheetService.getDriverActiveOrder();
                const o = res?.data?.order;
                if (!o) {
                    setActiveJob(null);
                    setRouteCoords([]);
                } else {
                    const norm = normalizeOrder(o);
                    setActiveJob(norm);

                    // Update route if location changes
                    if (location?.latitude) {
                        const to = o.status === 'assigned'
                            ? (o.pickup?.coords || { lat: o.pickupLat, lng: o.pickupLng })
                            : (o.dropoff?.coords || { lat: o.dropoffLat, lng: o.dropoffLng });
                        if (to?.lat && to?.lng) {
                            try {
                                const url = `https://router.project-osrm.org/route/v1/driving/${location.longitude},${location.latitude};${to.lng},${to.lat}?overview=full&geometries=geojson`;
                                const resp = await fetch(url);
                                const d = await resp.json();
                                if (d.code === 'Ok' && d.routes?.[0]?.geometry?.coordinates) {
                                    const c = d.routes[0].geometry.coordinates;
                                    setRouteCoords(c.map(pt => ({ latitude: pt[1], longitude: pt[0] })));
                                }
                            } catch { }
                        }
                    }
                }
            } catch { }
        };

        refreshActiveJob();
        interval = setInterval(refreshActiveJob, 10000); // Poll less frequently now that we have sockets
        socketRef.current?.on('order_assigned', () => refreshActiveJob());
        return () => clearInterval(interval);
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

            // If going online, send current location immediately to be 'activated everywhere'
            if (newState && location?.latitude) {
                try {
                    await SheetService.updateDriverLocation({
                        lat: location.latitude,
                        lng: location.longitude,
                        speedMps: 0,
                    });
                } catch { }
            }

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
            if (!o || next === 'completed') {
                const completedJob = { ...activeJob };
                setActiveJob(null);
                setRouteCoords([]);
                // If completed, navigate to mandatory rating
                if (next === 'completed') {
                    navigation.navigate('Rating', {
                        bikerId: completedJob.customerContact?.id || null,
                        bikerName: completedJob.customerName || 'Customer',
                        bikerPhoto: null,
                        orderId: completedJob.orderId,
                    });
                }
            }
        } catch (e) {
            Alert.alert('Failed', e?.message || 'Status update failed');
        }
    };

    const handlePlaceBid = async (orderId, suggestedPriceCents, extraCents) => {
        const bidPriceCents = (suggestedPriceCents || 0) + extraCents;
        try {
            const res = await SheetService.placeBid({ orderId, priceCents: bidPriceCents });
            if (res?.success) {
                Alert.alert('Bid Sent', `You offered $${(bidPriceCents / 100).toFixed(2)}. Wait for customer reply.`);
                // Update local state to show bid is sent
                setPendingOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, bidSent: true, myBid: bidPriceCents } : o));
            } else {
                Alert.alert('Bid Failed', res?.message || 'Could not place bid.');
            }
        } catch (e) {
            Alert.alert('Error', e?.message || 'Network error.');
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
            const res = await SheetService.acceptOrder(order.orderId);
            setPendingOrders([]);

            if (res?.success && (res?.data?.order || res?.data?.orderId)) {
                const updatedOrder = res.data.order || order;
                const normalized = normalizeOrder(updatedOrder);
                setActiveJob(normalized);

                // Prompt driver upon accepting job
                setTimeout(() => {
                    Alert.alert(
                        'Order Accepted',
                        'Would you like to call or message the customer?',
                        [
                            { text: 'Later', style: 'cancel' },
                            {
                                text: 'Message',
                                onPress: () => {
                                    if (normalized.customerId) {
                                        navigation.navigate('Chat', {
                                            recipientId: normalized.customerId,
                                            recipientName: normalized.customerName || 'Customer',
                                            orderId: normalized.orderId
                                        });
                                    }
                                }
                            },
                            {
                                text: 'Call',
                                onPress: () => {
                                    if (!normalized.customerId) return;
                                    setIsCalling(true);
                                    setCallState('calling');
                                    CallService.init(user?.id);
                                    CallService.onCallStateChange = (state) => {
                                        setCallState(state);
                                        if (state === 'idle' || state === 'ended') {
                                            setIsCalling(false);
                                        }
                                    };
                                    CallService.callUser(normalized.customerId);
                                }
                            }
                        ]
                    );
                }, 600);
            }
        } catch (e) {
            Alert.alert('Accept Failed', e?.message || 'Could not accept this order.');
        }
    };

    const handleDeclineOrder = (orderId) => {
        setPendingOrders(prev => prev.filter(o => o.orderId !== orderId));
    };

    const handleCallCustomer = () => {
        if (!activeJob?.customerId) {
            Alert.alert('Cannot call', 'Customer information missing.');
            return;
        }
        setIsCalling(true);
        setCallState('calling');
        CallService.init(user?.id);
        CallService.onCallStateChange = (state) => {
            setCallState(state);
            if (state === 'idle' || state === 'ended') {
                setIsCalling(false);
            }
        };
        CallService.initiateCall(activeJob.customerId);
    };

    const handleEndCall = () => {
        CallService.endCall();
        setIsCalling(false);
        setCallState('idle');
    };

    const handleCancelJob = async () => {
        if (!activeJob?.orderId) return;
        Alert.alert(
            'Cancel Job',
            'Are you sure you want to cancel this job?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await SheetService.cancelOrder(activeJob.orderId);
                            setActiveJob(null);
                            setRouteCoords([]);
                        } catch (e) {
                            Alert.alert('Error', e?.message || 'Failed to cancel order');
                        }
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
            recipientPhone: activeJob?.customerPhone,
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
                {!activeJob && ambientPlaces.map(p => {
                    const lat = Number(p.lat);
                    const lng = Number(p.lng);
                    if (isNaN(lat) || isNaN(lng)) return null;
                    return (
                        <Marker
                            key={`ambient-${p.id}`}
                            coordinate={{ latitude: lat, longitude: lng }}
                            title={p.name}
                            description={p.address}
                            tracksViewChanges={false}
                        >
                            <Surface style={[styles.placeMarker, { borderColor: p.kind === 'pharmacy' ? '#E74C3C' : p.kind === 'school' ? '#3498DB' : '#A8E05F' }]} elevation={2}>
                                <IconButton
                                    icon={bi(p.kind === 'pharmacy' ? 'medical-bag' : p.kind === 'grocery' ? 'cart' : p.kind === 'school' ? 'school' : 'silverware-fork-knife')}
                                    size={14}
                                    iconColor={p.kind === 'pharmacy' ? '#E74C3C' : p.kind === 'school' ? '#3498DB' : '#A8E05F'}
                                    style={{ margin: 0 }}
                                />
                            </Surface>
                        </Marker>
                    );
                })}

                {/* Active Job Markers */}
                {(() => {
                    if (!activeJob) return null;
                    const pLat = Number(activeJob.pickupCoords?.latitude || activeJob.pickupCoords?.lat);
                    const pLng = Number(activeJob.pickupCoords?.longitude || activeJob.pickupCoords?.lng);
                    const dLat = Number(activeJob.dropoffCoords?.latitude || activeJob.dropoffCoords?.lat);
                    const dLng = Number(activeJob.dropoffCoords?.longitude || activeJob.dropoffCoords?.lng);

                    return (
                        <>
                            {!isNaN(pLat) && !isNaN(pLng) && (
                                <Marker
                                    coordinate={{ latitude: pLat, longitude: pLng }}
                                    title="Pickup"
                                    description={activeJob.pickup}
                                >
                                    <Surface style={[styles.jobMarker, { borderColor: '#2ECC71' }]} elevation={4}>
                                        <IconButton icon={bi('package-variant-closed')} size={18} iconColor="#2ECC71" style={{ margin: 0 }} />
                                    </Surface>
                                </Marker>
                            )}
                            {!isNaN(dLat) && !isNaN(dLng) && (
                                <Marker
                                    coordinate={{ latitude: dLat, longitude: dLng }}
                                    title="Dropoff"
                                    description={activeJob.dropoff}
                                >
                                    <Surface style={[styles.jobMarker, { borderColor: '#E74C3C' }]} elevation={4}>
                                        <IconButton icon={bi('flag-checkered')} size={18} iconColor="#E74C3C" style={{ margin: 0 }} />
                                    </Surface>
                                </Marker>
                            )}
                        </>
                    );
                })()}

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
                        <Avatar.Icon size={40} icon={bi('motorbike')} backgroundColor="#000" color="#A8E05F" />
                    </View>
                </View>
            )}

            {/* Sync Indicator */}
            {isSyncing && (
                <View style={styles.syncIndicator}>
                    <IconButton icon={bi('cloud-sync')} size={14} iconColor="#2ECC71" style={{ margin: 0 }} />
                    <Text style={styles.syncText}>Syncing Live Data...</Text>
                </View>
            )}

            {/* Top Bar */}
            <View style={[styles.topBar, { top: insets.top > 0 ? insets.top + 8 : 45 }]}>
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
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.subBadgeTitle, { fontSize: 11 }]} numberOfLines={1}>
                                {subscription?.subscriptionStatus === 'active'
                                    ? (subscription.subscriptionType
                                        ? String(subscription.subscriptionType).charAt(0).toUpperCase() + String(subscription.subscriptionType).slice(1)
                                        : 'Active')
                                    : (user?.trialExpiryDate && new Date(user.trialExpiryDate) > new Date() ? 'Trial' : 'No Plan')}
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.4)', marginHorizontal: 5, fontSize: 10 }}>•</Text>
                            <Text style={[
                                styles.subBadgeStatus,
                                { fontSize: 9, color: (subscription?.subscriptionStatus === 'active' || (user?.trialExpiryDate && new Date(user.trialExpiryDate) > new Date())) ? '#2ECC71' : '#E74C3C' }
                            ]}>
                                {subscription?.subscriptionStatus === 'active'
                                    ? (subscription.expiryDate
                                        ? `${new Date(subscription.expiryDate).toLocaleDateString()}`
                                        : 'Active')
                                    : (user?.trialExpiryDate && new Date(user.trialExpiryDate) > new Date()
                                        ? `${Math.ceil((new Date(user.trialExpiryDate) - new Date()) / (1000 * 60 * 60 * 24))}d`
                                        : 'Off')}
                            </Text>
                        </View>
                        <IconButton icon={bi('chevron-right')} size={16} iconColor="#7F8C8D" style={{ margin: 0 }} />
                    </TouchableOpacity>
                </Animated.View>

                {isOnline && pendingOrders.length > 0 && (
                    <View style={styles.pendingBadgeWrapper}>
                        <IconButton icon={bi('bell-ring')} size={22} iconColor="#F39C12" />
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
                                <View key={order.orderId} style={styles.jobCardSimplified}>
                                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                                    {/* Simplified Header */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <Text style={styles.jobIdText}>NEW ORDER #{order.orderId}</Text>
                                        <Text style={[styles.priceTagStraight, { color: '#00FD3F' }]}>{order.price || '--'}</Text>
                                    </View>

                                    {/* Straight Route */}
                                    <View style={styles.pendingRouteStraight}>
                                        <View style={styles.pendingRoutePoint}>
                                            <Text style={styles.pendingRouteLabel}>FROM</Text>
                                            <Text style={styles.pendingRouteValue} numberOfLines={1}>{order.pickup}</Text>
                                        </View>
                                        <View style={styles.pendingRoutePoint}>
                                            <Text style={styles.pendingRouteLabel}>TO</Text>
                                            <Text style={styles.pendingRouteValue} numberOfLines={1}>{order.dropoff}</Text>
                                        </View>
                                    </View>

                                    {/* Bidding Section */}
                                    {!order.bidSent ? (
                                        <View style={styles.bidSection}>
                                            <Text style={styles.bidTitle}>Suggest higher price:</Text>
                                            <View style={styles.bidOptions}>
                                                {[50, 100, 200, 300].map(extra => (
                                                    <TouchableOpacity
                                                        key={extra}
                                                        style={styles.bidChip}
                                                        onPress={() => handlePlaceBid(order.orderId, order.priceCents, extra)}
                                                    >
                                                        <Text style={styles.bidChipText}>+${(extra / 100).toFixed(1)}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={[styles.bidSection, { backgroundColor: 'rgba(0, 253, 63, 0.05)', borderRadius: 12, padding: 8 }]}>
                                            <Text style={[styles.bidTitle, { color: '#00FD3F' }]}>Bid Sent: ${(order.myBid / 100).toFixed(2)}</Text>
                                            <Text style={{ color: '#888', fontSize: 10 }}>Waiting for customer to accept...</Text>
                                        </View>
                                    )}

                                    {/* Accept / Decline */}
                                    <View style={styles.acceptRowStraight}>
                                        <Button
                                            mode="outlined"
                                            textColor="#BBB"
                                            style={styles.declineBtnStraight}
                                            labelStyle={{ fontSize: 13 }}
                                            onPress={() => handleDeclineOrder(order.orderId)}
                                        >
                                            Decline
                                        </Button>
                                        <Button
                                            mode="contained"
                                            buttonColor="#2ECC71"
                                            textColor="#000"
                                            style={styles.acceptBtnStraight}
                                            labelStyle={{ fontWeight: 'bold' }}
                                            onPress={() => handleAcceptOrder(order)}
                                            disabled={order.bidSent}
                                        >
                                            {order.bidSent ? 'Bidding...' : 'Accept'}
                                        </Button>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {isOnline && pendingOrders.length === 0 && (
                        <Surface style={[styles.requestCard, { backgroundColor: theme.colors.surface }]} elevation={5}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.greenTitle}>Looking for assignments</Text>
                                <IconButton icon={bi('radar')} size={20} />
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
                                    <Avatar.Icon size={50} icon={bi('account')} />
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
                                <IconButton icon={bi('check-circle')} size={20} iconColor={theme.colors.secondary} style={styles.statIcon} />
                                <Text style={styles.statVal}>{dashboard?.stats?.completedOrders ?? '--'}</Text>
                                <Text style={styles.statLab}>Completed</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <IconButton icon={bi('star')} size={20} iconColor="#F1C40F" style={styles.statIcon} />
                                <Text style={styles.statVal}>{user?.rating?.toFixed(1) || '5.0'}</Text>
                                <Text style={styles.statLab}>Rating</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <IconButton icon={bi('bell')} size={20} iconColor="#BDC3C7" style={styles.statIcon} />
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
                            <IconButton icon={bi('close')} size={24} iconColor={theme.colors.text} onPress={() => setShowSubscription(false)} />
                        </View>
                        <Divider style={{ marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                        {subscription ? (
                            <>
                                <View style={styles.subscriptionSection}>
                                    <Text style={styles.subscriptionLabel}>Current Plan</Text>
                                    <Text style={[styles.subscriptionAmount, { color: subscription?.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C' }]}>
                                        {String(subscription?.subscriptionType || 'Plan').charAt(0).toUpperCase() + String(subscription?.subscriptionType || 'Plan').slice(1)}
                                    </Text>
                                </View>
                                <View style={styles.subscriptionSection}>
                                    <Text style={styles.subscriptionLabel}>Status</Text>
                                    <Text style={[styles.subscriptionAmount, { color: subscription?.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C' }]}>
                                        {String(subscription?.subscriptionStatus || 'Inactive').charAt(0).toUpperCase() + String(subscription?.subscriptionStatus || 'Inactive').slice(1)}
                                    </Text>
                                </View>
                                <View style={styles.subscriptionSection}>
                                    <Text style={styles.subscriptionLabel}>Amount</Text>
                                    <Text style={[styles.subscriptionAmount, { color: theme.colors.secondary }]}>
                                        ${((subscription?.amount || 0) / 100).toFixed(2)}
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
                        <IconButton icon={bi('view-dashboard')} size={24} iconColor="#BDC3C7" pointerEvents="none" />
                        <Text style={styles.navText}>Dashboard</Text>
                    </TouchableOpacity>
                </Animated.View>
                <TouchableOpacity style={styles.navItem} onPress={() => setShowSubscription(true)}>
                    <IconButton icon={bi('credit-card')} size={24} iconColor={subscription?.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C'} />
                    <Text style={styles.navText}>Subscription</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('RequestHistory')}>
                    <IconButton icon={bi('history')} size={24} iconColor="#BDC3C7" />
                    <Text style={styles.navText}>History</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('ProfileSettings')}>
                    <IconButton icon={bi('account')} size={24} iconColor="#BDC3C7" />
                    <Text style={styles.navText}>Profile</Text>
                </TouchableOpacity>
            </Surface>

            {/* Active Job State */}
            {activeJob && (
                <View style={styles.activeJobContainer}>
                    <BlurView intensity={90} tint="dark" style={styles.jobCardSimplified}>
                        {/* Compact Header */}
                        <View style={styles.jobHeaderCompact}>
                            <View>
                                <Text style={styles.jobIdText}>Order #{activeJob.orderId}</Text>
                                <View style={styles.statusPillFancy}>
                                    <View style={[styles.statusPulse, { backgroundColor: activeJob.status === 'assigned' ? '#F1C40F' : '#00FD3F' }]} />
                                    <Text style={styles.statusPillTextFancy}>{getStatusLabel(activeJob.status)}</Text>
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.essentialValuePrice}>{activeJob.price || '--'}</Text>
                                <Text style={styles.priceLabelSmall}>EARNINGS</Text>
                            </View>
                        </View>

                        {/* Straight Route Info */}
                        <View style={styles.routeSectionStraight}>
                            <View style={[styles.routePointStraight, { marginBottom: 12 }]}>
                                <View style={styles.pickupDotFancy} />
                                <Text style={styles.routeValueStraight} numberOfLines={1}>{activeJob.pickup}</Text>
                            </View>
                            <View style={styles.routePointStraight}>
                                <View style={styles.dropoffSquareFancy} />
                                <Text style={styles.routeValueStraight} numberOfLines={1}>{activeJob.dropoff}</Text>
                            </View>
                        </View>

                        <Divider style={styles.straightDivider} />

                        {/* Essentials Only */}
                        <View style={styles.essentialsRow}>
                            <Text style={styles.essentialValue}>{activeJob.customerName}</Text>
                        </View>

                        {/* Straight Action Row */}
                        <View style={styles.straightActionRow}>
                            <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: 'rgba(0, 253, 63, 0.1)', borderColor: 'rgba(0, 253, 63, 0.2)' }]} onPress={handleCallCustomer}>
                                <IconButton icon={bi('phone')} size={24} iconColor="#00FD3F" style={{ margin: 0 }} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: 'rgba(52, 152, 219, 0.1)', borderColor: 'rgba(52, 152, 219, 0.2)' }]} onPress={handleChatCustomer}>
                                <IconButton icon={bi('chat')} size={24} iconColor="#3498DB" style={{ margin: 0 }} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: 'rgba(231, 76, 60, 0.1)', borderColor: 'rgba(231, 76, 60, 0.2)' }]} onPress={handleCancelJob}>
                                <IconButton icon={bi('close')} size={24} iconColor="#E74C3C" style={{ margin: 0 }} />
                            </TouchableOpacity>
                        </View>

                        <Button
                            mode="contained"
                            buttonColor="#00FD3F"
                            textColor="#000"
                            style={[styles.primaryActionBtn, { marginTop: 12 }]}
                            labelStyle={{ fontWeight: '900', fontSize: 13, textTransform: 'uppercase' }}
                            onPress={() => updateStatus(getNextStatus(activeJob.status))}
                        >
                            {getNextActionLabel(activeJob.status) || 'Done'}
                        </Button>
                    </BlurView>
                </View>
            )}
            <Portal>
                <Modal
                    visible={showWelcome}
                    onDismiss={dismissWelcome}
                    contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                >
                    <View style={{ overflow: 'hidden', borderRadius: 24, paddingBottom: 10 }}>
                        <LinearGradient
                            colors={['#2ECC71', '#27AE60']}
                            style={styles.modalHeader}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <IconButton icon={bi('motorbike')} iconColor="#000" size={30} />
                            <Text style={styles.modalTitle}>Welcome, Biker!</Text>
                        </LinearGradient>

                        <ScrollView style={{ maxHeight: 400, padding: 20 }}>
                            <Text style={styles.welcomeSubtitle}>How to use Biker platform</Text>

                            <View style={styles.tipRow}>
                                <IconButton icon={bi('gift')} iconColor="#2ECC71" size={24} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tipTitle}>7-Day Free Trial</Text>
                                    <Text style={styles.tipDesc}>Your first 7 days are free! Start earning immediately with full access to all orders.</Text>
                                </View>
                            </View>

                            <View style={styles.tipRow}>
                                <IconButton icon={bi('eye-outline')} iconColor="#2ECC71" size={24} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tipTitle}>Restricted Mode</Text>
                                    <Text style={styles.tipDesc}>When your plan expires, you can still stay online to view incoming requests, but you must subscribe to accept them.</Text>
                                </View>
                            </View>

                            <View style={styles.tipRow}>
                                <IconButton icon={bi('phone-in-talk')} iconColor="#2ECC71" size={24} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tipTitle}>In-App Calling</Text>
                                    <Text style={styles.tipDesc}>Once you accept a job, you can call the customer for free through the app. All calls are logged for your safety.</Text>
                                </View>
                            </View>

                            <View style={styles.tipRow}>
                                <IconButton icon={bi('delete-sweep')} iconColor="#2ECC71" size={24} />
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
                    </View>
                </Modal>
            </Portal>
            {/* App Locked Overlay */}
            {(() => {
                const now = new Date();
                const trialActive = user?.trialExpiryDate && new Date(user.trialExpiryDate) > now;
                const subActive = subscription?.subscriptionStatus === 'active';

                if (!trialActive && !subActive) {
                    return (
                        <Surface style={[styles.restrictedBanner, { top: insets.top + 100 }]} elevation={8}>
                            <IconButton icon={bi('lock-alert')} size={20} iconColor="#E74C3C" style={{ margin: 0 }} />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={styles.restrictedText}>Trial ended. Subscribe to accept orders.</Text>
                            </View>
                            <Button
                                mode="text"
                                compact
                                textColor="#2ECC71"
                                onPress={() => navigation.navigate('Subscription')}
                                labelStyle={{ fontSize: 11, fontWeight: 'bold' }}
                            >
                                Plans
                            </Button>
                        </Surface>
                    );
                }
                return null;
            })()}

            <InAppCallUI
                visible={isCalling}
                status={callState}
                recipientName={activeJob?.customerName || 'Customer'}
                recipientPhoto={null}
                onEndCall={handleEndCall}
                onRejectCall={handleEndCall}
                onAcceptCall={() => {
                    CallService.acceptCall();
                    setCallState('connected');
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    map: { ...StyleSheet.absoluteFillObject },
    radarContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    pulse: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(0, 253, 63, 0.04)',
        borderWidth: 1.5,
        borderColor: 'rgba(0, 253, 63, 0.4)',
        shadowColor: '#00FD3F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    radarCenter: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#000',
        elevation: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#00FD3F',
        shadowColor: '#00FD3F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
    },
    topBar: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        gap: 8,
        zIndex: 10
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 15,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    statusText: { fontSize: 13, fontWeight: 'bold', marginRight: 6 },
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

    // Simplified Pending Request Card
    pendingCard: {
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2ECC7133',
    },
    pendingRouteStraight: {
        gap: 8,
        marginBottom: 16,
    },
    pendingRoutePoint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pendingRouteLabel: {
        color: '#444',
        fontSize: 9,
        fontWeight: 'bold',
        width: 35,
    },
    pendingRouteValue: {
        color: '#FFF',
        fontSize: 13,
        flex: 1,
    },
    priceTagStraight: {
        color: '#2ECC71',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 12,
    },
    acceptRowStraight: {
        flexDirection: 'row',
        gap: 10,
    },
    declineBtnStraight: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#444',
    },
    acceptBtnStraight: {
        flex: 2,
        borderRadius: 12,
    },

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

    // Simplified Job Card Redesigned
    jobCardSimplified: {
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        borderRadius: 28,
        marginHorizontal: 16,
        marginBottom: Platform.OS === 'ios' ? 100 : 80,
        padding: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 10,
        overflow: 'hidden',
    },
    jobHeaderCompact: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    jobIdText: {
        color: '#7f8c8d',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 4,
    },
    statusPillFancy: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    statusPulse: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
        shadowColor: '#FFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 4,
    },
    statusPillTextFancy: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    essentialValuePrice: {
        color: '#00FD3F',
        fontSize: 18,
        fontWeight: '900',
    },
    priceLabelSmall: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '900',
        marginTop: 2,
    },
    routeSectionStraight: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 18,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    routePointStraight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    pickupDotFancy: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#00FD3F',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    dropoffSquareFancy: {
        width: 12,
        height: 12,
        borderRadius: 2,
        backgroundColor: '#FF4757',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    routeValueStraight: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    straightDivider: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginVertical: 16,
    },
    essentialsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 10,
    },
    essentialValue: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    straightActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconActionBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    primaryActionBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
    },

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
        backgroundColor: 'rgba(25,25,25,0.95)',
        borderRadius: 15,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        elevation: 4,
        maxWidth: 180,
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
    restrictedBanner: {
        position: 'absolute',
        left: 20,
        right: 20,
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.4)',
        zIndex: 50,
    },
    restrictedText: {
        color: '#FFF',
        fontSize: 12,
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
    // Locked Overlay Styles
    lockedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.9)',
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    lockedCard: {
        width: '100%',
        backgroundColor: '#1C1C1E',
        borderRadius: 28,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.3)',
    },
    lockedTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    lockedSubtitle: {
        color: '#BDC3C7',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 30,
    },
    lockedBtn: {
        width: '100%',
        borderRadius: 14,
        paddingVertical: 6,
        marginBottom: 10,
    },
    // Bidding Styles
    bidSection: {
        marginVertical: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    bidTitle: {
        color: '#8A8A8E',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    bidOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    bidChip: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    bidChipText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    },
});

export default BikerHomeScreen;
