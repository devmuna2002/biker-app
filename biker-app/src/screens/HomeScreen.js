import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StatusBar, TextInput, FlatList, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { Text, Avatar, IconButton, Surface, Button, Menu, useTheme, Portal, Modal, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useNavigation, useRoute, DrawerActions, useFocusEffect } from '@react-navigation/native';
import * as SafeAreaContext from 'react-native-safe-area-context';
import SheetService from '../api/SheetService';
import AppSecurity from '../utils/AppSecurity';
import { bi } from '../components/AppIcon';
import InAppCallUI from '../components/InAppCallUI';
import CallService from '../api/CallService';
import mapStyle from '../theme/mapStyle.json';
import * as Linking from 'expo-linking';

const { width, height } = Dimensions.get('window');
const HomeScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const route = useRoute();
    const insets = SafeAreaContext.useSafeAreaInsets ? SafeAreaContext.useSafeAreaInsets() : { top: 0, bottom: 0, left: 0, right: 0 };
    const mapRef = useRef(null);
    const socketRef = useRef(null);
    const scrollViewRef = useRef(null);
    const [location, setLocation] = useState(null);
    const [pickupAddress, setPickupAddress] = useState('Getting location...');
    const [drivers, setDrivers] = useState([]);
    const [activeService, setActiveService] = useState('courier');
    const [foodKind, setFoodKind] = useState('restaurant'); // restaurant | grocery | pharmacy | school ...
    const [foodMenuVisible, setFoodMenuVisible] = useState(false);
    const [providers, setProviders] = useState([]);
    const [providersLoading, setProvidersLoading] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [routeCoords, setRouteCoords] = useState(null);
    const [bikerPos, setBikerPos] = useState(null);
    const [isSettingLocation, setIsSettingLocation] = useState(false);
    const [bids, setBids] = useState([]);
    const [showNearby, setShowNearby] = useState(true);
    const [isTracking, setIsTracking] = useState(false);
    const [draftOrderId, setDraftOrderId] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [editablePrice, setEditablePrice] = useState(null);
    const [mapFocused, setMapFocused] = useState(false);
    const [pinningMode, setPinningMode] = useState(false);
    const [routePickup, setRoutePickup] = useState(null); // pickup from route selection
    const [ambientPlaces, setAmbientPlaces] = useState([]);
    const [isCalling, setIsCalling] = useState(false);
    const [callState, setCallState] = useState('idle');
    const [showSearching, setShowSearching] = useState(false);
    const [searchingOrderId, setSearchingOrderId] = useState(null);

    // ── Location Search State ──────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    
    // Route Preferences
    const [vehicleType, setVehicleType] = useState('bike');
    const [avoidTolls, setAvoidTolls] = useState(false);
    const [avoidMotorways, setAvoidMotorways] = useState(false);
    
    const searchDebounceRef = useRef(null);
    const searchInputRef = useRef(null);
    // Always holds the latest GPS location — prevents stale closure in debounce
    const locationRef = useRef(null);

    useEffect(() => {
        return () => {
            try {
                socketRef.current?.disconnect();
            } catch {
                // ignore
            }
            socketRef.current = null;
        };
    }, []);

    // Biker search state
    const [searchingBikers, setSearchingBikers] = useState(false);
    const [bikersFound, setBikersFound] = useState([]);
    const [searchError, setSearchError] = useState(null);
    const searchTimerRef = useRef(null);
    const [bikerRoutes, setBikerRoutes] = useState([]); // Routes from bikers to pickup
    const [selectedBiker, setSelectedBiker] = useState(null);

    // Local state to trigger re-render on profile update
    const [user, setUser] = useState(SheetService.currentUser);
    const [showWelcome, setShowWelcome] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    useEffect(() => {
        const checkTutorial = async () => {
            await AsyncStorage.setItem('hasSeenUserTutorial', 'true');
            setShowWelcome(false);
        };
        checkTutorial();
    }, []);

    const dismissWelcome = async () => {
        await AsyncStorage.setItem('hasSeenUserTutorial', 'true');
        setShowWelcome(false);
    };

    // Refresh user data when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            const checkUnread = async () => {
                if (SheetService.currentUser?.id) {
                    try {
                        const res = await SheetService.getNotifications();
                        if (res?.data?.notifications) {
                            setUnreadNotifications(res.data.notifications.filter(n => !n.isRead).length);
                        }
                    } catch (e) { }
                }
            };
            checkUnread();

            const current = SheetService.currentUser;
            setUser(current);
            if (current?.id) {
                CallService.init(current.id);
                CallService.onCallStateChange = (state) => {
                    setCallState(state);
                    if (state === 'incoming' || state === 'calling') setIsCalling(true);
                    else if (state === 'idle' || state === 'ended' || state === 'busy') setIsCalling(false);
                };
            }
        }, [])
    );

    // Active order polling for customer
    useEffect(() => {
        let interval;
        const checkActive = async () => {
            if (!user?.id) return;
            try {
                const res = await SheetService.getUserActiveOrder();
                if (res?.data?.order && res?.success !== false) {
                    const o = res.data.order;
                    // IF order is cancelled, don't set it as active
                    if (o.status === 'cancelled') {
                        if (activeOrder) setActiveOrder(null);
                        setIsTracking(false);
                        return;
                    }

                    setActiveOrder({
                        id: o.id,
                        status: o.status === 'driver_assigned' ? 'accepted' : o.status,
                        biker: o.biker || o.driver,
                        pickup: { address: o.pickupAddress || o.pickup?.address },
                        dropoff: { address: o.dropoffAddress || o.dropoff?.address, label: o.dropoffLabel || o.dropoff?.label },
                        priceCents: o.priceCents
                    });
                    setIsTracking(true);
                } else if (res?.success) {
                    // Backend explicitly verified there is no active order
                    setActiveOrder(null);
                    setIsTracking(false);
                }
            } catch (e) {
                // ignore
            }
        };

        if (user?.id) {
            checkActive();
            interval = setInterval(checkActive, 10000); // Poll every 10s
        }
        return () => { if (interval) clearInterval(interval); };
    }, [user?.id]);

    // Keep locationRef in sync with location state
    useEffect(() => {
        if (location?.latitude && location?.longitude) {
            locationRef.current = location;
        }
    }, [location?.latitude, location?.longitude]);

    // Stable — reads GPS from ref, never stale
    const handleSearchInput = useCallback((text) => {
        setSearchQuery(text);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (!text || text.trim().length < 2) {
            setSearchSuggestions([]);
            setSearchLoading(false);
            return;
        }
        setSearchLoading(true);
        searchDebounceRef.current = setTimeout(async () => {
            // Always read the latest GPS from ref — prevents stale-closure bug
            const gps = locationRef.current;
            try {
                const res = await SheetService.autocomplete({
                    query: text.trim(),
                    lat: gps?.latitude,
                    lng: gps?.longitude,
                });
                setSearchSuggestions(res?.data?.suggestions || []);
            } catch {
                setSearchSuggestions([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
    }, []); // stable ref — no dependency on location state

    const handleSuggestionSelect = useCallback((suggestion) => {
        Keyboard.dismiss();
        setSearchQuery(suggestion.label);
        setSearchSuggestions([]);
        setSearchFocused(false);
        navigation.navigate('RouteSelection', {
            pickup: pickupPoint ? { lat: pickupPoint.lat, lng: pickupPoint.lng, label: pickupPoint.label } : null,
            serviceType: activeService === 'local_services' ? 'courier' : activeService,
            fromLabel: pickupPoint?.label || pickupAddress || 'Current Location',
            selectedCoords: { lat: suggestion.lat, lng: suggestion.lng },
            initialQuery: suggestion.label,
            isFoodMode: false,
        });
        setTimeout(() => setSearchQuery(''), 500);
    }, [pickupPoint, activeService, pickupAddress]);

    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setSearchSuggestions([]);
        setSearchFocused(false);
        Keyboard.dismiss();
    }, []);

    // 1. One-time Init (Socket + Ambient places)
    useEffect(() => {
        if (!location) return;

        // Initial dashboard pull
        SheetService.dashboardInit({ lat: location.latitude, lng: location.longitude, radiusKm: 50 }).then(init => {
            if (init?.success) {
                setDashboard(init.data);
                setDrivers(init.data.nearbyDrivers || []);
                setUser(init.data.user || SheetService.currentUser);
            }
        }).catch(() => { });

        // Fetch ambient places once - Nominatim is slow, don't poll it!
        SheetService.getNearbyProviders({
            lat: location.latitude,
            lng: location.longitude,
            kind: 'restaurant',
            radiusM: 3000,
            limit: 15
        }).then(res => {
            if (res?.data?.providers) setAmbientPlaces(res.data.providers);
        }).catch(() => { });

        // Connect Socket once
        if (!socketRef.current) {
            SheetService.connectTrackingSocket().then(socket => {
                if (socket) {
                    socketRef.current = socket;
                    if (SheetService.currentUser?.id) {
                        socket.emit('register', { userId: SheetService.currentUser.id, userType: 'customer' });
                    }
                }
            }).catch(e => console.log('[HomeScreen] Socket connect failed:', e));
        }
    }, [location?.latitude, location?.longitude]);

    // 2. Fast Polling for Nearby Drivers (Lightweight)
    useEffect(() => {
        if (!location) return;

        const pollDrivers = async () => {
            try {
                const res = await SheetService.getDriversNearby({
                    lat: location.latitude,
                    lng: location.longitude,
                    radiusKm: 50
                });
                if (res?.success && res.data?.drivers) {
                    setDrivers(res.data.drivers);
                }
            } catch (e) { /* ignore */ }
        };

        const interval = setInterval(pollDrivers, 8000); // 8 seconds for a responsive map feel
        return () => clearInterval(interval);
    }, [location?.latitude, location?.longitude]);

    // 3. Periodic Dashboard Sync (Background updates)
    useEffect(() => {
        if (!location) return;

        const syncDashboard = async () => {
            try {
                const init = await SheetService.dashboardInit({ lat: location.latitude, lng: location.longitude, radiusKm: 50 });
                if (init?.success) {
                    setDashboard(init.data);
                    setUser(init.data.user || SheetService.currentUser);
                }
                await SheetService.flushDraftQueue();
            } catch { /* ignore */ }
        };

        const interval = setInterval(syncDashboard, 60000); // Heavy sync every minute
        return () => clearInterval(interval);
    }, [location?.latitude, location?.longitude]);

    useEffect(() => {
        if (route.params?.selectedRoute) {
            const selectedRouteData = route.params.selectedRoute;

            // Set pickup point from route data
            if (selectedRouteData.pickupLat && selectedRouteData.pickupLng) {
                setRoutePickup({
                    lat: selectedRouteData.pickupLat,
                    lng: selectedRouteData.pickupLng,
                    label: selectedRouteData.from
                });
            }

            setSelectedRoute(selectedRouteData);
            if (selectedRouteData?.serviceType) setActiveService(selectedRouteData.serviceType);
            setRouteCoords(null);
            setBikerPos(null);

            if (selectedRouteData?.dropoff) {
                // If the backend provided real road points, use them
                if (selectedRouteData.points) {
                    setRouteCoords(selectedRouteData.points);
                } else {
                    // Get road route from OSRM
                    let fromLat, fromLng;
                    if (selectedRouteData.pickupLat && selectedRouteData.pickupLng) {
                        fromLat = selectedRouteData.pickupLat;
                        fromLng = selectedRouteData.pickupLng;
                    } else if (selectedRouteData.serviceType === 'local_services' && selectedProvider?.lat && selectedProvider?.lng) {
                        fromLat = selectedProvider.lat;
                        fromLng = selectedProvider.lng;
                    } else {
                        fromLat = location?.latitude;
                        fromLng = location?.longitude;
                    }

                    if (fromLat && fromLng) {
                        getRoadRoute(fromLat, fromLng, selectedRouteData.dropoff.lat, selectedRouteData.dropoff.lng)
                            .then(async route => {
                                setRouteCoords(route.points);
                                // Recalculate price with road distance
                                let newPriceCents = selectedRouteData.priceCents;
                                let newCurrency = '$';

                                // Calculate price: distance_km / 1.3
                                const dist = route.distanceKm; // Use 'dist' for consistency with the new block

                                const calcPrice = async () => {
                                    if (dist > 0) {
                                        // setPricingLoading(true); // Assuming setPricingLoading is defined elsewhere
                                        try {
                                            const priceRes = await SheetService.calculatePricing({
                                                distanceKm: dist,
                                                serviceType: selectedRouteData.serviceType // Use selectedRouteData.serviceType
                                            });

                                            if (priceRes?.success && priceRes?.data) {
                                                const { priceCents, currency } = priceRes.data;
                                                newPriceCents = priceCents; // Update newPriceCents
                                                newCurrency = currency || '$'; // Update newCurrency
                                                // setPricing(priceRes); // Assuming setPricing is defined elsewhere
                                            } else {
                                                // Fallback logic if API fails
                                                newPriceCents = Math.round(dist * 70); // ~$0.70 per km
                                                // setPricing({ success: true, data: { priceCents: newPriceCents, currency: '$' } });
                                            }
                                        } catch {
                                            newPriceCents = Math.round(dist * 70);
                                        } finally {
                                            // setPricingLoading(false);
                                        }
                                    }
                                };
                                await calcPrice();

                                if (selectedRouteData) {
                                    setSelectedRoute({
                                        ...selectedRouteData,
                                        distanceKm: route.distanceKm,
                                        etaMinutes: route.durationMin,
                                        points: route.points,
                                        priceCents: newPriceCents,
                                        currency: newCurrency
                                    });
                                }
                            })
                            .catch(err => {
                                console.log('Road route failed:', err.message);
                            });
                    }
                }
            }
            // Clear params after consuming them to prevent re-application on location updates
            if (route.params?.selectedRoute) {
                navigation.setParams({ selectedRoute: null });
            }

            // Trigger biker search when route comes back from RouteSelection
            if (selectedRouteData.pickupLat && selectedRouteData.pickupLng) {
                triggerBikerSearch({
                    lat: selectedRouteData.pickupLat,
                    lng: selectedRouteData.pickupLng,
                    label: selectedRouteData.from
                });
            } else {
                triggerBikerSearch();
            }

            // Notify bikers about the new order if in local_services mode or courier
            if (selectedRouteData?.serviceType === 'local_services' || selectedRouteData?.serviceType === 'courier') {
                // Broadcast new order to bikers
                if (socketRef.current?.connected) {
                    socketRef.current.emit('new_order', {
                        pickupLat: selectedRouteData.pickupLat,
                        pickupLng: selectedRouteData.pickupLng,
                        pickupAddress: selectedRouteData.from,
                        dropoffLat: selectedRouteData.dropoff?.lat,
                        dropoffLng: selectedRouteData.dropoff?.lng,
                        dropoffAddress: selectedRouteData.to,
                        priceCents: selectedRouteData.priceCents,
                        distanceKm: selectedRouteData.distanceKm,
                        etaMinutes: selectedRouteData.etaMinutes,
                        serviceType: selectedRouteData.serviceType,
                        foodKind: selectedRouteData.foodKind,
                        // Include route points for driver
                        routePoints: routeCoords,
                    });
                }
            }
        }
    }, [route.params?.selectedRoute, location?.latitude, location?.longitude]);

    useEffect(() => {
        const r = route.params?.reorder;
        if (!r || !location?.latitude || !location?.longitude) return;
        if (r.serviceType) setActiveService(r.serviceType);
        selectRecentDestination({ id: 'reorder', name: r.name, lat: r.lat, lng: r.lng });
        if (route.params?.reorder) {
            navigation.setParams({ reorder: null });
        }
    }, [route.params?.reorder, location?.latitude, location?.longitude]);

    const pickupPoint = React.useMemo(() => {
        // Use routePickup if set from route selection
        if (routePickup?.lat && routePickup?.lng) {
            return {
                lat: routePickup.lat,
                lng: routePickup.lng,
                label: routePickup.label || 'Pickup',
            };
        }
        if (activeService === 'local_services' && selectedProvider?.lat && selectedProvider?.lng) {
            return {
                lat: selectedProvider.lat,
                lng: selectedProvider.lng,
                label: selectedProvider.name || 'Pickup',
            };
        }
        return {
            lat: location?.latitude,
            lng: location?.longitude,
            label: pickupAddress,
        };
    }, [activeService, selectedProvider?.lat, selectedProvider?.lng, selectedProvider?.name, location?.latitude, location?.longitude, pickupAddress, routePickup]);

    // Track if we've auto-selected a provider to prevent re-selecting
    const lastProvidersRef = useRef(null);

    // Fetch providers when local_services mode and category changes
    useEffect(() => {
        // Only fetch when in local_services mode with valid location
        if (activeService !== 'local_services') return;
        if (!location?.latitude || !location?.longitude) return;

        let cancelled = false;
        setProvidersLoading(true);

        (async () => {
            try {
                const res = await SheetService.getNearbyProviders({
                    lat: location.latitude,
                    lng: location.longitude,
                    kind: foodKind,
                    radiusM: 20000,
                    limit: 30,
                });
                if (cancelled) return;

                // Only update if we're still in local_services mode
                if (activeService !== 'local_services') return;

                const newProviders = res?.data?.providers || [];
                setProviders(newProviders);
            } catch (e) {
                if (cancelled) return;
                setProviders([]);
            } finally {
                if (!cancelled) setProvidersLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [activeService, foodKind, location?.latitude, location?.longitude]);

    // Handle service changes
    useEffect(() => {
        if (activeService === 'local_services') {
            // Show menu and clear when entering local_services mode
            setSelectedProvider(null);
            setSelectedRoute(null);
            setRouteCoords(null);
            setBikerPos(null);
            setIsTracking(false);
            setBikersFound([]);
            setBikerRoutes([]);
            setSearchError(null);
            setSearchingBikers(false);
            setRoutePickup(null);
            setSelectedProvider(null);
            setFoodMenuVisible(true);
        } else if (activeService === 'courier') {
            // Hide menu when in courier mode
            setFoodMenuVisible(false);
        }
    }, [activeService]);

    const foodKindLabel = (k) => {
        if (k === 'grocery') return 'Grocery';
        if (k === 'pharmacy') return 'Pharmacy';
        if (k === 'boutique') return 'Boutique';
        if (k === 'bar') return 'Bar/Club';
        if (k === 'school') return 'School';
        if (k === 'church') return 'Church';
        if (k === 'salon') return 'Salon/Spa';
        return 'Restaurant';
    };

    // Helper to calculate distance
    const calcDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Get road route from OSRM (direct call, no backend)
    const getRoadRoute = async (fromLat, fromLng, toLat, toLng) => {
        const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
        console.log('OSRM Request:', fromLat, fromLng, '->', toLat, toLng);

        const response = await fetch(url);
        const data = await response.json();
        console.log('OSRM Response:', data.code);

        if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
            const coords = data.routes[0].geometry.coordinates;
            return {
                points: coords.map(c => ({ latitude: c[1], longitude: c[0] })),
                distanceKm: data.routes[0].distance / 1000,
                durationMin: Math.max(1, Math.round(data.routes[0].duration / 60))
            };
        }

        throw new Error('Could not find road route');
    };

    const selectProvider = async (p) => {
        if (!p?.lat || !p?.lng) return;

        // Capture values before state changes
        const currentLocation = location;
        const currentPickupAddress = pickupAddress;

        // Close the dropdown first
        setFoodMenuVisible(false);

        // Set selected provider first
        setSelectedProvider(p);

        // Then switch to courier mode
        setActiveService('courier');

        if (!currentLocation?.latitude || !currentLocation?.longitude) {
            Alert.alert('Error', 'Your location is not available');
            return;
        }

        const dropoff = {
            lat: currentLocation.latitude,
            lng: currentLocation.longitude,
            label: currentPickupAddress
        };

        // Get road route using OSRM
        let roadRoute;
        try {
            roadRoute = await getRoadRoute(p.lat, p.lng, dropoff.lat, dropoff.lng);
        } catch (routeErr) {
            Alert.alert('Error', 'Could not find road route. Please try again.');
            return;
        }
        const dist = roadRoute.distanceKm;
        const durationMin = roadRoute.durationMin;
        const points = roadRoute.points;

        // Get backend pricing
        let priceCents = 100;
        let currency = '$';

        // Calculate price: distance_km / 1.3
        const priceDollars = dist / 1.3;
        priceCents = Math.round(priceDollars * 100);
        const minFareCents = 100;
        priceCents = Math.max(minFareCents, priceCents);

        const routeData = {
            from: p.name,
            to: dropoff.label,
            dropoff: { lat: dropoff.lat, lng: dropoff.lng, label: dropoff.label },
            serviceType: 'courier',
            priceCents: priceCents,
            distanceKm: dist,
            etaMinutes: durationMin,
            currency: currency,
            points: points
        };

        setSelectedRoute(routeData);
        setRouteCoords(points);

        // Immediately search for bikers after provider is selected
        triggerBikerSearch({ lat: p.lat, lng: p.lng, label: p.name });
    };

    const [activeOrder, setActiveOrder] = useState(null);

    const handleCallBiker = () => {
        if (!activeOrder?.biker?.id) {
            Alert.alert('Cannot call', 'Biker information missing.');
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
        CallService.initiateCall(activeOrder.biker.id);
    };

    const handleChatBiker = () => {
        if (!activeOrder) return;
        navigation.navigate('Chat', {
            orderId: activeOrder.id,
            recipientId: activeOrder.biker?.id,
            recipientName: activeOrder.biker?.name || 'Biker',
            recipientRole: 'biker'
        });
    };

    const handleCancelTrip = async () => {
        if (!activeOrder?.id) {
            // If No active order but somehow still tracking/searching
            setActiveOrder(null);
            setIsTracking(false);
            setShowSearching(false);
            return;
        }
        await handleCancelOrder(activeOrder.id);
    };

    const handleConfirmOrder = async (targetBiker = null) => {
        if (!location) {
            Alert.alert('Location Error', 'Location not ready. Please wait a moment.');
            return;
        }
        if (!selectedRoute?.dropoff?.lat || !selectedRoute?.dropoff?.lng) {
            Alert.alert('Missing Destination', 'Please select a destination first.');
            return;
        }
        if (activeService === 'local_services' && !selectedProvider) {
            Alert.alert('Missing Pickup', 'Select a pickup first (tap a place on the map).');
            return;
        }
        try {
            // Set tracking immediately for UI feedback
            setIsTracking(true);

            // If it's a broadcast order (no targetBiker), show searching modal immediately for instant feedback
            if (!targetBiker) {
                setShowSearching(true);
            }

            // 1 & 2. Save draft and prepare socket in parallel
            const [draftRes, socket] = await Promise.all([
                SheetService.upsertDraft({
                    pickupLat: pickupPoint.lat,
                    pickupLng: pickupPoint.lng,
                    pickupAddress: pickupPoint.label,
                    dropoffLat: selectedRoute.dropoff.lat,
                    dropoffLng: selectedRoute.dropoff.lng,
                    dropoffAddress: selectedRoute.dropoff.label || selectedRoute.to,
                    serviceType: activeService,
                    distanceKm: selectedRoute.distanceKm,
                    estimatedPriceCents: editablePrice || selectedRoute.priceCents,
                    etaMinutes: selectedRoute.etaMinutes,
                }),
                socketRef.current?.connected ? socketRef.current : SheetService.connectTrackingSocket()
            ]);

            // Guard: If user cancelled while we were waiting for draft creation
            if (!showSearching && !targetBiker) {
                console.log('[HomeScreen] Order cancelled during draft creation.');
                setIsTracking(false);
                return;
            }

            if (!draftRes?.success) {
                const msg = draftRes?.message || 'Order creation failed (draft)';
                Alert.alert('Order Failed', msg);
                setIsTracking(false);
                setShowSearching(false);
                setSearchingOrderId(null);
                return;
            }

            const draftId = draftRes.data.draftOrder?.id || draftRes.data.id;
            socketRef.current = socket;

            // 3. Confirm and create — pass the target biker if provided
            const res = await SheetService.createOrder({
                paymentMethod: 'cash',
                draftOrderId: draftId,
                preferredBikerId: targetBiker?.id || undefined,
            });

            // Guard: If user cancelled while we were waiting for order creation
            if (!showSearching && !targetBiker) {
                console.log('[HomeScreen] Order cancelled during creation API call.');
                setIsTracking(false);
                return;
            }

            if (!res?.success) {
                const msg = res?.message || 'Order creation failed';
                Alert.alert('Order Failed', msg);
                setIsTracking(false);
                setShowSearching(false);
                setSearchingOrderId(null);
                return;
            }

            const orderId = res.data.orderId || res.data.id;
            const newOrder = {
                id: orderId,
                status: targetBiker ? 'accepted' : 'pending_bids',
                biker: targetBiker,
                pickup: pickupPoint,
                dropoff: selectedRoute.dropoff,
                priceCents: editablePrice || selectedRoute?.priceCents || 0
            };

            // Final Guard before showing the active order card
            if (!targetBiker && !showSearching) {
                 console.log('[HomeScreen] Aborting UI update: User cancelled exactly when order was created.');
                 setIsTracking(false);
                 return;
            }

            setActiveOrder(newOrder);
            setSelectedRoute(null);
            setEditablePrice(null);

            if (socket) {
                socket.emit('subscribe', { orderId });

                // Set up listeners
                socket.off('tracking_update');
                socket.on('tracking_update', (u) => {
                    if (u?.orderId === orderId) setBikerPos({ latitude: u.lat, longitude: u.lng });
                });

                socket.off('order_accepted');
                socket.on('order_accepted', (data) => {
                    if (data?.orderId !== orderId) return;
                    setShowSearching(false);
                    setActiveOrder(prev => prev ? { ...prev, status: 'accepted', biker: data.biker || data.driver } : prev);
                    setBids([]);
                    Alert.alert('Biker Accepted', `${data.biker?.name || 'A biker'} is on the way!`);
                });

                socket.off('new_bid');
                socket.on('new_bid', (data) => {
                    if (data?.orderId !== orderId) return;
                    setBids(prev => {
                        const exists = prev.find(b => b.id === data.bid.id);
                        if (exists) return prev;
                        return [...prev, data.bid];
                    });
                });

                socket.off('order_status_update');
                socket.on('order_status_update', async (data) => {
                    if (data?.orderId !== orderId) return;
                    if (activeOrder?.status === 'cancelled') return;

                    setActiveOrder(prev => prev ? { ...prev, status: data.status } : prev);

                    if (data.status === 'cancelled') {
                        Alert.alert('Trip Cancelled', 'Your trip has been cancelled.');
                        setActiveOrder(null);
                        setSelectedRoute(null);
                        setIsTracking(false);
                    } else if (data.status === 'completed') {
                        if (user?.role === 'customer') {
                            const completedBiker = data.biker || data.driver || {};
                            const completedOrderId = data.orderId;
                            await AppSecurity.setPendingRating(
                                completedOrderId,
                                completedBiker.id,
                                completedBiker.name || 'Your Biker'
                            );
                            navigation.navigate('Rating', {
                                bikerId: completedBiker.id,
                                bikerName: completedBiker.name || 'Your Biker',
                                bikerPhoto: completedBiker.photo || null,
                                orderId: completedOrderId,
                            });
                        }
                        setActiveOrder(null);
                        setSelectedRoute(null);
                        setIsTracking(false);
                    }
                });
            }

            if (!targetBiker) {
                setSearchingOrderId(orderId);
            }
        } finally {
            if (!activeOrder?.id && !showSearching) {
                setIsTracking(false);
            }
        }
    };

    const triggerBikerSearch = async (customLocation = null) => {
        const searchLocation = customLocation || pickupPoint;
        if (!searchLocation?.lat || !searchLocation?.lng) return;
        setSearchingBikers(true);
        setBikersFound([]);
        setSearchError(null);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        // Auto-scroll to bikers section when searching starts
        setTimeout(() => {
            scrollViewRef.current?.scrollTo({ y: 300, animated: true });
        }, 100);
        try {
            // prefer new API if it exists
            let found = [];
            if (SheetService.getNearbyBikers) {
                const res = await SheetService.getNearbyBikers({
                    lat: searchLocation.lat,
                    lng: searchLocation.lng,
                    radiusKm: 5,
                });
                // res may be {count, bikers:[{latitude,longitude,...}]}
                found = res?.bikers || res?.data?.drivers || res?.data?.nearbyDrivers || [];
            } else {
                const res = await SheetService.getDriversNearby({
                    lat: searchLocation.lat,
                    lng: searchLocation.lng,
                    radiusKm: 20,
                    serviceType: activeService
                });
                found = res?.data?.drivers || res?.data?.nearbyDrivers || drivers || [];
            }

            // Calculate ETA for each biker (assuming avg speed 20km/h)
            found = found.map(biker => ({
                ...biker,
                etaToPickupMinutes: biker.distanceKm ? Math.ceil(biker.distanceKm / 20 * 60) : null,
            }));

            // Sort by distance/ETA
            found.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));

            setBikersFound(found);

            // Scroll to bikers when found
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 300, animated: true });
            }, 300);

            // Fetch routes from each biker to pickup - use searchLocation (passed location)
            if (found.length > 0 && searchLocation?.lat && searchLocation?.lng) {
                const routesPromises = found.slice(0, 5).map(async (biker) => {
                    try {
                        const bikerLat = biker.coords?.lat || biker.lat;
                        const bikerLng = biker.coords?.lng || biker.lng;
                        if (!bikerLat || !bikerLng) return null;

                        const directions = await SheetService.getDirections({
                            origin: `${bikerLat},${bikerLng}`,
                            destination: `${searchLocation.lat},${searchLocation.lng}`,
                            serviceType: 'bike'
                        });

                        const bestRoute = directions?.routes?.[0];
                        if (bestRoute?.points) {
                            return {
                                bikerId: biker.id,
                                points: bestRoute.points
                            };
                        }
                    } catch (e) {
                        // Ignore route errors
                    }
                    return null;
                });

                const routes = await Promise.all(routesPromises);
                setBikerRoutes(routes.filter(Boolean));
            }

            if (found.length === 0) {
                setSearchError('No bikers found nearby. Expanding search...');
                searchTimerRef.current = setTimeout(async () => {
                    try {
                        if (!pickupPoint?.lat || !pickupPoint?.lng) {
                            setSearchingBikers(false);
                            return;
                        }
                        let found2 = [];
                        if (SheetService.getNearbyBikers) {
                            const res2 = await SheetService.getNearbyBikers({
                                lat: pickupPoint.lat,
                                lng: pickupPoint.lng,
                                radiusKm: 15,
                            });
                            found2 = res2?.bikers || res2?.data?.drivers || res2?.data?.nearbyDrivers || [];
                        } else {
                            const res2 = await SheetService.getDriversNearby({
                                lat: pickupPoint.lat,
                                lng: pickupPoint.lng,
                                radiusKm: 15,
                            });
                            found2 = res2?.data?.drivers || res2?.data?.nearbyDrivers || [];
                        }

                        // Calculate ETA for expanded search
                        found2 = found2.map(biker => ({
                            ...biker,
                            etaToPickupMinutes: biker.distanceKm ? Math.ceil(biker.distanceKm / 20 * 60) : null,
                        }));
                        found2.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));

                        setBikersFound(found2);
                        setSearchError(found2.length === 0 ? 'No bikers available right now. Please try again.' : null);
                    } catch { }
                    setSearchingBikers(false);
                }, 5000);
            } else {
                setSearchingBikers(false);
            }
        } catch {
            setBikersFound([]);
            setSearchError('Could not search for bikers. Check your connection.');
            setSearchingBikers(false);
        }
    };

    // -------------------------------------------------------------
    // Helpers for pinned map location (used when user taps the map)
    // -------------------------------------------------------------
    const reverseGeocodeLocation = async (lat, lng) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
                headers: { 'User-Agent': 'BikerApp/1.0' }
            });
            const data = await res.json();
            if (data.display_name) {
                const addr = data.address || {};
                const parts = [
                    addr.house_number,
                    addr.road || addr.street,
                    addr.suburb || addr.neighbourhood,
                    addr.city || addr.town || addr.village,
                ].filter(Boolean);
                return {
                    short: parts.slice(0, 3).join(', ') || data.name || 'Pinned Location',
                    full: data.display_name
                };
            }
        } catch (e) {
            console.log('Reverse geocode error:', e.message);
        }
        return null;
    };

    const updateRouteWithPinnedLocation = async (lat, lng) => {
        const addressData = await reverseGeocodeLocation(lat, lng);
        const label = addressData?.short || 'Pinned Location';
        const fullLabel = addressData?.full || 'Location selected on map';

        if (!location?.latitude || !location?.longitude) return;

        const pickupLat =
            activeService === 'local_services' && selectedProvider?.lat
                ? selectedProvider.lat
                : location.latitude;
        const pickupLng =
            activeService === 'local_services' && selectedProvider?.lng
                ? selectedProvider.lng
                : location.longitude;
        const pickupLabel =
            activeService === 'local_services' && selectedProvider?.name
                ? selectedProvider.name
                : pickupAddress;

        try {
            let roadRoute;
            try {
                roadRoute = await getRoadRoute(pickupLat, pickupLng, lat, lng);
            } catch (routeErr) {
                Alert.alert('Error', 'Could not find road route. Please try again.');
                return;
            }
            const dist = roadRoute.distanceKm;

            const priceDollars = dist / 1.3;
            const priceCents = Math.round(priceDollars * 100);
            const minFareCents = 100;
            const finalPriceCents = Math.max(minFareCents, priceCents);

            const draftRes = await SheetService.upsertDraft({
                pickupLat,
                pickupLng,
                pickupAddress: pickupLabel,
                dropoffLat: lat,
                dropoffLng: lng,
                dropoffAddress: label,
                serviceType: activeService,
                estimatedPriceCents: finalPriceCents,
                distanceKm: dist,
                etaMinutes: roadRoute.durationMin,
            });
            if (draftRes?.success === false) {
                console.log('[HomeScreen] pinned location draft save queued for retry:', draftRes.message);
            }

            const routeData = {
                from: pickupLabel,
                to: label,
                dropoff: { lat, lng, label },
                serviceType: activeService,
                priceCents: finalPriceCents,
                distanceKm: dist,
                etaMinutes: roadRoute.durationMin,
                currency: '$',
                points: roadRoute.points,
            };

            setSelectedRoute(routeData);
            setRouteCoords(roadRoute.points);

            if (socketRef.current?.connected) {
                socketRef.current.emit('new_order', {
                    pickupLat,
                    pickupLng,
                    pickupAddress: pickupLabel,
                    dropoffLat: lat,
                    dropoffLng: lng,
                    dropoffAddress: label,
                    priceCents: finalPriceCents,
                    distanceKm: dist,
                    etaMinutes: roadRoute.durationMin,
                    serviceType: activeService,
                    foodKind: foodKind,
                    routePoints: roadRoute.points,
                });
            }

            triggerBikerSearch(pickupPoint);
        } catch (e) {
            console.error('Error updating route with pinned location:', e);
            Alert.alert('Error', 'Could not update route. Please try again.');
        }
    };

    useEffect(() => {
        HomeScreen.updateRouteWithPinnedLocation = updateRouteWithPinnedLocation;
    }, [updateRouteWithPinnedLocation]);

    const handleServiceSelect = async (svcId) => {
        const oldSvc = activeService;
        if (svcId === oldSvc) return;

        // For Bike - search for available bikes on map
        if (svcId === 'bike') {
            setActiveService(svcId);
            setSelectedRoute(null);
            setRouteCoords(null);
            setBikerPos(null);
            setIsTracking(false);
            setBikersFound([]);
            setBikerRoutes([]);
            setSearchError(null);
            setSearchingBikers(false);
            setRoutePickup(null);
            setSelectedProvider(null);
            setSelectedBiker(null);
            if (route.params?.selectedRoute || route.params?.reorder) {
                navigation.setParams({ selectedRoute: null, reorder: null });
            }
            // Start searching for available bikes
            triggerBikerSearch();
            return;
        }

        // For local_services - show menu to select category
        if (svcId === 'local_services') {
            setActiveService(svcId);
            setSelectedRoute(null);
            setRouteCoords(null);
            setBikerPos(null);
            setIsTracking(false);
            setBikersFound([]);
            setBikerRoutes([]);
            setSearchError(null);
            setSearchingBikers(false);
            setRoutePickup(null);
            setSelectedProvider(null);
            setSelectedBiker(null);
            setFoodMenuVisible(true);
            return;
        }

        // For Send a package - navigate to route selection
        setActiveService(svcId);
        setSelectedRoute(null);
        setRouteCoords(null);
        setBikerPos(null);
        setIsTracking(false);
        setBikerRoutes([]);
        setBikersFound([]);
        setSearchError(null);
        setSearchingBikers(false);
        setRoutePickup(null);
        setSelectedProvider(null);
        setSelectedBiker(null);
        setFoodMenuVisible(false);
        if (route.params?.selectedRoute || route.params?.reorder) {
            navigation.setParams({ selectedRoute: null, reorder: null });
        }

        // Navigate to route selection
        navigation.navigate('RouteSelection', {
            pickup: pickupPoint ? { lat: pickupPoint.lat, lng: pickupPoint.lng, label: pickupPoint.label } : null,
            serviceType: svcId,
            fromLabel: pickupPoint?.label || pickupAddress || 'Current Location',
            isFoodMode: false,
        });

        // attempt to persist service selection as a draft; failure is non‑fatal
        const svcDraft = await SheetService.upsertDraft({ serviceType: svcId });
        if (svcDraft?.success === false) {
            console.log('[HomeScreen] service-type draft failed:', svcDraft.message);
        }
    };

    const selectRecentDestination = async (place) => {
        if (!place?.lat || !place?.lng) return;
        if (activeService === 'local_services' && !selectedProvider) {
            alert('Select a pickup first (tap a place on the map).');
            return;
        }
        if (!pickupPoint?.lat || !pickupPoint?.lng) return;
        try {
            // Get road route from OSRM
            let roadRoute;
            try {
                roadRoute = await getRoadRoute(
                    pickupPoint.lat, pickupPoint.lng,
                    place.lat, place.lng
                );
            } catch (routeErr) {
                Alert.alert('Error', 'Could not find road route. Please try again.');
                return;
            }

            const dist = roadRoute.distanceKm;

            // Calculate price
            const priceRes = await SheetService.calculatePricing({
                distanceKm: dist,
                serviceType: activeService
            });
            const finalPriceCents = priceRes?.success && priceRes?.data?.priceCents ? priceRes.data.priceCents : Math.max(100, Math.round(dist * 70));
            const finalCurrency = priceRes?.data?.currency || '$';

            const draftRes = await SheetService.upsertDraft({
                pickupLat: pickupPoint.lat,
                pickupLng: pickupPoint.lng,
                pickupAddress: pickupPoint.label,
                dropoffLat: place.lat,
                dropoffLng: place.lng,
                dropoffAddress: place.name,
                serviceType: activeService,
                estimatedPriceCents: finalPriceCents,
                distanceKm: dist,
                etaMinutes: roadRoute.durationMin || 10,
            });
            if (draftRes?.success === false) {
                console.warn('[HomeScreen] recent-destination draft failed:', draftRes.message);
            }

            const routeData = {
                from: pickupPoint.label,
                to: place.name,
                dropoff: { lat: place.lat, lng: place.lng, label: place.name },
                serviceType: activeService,
                priceCents: finalPriceCents,
                distanceKm: dist,
                etaMinutes: roadRoute.durationMin,
                currency: finalCurrency,
                points: roadRoute.points
            };
            setSelectedRoute(routeData);
            setRouteCoords(roadRoute.points);
            triggerBikerSearch(pickupPoint);
        } catch (e) {
            alert(e?.message || 'Failed to load estimate');
        }
    };

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                const sa = SheetService.currentUser?.serviceArea;
                if (sa?.lat != null && sa?.lng != null) {
                    const coords = {
                        latitude: Number(sa.lat),
                        longitude: Number(sa.lng),
                        latitudeDelta: 0.06,
                        longitudeDelta: 0.06,
                    };
                    setLocation(coords);
                    const label =
                        [SheetService.currentUser?.city, SheetService.currentUser?.country]
                            .filter(Boolean)
                            .join(', ') ||
                        'Saved area';
                    setPickupAddress(label);
                    return;
                }

                alert('Permission to access location was denied');
                return;
            }

            let currentLocation = await Location.getCurrentPositionAsync({});
            const coords = {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.0122,
                longitudeDelta: 0.0121,
            };
            setLocation(coords);

            let formattedAddress = 'Current Location';
            try {
                const [address] = await Location.reverseGeocodeAsync({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                });
                if (address) {
                    formattedAddress = address.street
                        ? `${address.street}${address.subregion ? ', ' + address.subregion : ''}`
                        : `${address.city || 'Unknown'}, ${address.region || ''}`;
                    setPickupAddress(formattedAddress);
                }
            } catch (error) {
                setPickupAddress('Current Location');
            }

            try {
                const draftRes = await SheetService.upsertDraft({
                    pickupLat: coords.latitude,
                    pickupLng: coords.longitude,
                    pickupAddress: formattedAddress,
                    serviceType: activeService,
                });
                if (draftRes?.success === false) {
                    console.log('[HomeScreen] location draft queued for retry:', draftRes.message);
                }
                const draftId = draftRes?.data?.draftOrder?.id;
                if (draftId) setDraftOrderId(draftId);
            } catch {
                // ignore – this will rarely happen since upsertDraft no longer throws
            }
        })();
    }, []);

    const services = [
        { id: 'bike', label: 'Biker', icon: 'motorbike' },
        { id: 'courier', label: 'Send a package', icon: 'package-variant-closed' },
        { id: 'local_services', label: 'Local services', icon: 'store' },
    ];

    const getServiceLabel = (id) => services.find((s) => s.id === id)?.label || id;

    const recentPlaces = (dashboard?.recentDestinations || []).map((p) => ({
        id: String(p.id),
        name: p.label,
        city: p.address || '',
        lat: p.lat,
        lng: p.lng,
    }));

    const handleCenterMap = () => {
        if (location && mapRef.current) {
            mapRef.current.animateToRegion(location, 1000);
        }
    };

    const handleFitToRoute = () => {
        if (!routeCoords || routeCoords.length < 2 || !mapRef.current) return;

        // Build proper coordinate array for fitToCoordinates
        const coords = routeCoords.map(coord => ({
            latitude: coord.latitude,
            longitude: coord.longitude
        }));

        if (coords.length < 2) return;

        mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 150, right: 50, bottom: 400, left: 50 },
            animated: true,
        });
    };

    const handleBackToLiveLocation = () => {
        if (location && mapRef.current) {
            mapRef.current.animateToRegion(location, 500);
            setMapFocused(false);
        }
    };

    useEffect(() => {
        if (routeCoords && routeCoords.length >= 2) {
            setMapFocused(false);
            // Delay slightly to ensure map is ready
            const timer = setTimeout(() => {
                handleFitToRoute();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [routeCoords]);


    const handleCancelOrder = async (orderId) => {
        if (!orderId) return;

        // 1. Wipe state IMMEDIATELY for instant UI feedback and to prevent race conditions
        console.log(`[HomeScreen] Cancelling order ${orderId} locally...`);
        setShowSearching(false);
        setSearchingOrderId(null);
        setActiveOrder(null);
        setIsTracking(false);
        setBids([]);

        try {
            const res = await SheetService.cancelOrder(orderId);
            if (res.success) {
                console.log('[HomeScreen] Order cancelled on server.');
            } else {
                Alert.alert('Error', res?.message || 'Failed to cancel order.');
            }
        } catch (error) {
            console.error('[HomeScreen] Cancel Error:', error);
            Alert.alert('Error', 'Network error or server failed to respond.');
        } finally {
            // Safety fallback: always hide search modal if attempt was made
            setShowSearching(false);
            setIsTracking(false);
        }
    };

    const handleAcceptBid = async (bidId) => {
        if (!activeOrder?.id) return;
        try {
            const res = await SheetService.acceptBid(activeOrder.id, bidId);
            if (res?.success) {
                setActiveOrder(prev => ({ ...prev, status: 'accepted', biker: res.data.biker }));
                setBids([]);
                Alert.alert('Bid Accepted', 'Biker is on the way!');
            } else {
                Alert.alert('Error', res?.message || 'Failed to accept bid.');
            }
        } catch (error) {
            Alert.alert('Error', 'Network error or server failed to respond.');
        }
    };

    return (
        <View style={styles.container}>

            <StatusBar barStyle="light-content" />
            {/* Pinning Mode Overlay */}
            {pinningMode && (
                <View style={styles.pinningOverlay}>
                    <Text style={styles.pinningOverlayText}>Tap on the map to select destination</Text>
                </View>
            )}

            {/* Map Background - full screen */}
            {!location && (
                <View style={[styles.loadingContainer, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            )}
            {location && (
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={location}
                    customMapStyle={mapStyle}
                    showsUserLocation={true}
                    showsBuildings={true}
                    showsIndoors={true}
                    showsTraffic={true}
                    showsPointsOfInterest={true}
                    userInterfaceStyle="dark"
                    onRegionChangeComplete={(region) => {
                        if (location) {
                            const latDiff = Math.abs(region.latitude - location.latitude);
                            const lngDiff = Math.abs(region.longitude - location.longitude);
                            if (latDiff > 0.001 || lngDiff > 0.001) {
                                setMapFocused(true);
                            }
                        }
                    }}
                    onLongPress={(e) => {
                        console.log('Long press detected');
                        const { latitude, longitude } = e.nativeEvent.coordinate;
                        navigation.navigate('RouteSelection', {
                            pickup: pickupPoint ? { lat: pickupPoint.lat, lng: pickupPoint.lng, label: pickupPoint.label } : null,
                            serviceType: 'courier',
                            fromLabel: pickupPoint?.label || pickupAddress || 'Current Location',
                            initialQuery: '',
                            selectedCoords: { lat: latitude, lng: longitude },
                            isFoodMode: false
                        });
                    }}
                    onPoiClick={(e) => {
                        // Click on a place/POI - navigate to route selection
                        const { latitude, longitude } = e.nativeEvent.coordinate;
                        const name = e.nativeEvent.name || 'Selected Location';
                        navigation.navigate('RouteSelection', {
                            pickup: pickupPoint ? { lat: pickupPoint.lat, lng: pickupPoint.lng, label: pickupPoint.label } : null,
                            serviceType: 'courier',
                            fromLabel: pickupPoint?.label || pickupAddress || 'Current Location',
                            initialQuery: name,
                            selectedCoords: { lat: latitude, lng: longitude },
                            isFoodMode: false
                        });
                    }}
                    onPress={(e) => {
                        if (pinningMode) {
                            const { latitude, longitude } = e.nativeEvent.coordinate;
                            setPinningMode(false);
                            // Navigate to route selection with selected coordinates
                            navigation.navigate('RouteSelection', {
                                pickup: pickupPoint ? { lat: pickupPoint.lat, lng: pickupPoint.lng, label: pickupPoint.label } : null,
                                serviceType: 'courier',
                                fromLabel: pickupPoint?.label || pickupAddress || 'Current Location',
                                initialQuery: '',
                                selectedCoords: { lat: latitude, lng: longitude },
                                isFoodMode: false
                            });
                        } else {
                            // Single tap returns to live location
                            handleBackToLiveLocation();
                        }
                    }}
                    onMarkerPress={(e) => {
                        console.log('Marker pressed');
                    }}
                >
                    {/* Ambient Places */}
                    {!selectedRoute && !selectedProvider && (ambientPlaces || []).map(p => {
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
                                {/* Marker Icon */}
                                <Surface style={{ padding: 6, backgroundColor: 'rgba(26,26,26,0.9)', borderRadius: 25, borderWidth: 1, borderColor: '#333' }} elevation={2}>
                                    <IconButton
                                        icon={bi(p.kind === 'pharmacy' ? 'medical-bag' : p.kind === 'grocery' ? 'cart' : p.kind === 'school' ? 'school' : 'silverware-fork-knife')}
                                        size={16}
                                        iconColor={p.kind === 'pharmacy' ? '#E74C3C' : p.kind === 'school' ? '#3498DB' : '#A8E05F'}
                                        style={{ margin: 0 }}
                                    />
                                </Surface>
                            </Marker>
                        );
                    })}
                    {routeCoords && routeCoords.length >= 2 && (
                        <>
                            {/* Alternative route 1 - for biker access */}
                            <Polyline
                                coordinates={routeCoords}
                                strokeWidth={6}
                                strokeColor="rgba(255, 165, 0, 0.2)"
                                lineCap="round"
                                lineJoin="round"
                            />
                            {/* Alternative route 2 */}
                            <Polyline
                                coordinates={routeCoords}
                                strokeWidth={4}
                                strokeColor="rgba(255, 200, 0, 0.25)"
                                lineCap="round"
                                lineJoin="round"
                            />
                            {/* Main route shadow/glow */}
                            <Polyline
                                coordinates={routeCoords}
                                strokeWidth={3}
                                strokeColor="rgba(0, 212, 255, 0.3)"
                            />
                            {/* Main route */}
                            <Polyline
                                coordinates={routeCoords}
                                strokeWidth={3}
                                strokeColor="#00FD3F"
                                lineCap="round"
                                lineJoin="round"
                            />

                            {/* Biker routes - small dashed lines showing available roads to pickup */}
                            {bikerRoutes.map((bikerRoute, index) => (
                                <Polyline
                                    key={`biker-route-${bikerRoute.bikerId || index}`}
                                    coordinates={bikerRoute.points}
                                    strokeWidth={1}
                                    strokeColor="rgba(168, 224, 95, 0.5)"
                                    lineDashPattern={[8, 4]}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                            ))}
                        </>
                    )}

                    {/* Pickup Marker */}
                    {pickupPoint?.lat && pickupPoint?.lng && (
                        <Marker
                            coordinate={{ latitude: pickupPoint.lat, longitude: pickupPoint.lng }}
                            title="Pickup"
                            description={pickupPoint.label}
                        >
                            <View style={styles.pickupMarker}>
                                <View style={styles.pickupMarkerInner}>
                                    <Avatar.Icon size={24} icon={bi('map-marker')} backgroundColor="#00d4ff" color="#000" />
                                </View>
                                <View style={styles.pickupMarkerPulse} />
                            </View>
                        </Marker>
                    )}

                    {/* Destination Marker */}
                    {selectedRoute?.dropoff?.lat && selectedRoute?.dropoff?.lng && (
                        <Marker
                            coordinate={{ latitude: selectedRoute.dropoff.lat, longitude: selectedRoute.dropoff.lng }}
                            title="Destination"
                            description={selectedRoute.dropoff.label}
                        >
                            <View style={styles.dropoffMarker}>
                                <View style={styles.dropoffMarkerInner}>
                                    <Avatar.Icon size={24} icon={bi('flag')} backgroundColor="#ff6b6b" color="#fff" />
                                </View>
                                <View style={styles.dropoffMarkerPulse} />
                            </View>
                        </Marker>
                    )}

                    {(() => {
                        if (!bikerPos) return null;
                        const lat = Number(bikerPos.latitude || bikerPos.lat);
                        const lng = Number(bikerPos.longitude || bikerPos.lng);
                        if (isNaN(lat) || isNaN(lng)) return null;
                        return (
                            <Marker
                                coordinate={{ latitude: lat, longitude: lng }}
                                title="Your Biker"
                            >
                                <Avatar.Icon size={40} icon={bi('motorbike')} backgroundColor="#000" color="#A8E05F" />
                            </Marker>
                        );
                    })()}

                    {drivers.filter(d => d?.coords?.lat && d?.coords?.lng).map((driver) => {
                        const isSelected = selectedBiker?.id === driver.id;
                        return (
                            <Marker
                                key={String(driver.id)}
                                coordinate={{
                                    latitude: Number(driver.coords.lat),
                                    longitude: Number(driver.coords.lng),
                                }}
                                onPress={() => setSelectedBiker(driver)}
                            >
                                <View style={styles.modernBikerMarker}>
                                    <View style={[styles.markerBlackCircle, isSelected && { borderColor: '#A8E05F', transform: [{ scale: 1.2 }] }]}>
                                        <IconButton icon={bi('motorbike')} size={18} iconColor={isSelected ? '#A8E05F' : '#00FD3F'} />
                                        <View style={[styles.markerCenterDot, isSelected && { backgroundColor: '#A8E05F' }]} />
                                    </View>
                                </View>
                            </Marker>
                        );
                    })}

                    {activeService === 'local_services' && (providers || []).filter((p) => p?.lat && p?.lng).map((p) => (
                        <Marker
                            key={String(p.id)}
                            coordinate={{ latitude: p.lat, longitude: p.lng }}
                            title={p.name}
                            description={p.address || undefined}
                            onPress={() => selectProvider(p)}
                        >
                            <View style={[styles.providerMarker, selectedProvider?.id === p.id && styles.providerMarkerActive]}>
                                <Avatar.Icon
                                    size={28}
                                    icon={bi(foodKind === 'pharmacy' ? 'medical-bag' : foodKind === 'grocery' ? 'cart' : foodKind === 'boutique' ? 'tshirt-crew' : foodKind === 'bar' ? 'glass-cocktail' : foodKind === 'school' ? 'school' : foodKind === 'church' ? 'church' : foodKind === 'salon' ? 'content-cut' : 'silverware-fork-knife')}
                                    backgroundColor={selectedProvider?.id === p.id ? '#3277FF' : '#111'}
                                    color={selectedProvider?.id === p.id ? '#000' : '#3277FF'}
                                />
                            </View>
                        </Marker>
                    ))}
                </MapView>)}

            {/* Header / Top Bar Redesigned */}
            <View style={styles.premiumHeader}>
                <LinearGradient
                    colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.headerContent}>
                    <View style={styles.greetingSection}>
                        <TouchableOpacity style={styles.profileButtonNav} onPress={() => navigation.navigate('ProfileSettings')}>
                            {user?.photo ? (
                                <Avatar.Image size={40} source={{ uri: user.photo }} style={{ backgroundColor: 'transparent' }} />
                            ) : (
                                <Avatar.Icon size={40} icon={bi('account')} style={{ backgroundColor: 'transparent' }} color="#FFF" />
                            )}
                        </TouchableOpacity>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={styles.greetingText}>
                                {new Date().getHours() < 12 ? 'Good Morning,' : new Date().getHours() < 18 ? 'Good Afternoon,' : 'Good Evening,'}
                            </Text>
                            <Text style={styles.userNameText}>{user?.name?.split(' ')[0] || 'Guest'}!</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.notificationBell} onPress={() => navigation.navigate('Notifications')}>
                        <IconButton icon={bi('bell-outline')} size={24} iconColor="#FFF" />
                        {unreadNotifications > 0 && <View style={styles.redDot} />}
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── inDrive-Style Floating Search Bar (single, no Surface overflow) ── */}
            <View style={styles.searchBarWrapper} pointerEvents="box-none">
                <View style={[
                    styles.searchBarSurface,
                    searchFocused && styles.searchBarSurfaceFocused
                ]}>
                    <View style={styles.searchBarRow}>
                        <IconButton
                            icon={bi('menu')}
                            size={24}
                            iconColor="#FFF"
                            style={{ marginLeft: 8 }}
                            onPress={() => navigation.openDrawer()}
                        />
                        <TextInput
                            ref={searchInputRef}
                            style={styles.searchInput}
                            placeholder="Where to go?"
                            placeholderTextColor="rgba(255,255,255,0.6)"
                            value={searchQuery}
                            onChangeText={handleSearchInput}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                            returnKeyType="search"
                        />
                        <IconButton
                            icon={bi('mic')}
                            size={24}
                            iconColor="#FFF"
                            style={{ marginRight: 8 }}
                        />
                    </View>

                    {/* Suggestions Dropdown */}
                    {searchFocused && searchSuggestions.length > 0 && (
                        <View style={styles.suggestionsContainer}>
                            <FlatList
                                data={searchSuggestions}
                                keyExtractor={(item, i) => `${item.placeId}_${i}`}
                                keyboardShouldPersistTaps="handled"
                                ItemSeparatorComponent={() => <View style={styles.suggestionsSeparator} />}
                                renderItem={({ item, index }) => (
                                    <TouchableOpacity
                                        style={styles.suggestionItem}
                                        onPress={() => handleSuggestionSelect(item)}
                                        activeOpacity={0.75}
                                    >
                                        <View style={styles.suggestionIcon}>
                                            <IconButton
                                                icon={bi(index === 0 ? 'map-marker' : 'map-marker-outline')}
                                                size={18}
                                                iconColor={index === 0 ? '#3277FF' : '#7F8C8D'}
                                                style={{ margin: 0 }}
                                            />
                                        </View>
                                        <View style={styles.suggestionText}>
                                            <Text style={styles.suggestionPrimary} numberOfLines={1}>
                                                {item.label.split(',')[0]}
                                            </Text>
                                            <Text style={styles.suggestionSecondary} numberOfLines={1}>
                                                {item.label.split(',').slice(1).join(',').trim()}
                                            </Text>
                                        </View>
                                        <IconButton icon={bi('arrow-top-left')} size={14} iconColor="#555" style={{ margin: 0 }} />
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    )}
                </View>
                
                {/* Horizontal Category Chips (Reference Image 1 Right) */}
                {!searchFocused && (
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        style={styles.chipsScroll}
                        contentContainerStyle={styles.chipsContent}
                    >
                        <TouchableOpacity style={styles.chipItem}>
                            <IconButton icon={bi('plus-circle')} size={16} iconColor="#000" style={styles.chipIcon} />
                            <Text style={styles.chipText}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.chipItem}>
                            <IconButton icon={bi('cart')} size={16} iconColor="#000" style={styles.chipIcon} />
                            <Text style={styles.chipText}>Grocery Store</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.chipItem}>
                            <IconButton icon={bi('gas-station')} size={16} iconColor="#000" style={styles.chipIcon} />
                            <Text style={styles.chipText}>Petrol Pump</Text>
                        </TouchableOpacity>
                    </ScrollView>
                )}
            </View>



            {/* Zoom/Center Button */}
            <TouchableOpacity style={styles.centerButton} onPress={handleCenterMap}>
                <IconButton icon={bi('navigation-variant')} size={24} iconColor="#FFFFFF" />
            </TouchableOpacity>

            {/* Select Location Button */}
            <TouchableOpacity
                style={styles.selectLocationButton}
                onPress={() => navigation.navigate('RouteSelection', {
                    pickup: pickupPoint ? { lat: pickupPoint.lat, lng: pickupPoint.lng, label: pickupPoint.label } : null,
                    serviceType: 'courier',
                    fromLabel: pickupPoint?.label || pickupAddress || 'Current Location'
                })}
            >
                <IconButton icon={bi('map-marker-plus')} size={22} iconColor="#FFFFFF" />
            </TouchableOpacity>

            {/* Fit to Route Button - appears when route is selected */}
            {selectedRoute && (
                <TouchableOpacity style={styles.fitRouteButton} onPress={handleFitToRoute}>
                    <IconButton icon={bi('arrow-expand-all')} size={22} iconColor="#FFFFFF" />
                    <Text style={styles.fitRouteText}>Fit Route</Text>
                </TouchableOpacity>
            )}



            {/* Bottom Panel – anchored at bottom, expands up to fit content only */}
            <View style={styles.bottomPanel}>
                <Surface style={[styles.bottomPanelSurface, { backgroundColor: theme.colors.surface }]} elevation={4}>
                    <ScrollView
                        ref={scrollViewRef}
                        style={{ flexShrink: 1, maxHeight: height * 0.5 }}
                        contentContainerStyle={styles.panelContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                        alwaysBounceVertical={false}
                    >
                        <View style={styles.handle} />

                        {/* Active Order Card */}
                        {activeOrder && (
                            <BlurView intensity={80} tint="dark" style={styles.activeOrderCardStraight}>
                                <View style={styles.activeOrderHeader}>
                                    <View>
                                        <View style={styles.statusPillFancy}>
                                            <View style={[styles.statusPulse, { backgroundColor: activeOrder.status === 'pending' || activeOrder.status === 'pending_bids' ? '#F1C40F' : '#00FD3F' }]} />
                                            <Text style={styles.statusPillTextFancy}>
                                                {activeOrder.status === 'pending' ? 'WAITING FOR BIKER' :
                                                    activeOrder.status === 'pending_bids' ? 'RECEIVING OFFERS' :
                                                    activeOrder.status === 'accepted' ? 'BIKER ASSIGNED' :
                                                    activeOrder.status === 'picked_up' ? 'IN TRANSIT' : 'ACTIVE TRIP'}
                                            </Text>
                                        </View>
                                        <Text style={styles.activeOrderBikerName}>
                                            {activeOrder.biker?.name || (activeOrder.status === 'pending_bids' ? 'Gathering offers...' : 'Searching for Biker...')}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.activeOrderPrice}>
                                            ${((activeOrder.priceCents || 0) / 100).toFixed(2)}
                                        </Text>
                                        <Text style={styles.priceLabelSmall}>TOTAL</Text>
                                    </View>
                                </View>

                                <View style={styles.straightRouteBox}>
                                    <View style={[styles.routePointStraight, { marginBottom: 12 }]}>
                                        <View style={styles.pickupDotFancy} />
                                        <Text style={styles.routeValueStraight} numberOfLines={1}>{activeOrder.pickup?.address || activeOrder.pickupAddress || 'Pickup'}</Text>
                                    </View>
                                    <View style={styles.routePointStraight}>
                                        <View style={styles.dropoffSquareFancy} />
                                        <Text style={styles.routeValueStraight} numberOfLines={1}>{activeOrder.dropoff?.label || activeOrder.dropoff?.address || 'Destination'}</Text>
                                    </View>
                                </View>

                                <View style={styles.straightActionRow}>
                                    <TouchableOpacity style={[styles.iconCircleBtn, { backgroundColor: 'rgba(50, 119, 255, 0.1)' }]} onPress={handleCallBiker}>
                                        <IconButton icon={bi('phone')} size={24} iconColor="#3277FF" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.iconCircleBtn, { backgroundColor: 'rgba(90, 200, 250, 0.1)' }]} onPress={handleChatBiker}>
                                        <IconButton icon={bi('chat')} size={24} iconColor="#5AC8FA" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.iconCircleBtn, { backgroundColor: 'rgba(231, 76, 60, 0.1)' }]} onPress={() => {
                                        Alert.alert('Cancel Trip', 'Are you sure?', [
                                            { text: 'No' },
                                            { text: 'Yes', onPress: handleCancelTrip }
                                        ]);
                                    }}>
                                        <IconButton icon={bi('close')} size={24} iconColor="#E74C3C" />
                                    </TouchableOpacity>
                                </View>

                                <Button
                                    mode="contained"
                                    buttonColor="#3277FF"
                                    textColor="#000"
                                    style={[styles.mainStatusBtn, { marginTop: 12 }]}
                                    labelStyle={{ fontWeight: '900', fontSize: 13, textTransform: 'uppercase' }}
                                >
                                    {activeOrder.status === 'pending' ? 'Awaiting Pickup' : 'Tracking Live'}
                                </Button>
                            </BlurView>
                        )}

                        {!activeOrder && (
                            <>
                                {(/ * redundant stats removed * /) && null}


                                {/* Service Categories Redesigned */}
                                <View style={styles.serviceRowPremium}>
                                    {services.map((service) => (
                                        <TouchableOpacity
                                            key={service.id}
                                            style={styles.serviceItemPremium}
                                            onPress={() => handleServiceSelect(service.id)}
                                        >
                                            <View style={[
                                                styles.serviceIconFrame,
                                                activeService === service.id && styles.activeServiceFrame
                                            ]}>
                                                <IconButton
                                                    icon={bi(service.icon)}
                                                    size={28}
                                                    iconColor={activeService === service.id ? '#00FD3F' : '#7F8C8D'}
                                                />
                                            </View>
                                            <Text style={[
                                                styles.serviceLabelPremium,
                                                activeService === service.id && styles.activeServiceLabelPremium
                                            ]}>
                                                {service.label === 'Biker' ? 'Motorbike' : service.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {(activeService === 'local_services' || selectedProvider) && (
                                    <View style={styles.foodBlock}>
                                        {!selectedProvider && (
                                            <>
                                                <View style={styles.foodMenuAnchor}>
                                                    <Text style={styles.foodMenuSmall}>Select service type</Text>
                                                    <View style={styles.foodMenuRow}>
                                                        <Text style={styles.foodMenuValue}>{foodKindLabel(foodKind)}</Text>
                                                        <IconButton
                                                            icon={bi(foodMenuVisible ? 'chevron-up' : 'chevron-down')}
                                                            size={18}
                                                            iconColor="#BDC3C7"
                                                            style={{ margin: 0 }}
                                                            onPress={() => setFoodMenuVisible(!foodMenuVisible)}
                                                        />
                                                    </View>
                                                </View>

                                                {foodMenuVisible && (
                                                    <View style={styles.dropdownContainer}>
                                                        <TouchableOpacity
                                                            style={styles.dropdownOverlay}
                                                            activeOpacity={1}
                                                            onPress={() => setFoodMenuVisible(false)}
                                                        />
                                                        <View style={styles.dropdownMenu}>
                                                            <TouchableOpacity
                                                                style={styles.dropdownItem}
                                                                onPress={() => { setFoodKind('restaurant'); setFoodMenuVisible(false); }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>Restaurants</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.dropdownItem}
                                                                onPress={() => { setFoodKind('grocery'); setFoodMenuVisible(false); }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>Grocery stores</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.dropdownItem}
                                                                onPress={() => { setFoodKind('pharmacy'); setFoodMenuVisible(false); }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>Pharmacies</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.dropdownItem}
                                                                onPress={() => { setFoodKind('boutique'); setFoodMenuVisible(false); }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>Boutiques</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.dropdownItem}
                                                                onPress={() => { setFoodKind('bar'); setFoodMenuVisible(false); }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>Bars & Clubs</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.dropdownItem}
                                                                onPress={() => { setFoodKind('school'); setFoodMenuVisible(false); }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>Schools</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.dropdownItem}
                                                                onPress={() => { setFoodKind('church'); setFoodMenuVisible(false); }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>Churches</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.dropdownItem}
                                                                onPress={() => { setFoodKind('salon'); setFoodMenuVisible(false); }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>Salons & Spas</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                )}
                                            </>
                                        )}

                                        {selectedProvider ? (
                                            <Surface style={styles.selectedProviderCard} elevation={0}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.selectedProviderLabel}>Pickup</Text>
                                                    <Text style={styles.selectedProviderName} numberOfLines={1}>{selectedProvider.name}</Text>
                                                    {selectedProvider.address ? (
                                                        <Text style={styles.selectedProviderAddr} numberOfLines={1}>{selectedProvider.address}</Text>
                                                    ) : null}
                                                </View>
                                                <IconButton
                                                    icon={bi('close')}
                                                    size={18}
                                                    iconColor="#BDC3C7"
                                                    onPress={() => {
                                                        setSelectedProvider(null);
                                                        setSelectedRoute(null);
                                                        setEditablePrice(null);
                                                        setRouteCoords(null);
                                                        setBikerPos(null);
                                                        setIsTracking(false);
                                                        setBikersFound([]);
                                                        setBikerRoutes([]);
                                                        setSearchError(null);
                                                        setSearchingBikers(false);
                                                        setRoutePickup(null);
                                                        setActiveService('local_services');
                                                    }}
                                                />
                                            </Surface>
                                        ) : (
                                            <>
                                                {providersLoading ? (
                                                    <Text style={styles.foodHint}>Loading nearby places...</Text>
                                                ) : providers?.length ? (
                                                    <View style={styles.providerList}>
                                                        {providers.slice(0, 8).map((p) => (
                                                            <TouchableOpacity key={String(p.id)} style={styles.providerItem} onPress={() => selectProvider(p)}>
                                                                <IconButton
                                                                    icon={bi(foodKind === 'pharmacy' ? 'medical-bag' : foodKind === 'grocery' ? 'cart' : foodKind === 'boutique' ? 'tshirt-crew' : foodKind === 'bar' ? 'glass-cocktail' : foodKind === 'school' ? 'school' : foodKind === 'church' ? 'church' : foodKind === 'salon' ? 'content-cut' : 'silverware-fork-knife')}
                                                                    size={18}
                                                                    iconColor="#A8E05F"
                                                                    style={{ margin: 0 }}
                                                                />
                                                                <View style={{ flex: 1 }}>
                                                                    <Text style={styles.providerName} numberOfLines={1}>{p.name}</Text>
                                                                    <Text style={styles.providerMeta} numberOfLines={1}>
                                                                        {typeof p.distanceKm === 'number' ? `${p.distanceKm.toFixed(2)} km` : ''}
                                                                        {p.address ? (typeof p.distanceKm === 'number' ? ` • ${p.address}` : p.address) : ''}
                                                                    </Text>
                                                                </View>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                ) : (
                                                    <Text style={styles.foodHint}>No nearby places found. Try moving the map/zooming out.</Text>
                                                )}
                                            </>
                                        )}
                                    </View>
                                )}



                                {/* Route confirmation with integrated action */}
                                {selectedRoute && (
                                    <View style={styles.confirmContainerFixed}>
                                        <View style={styles.routeHeader}>
                                            <TouchableOpacity
                                                style={styles.routeText}
                                                activeOpacity={0.7}
                                                onPress={() => {
                                                    if (activeService === 'local_services' && !selectedProvider) {
                                                        alert('Select a pickup first.');
                                                        return;
                                                    }
                                                    navigation.navigate('RouteSelection', {
                                                        pickup: pickupPoint ? { lat: pickupPoint.lat, lng: pickupPoint.lng } : null,
                                                        serviceType: 'courier',
                                                        initialQuery: selectedRoute.to,
                                                        fromLabel: pickupPoint?.label,
                                                    });
                                                }}
                                            >
                                                <Text style={styles.routeLabel}>
                                                    {activeService === 'local_services' ? 'Delivery address' : activeService === 'courier' ? 'Package destination' : 'Destination'}
                                                </Text>
                                                <Text style={styles.pickupMain} numberOfLines={1}>{selectedRoute.to}</Text>
                                                <Text style={styles.routeLabel}>{(selectedRoute.distanceKm || 0).toFixed(2)} km • {selectedRoute.etaMinutes || 0} min</Text>
                                            </TouchableOpacity>
                                            
                                            <View style={styles.priceEditContainer}>
                                                <Text style={styles.currencyIcon}>{selectedRoute.currency || '$'}</Text>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        Alert.prompt(
                                                            'Edit Price',
                                                            'Enter new price:',
                                                            (value) => {
                                                                const newPrice = parseFloat(value);
                                                                if (!isNaN(newPrice) && newPrice >= 1) {
                                                                    const newPriceCents = Math.round(newPrice * 100);
                                                                    setEditablePrice(newPriceCents);
                                                                    setSelectedRoute({
                                                                        ...selectedRoute,
                                                                        priceCents: newPriceCents,
                                                                    });
                                                                }
                                                            },
                                                            'plain-text',
                                                            ((editablePrice || selectedRoute.priceCents) / 100).toFixed(2)
                                                        );
                                                    }}
                                                >
                                                    <Text style={[styles.routePriceInput, { color: '#2ECC71' }]}>
                                                        {((editablePrice || selectedRoute.priceCents || 0) / 100).toFixed(2)}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <TouchableOpacity 
                                            style={[styles.mainConfirmBtnLarge, isTracking && { opacity: 0.7 }]} 
                                            onPress={() => handleConfirmOrder(null)}
                                            disabled={isTracking}
                                        >
                                            <Text style={styles.mainConfirmBtnText}>
                                                {isTracking ? 'Processing...' : 'Book Ride Now'}
                                            </Text>
                                            {!isTracking && <IconButton icon={bi('chevron-right')} size={24} iconColor="#000" style={{ margin: 0 }} />}
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Biker Search Status */}
                                {(searchingBikers || bikersFound.length > 0 || searchError) && (
                                    <View style={styles.bikerSearchBlock}>
                                        {searchingBikers ? (
                                            <View style={styles.bikerSearchRow}>
                                                <ActivityIndicator size="small" color="#A8E05F" />
                                                <Text style={styles.bikerSearchText}>Searching for available bikers nearby...</Text>
                                            </View>
                                        ) : searchError ? (
                                            <View style={styles.bikerSearchRow}>
                                                <IconButton icon={bi('alert-circle')} size={20} iconColor="#E74C3C" style={{ margin: 0 }} />
                                                <Text style={[styles.bikerSearchText, { color: '#E74C3C' }]}>{searchError}</Text>
                                            </View>
                                        ) : bikersFound.length > 0 ? (
                                            <View style={styles.bikerSearchRow}>
                                                <IconButton icon={bi('check-circle')} size={20} iconColor="#2ECC71" style={{ margin: 0 }} />
                                                <Text style={[styles.bikerSearchText, { color: '#2ECC71' }]}>
                                                    {bikersFound.length} biker{bikersFound.length > 1 ? 's' : ''} found nearby
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                )}

                                {showNearby && (
                                    <View style={styles.nearbySection}>
                                        <View style={styles.nearbyHeaderRow}>
                                            <Text style={styles.nearbyTitle}>Nearby Bikers</Text>
                                            <TouchableOpacity onPress={() => setShowNearby(false)}>
                                                <Text style={styles.hideAllLink}>Hide all</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {(bikersFound.length > 0 ? bikersFound : drivers.slice(0, 3)).map((biker) => (
                                            <TouchableOpacity
                                                key={biker.id}
                                                style={[
                                                    styles.nearbyBikerItem,
                                                    selectedBiker?.id === biker.id && styles.nearbyBikerItemActive
                                                ]}
                                                onPress={() => setSelectedBiker(biker)}
                                            >
                                                {biker.photo ? (
                                                    <Avatar.Image size={44} source={{ uri: biker.photo }} style={{ backgroundColor: '#2C2C2E' }} />
                                                ) : (
                                                    <Avatar.Icon size={44} icon={bi('account')} style={{ backgroundColor: '#2C2C2E' }} color="#7F8C8D" />
                                                )}
                                                <View style={styles.nearbyBikerInfo}>
                                                    <Text style={styles.nearbyBikerName}>{biker.name || 'Biker'}</Text>
                                                    <View style={styles.ratingRow}>
                                                        <IconButton icon={bi('star')} size={12} iconColor="#F1C40F" style={{ margin: 0, width: 14 }} />
                                                        <Text style={styles.ratingText}>5.0 • {biker.distanceKm ? `${biker.distanceKm.toFixed(1)}km away` : 'Nearby'}</Text>
                                                    </View>
                                                </View>
                                                <IconButton
                                                    icon={bi(selectedBiker?.id === biker.id ? 'check-circle' : 'motorbike')}
                                                    size={22}
                                                    iconColor={selectedBiker?.id === biker.id ? '#00FD3F' : '#A8E05F'}
                                                />
                                            </TouchableOpacity>
                                        ))}

                                        {selectedRoute && (
                                            <View style={{ marginTop: 15 }}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.confirmBikerBtn,
                                                        (isTracking || !selectedBiker) && { opacity: 0.5 }
                                                    ]}
                                                    onPress={() => handleConfirmOrder(selectedBiker)}
                                                    disabled={isTracking || !selectedBiker}
                                                >
                                                    <LinearGradient
                                                        colors={!selectedBiker ? ['#2C2C2E', '#1C1C1E'] : ['#00FD3F', '#00C853']}
                                                        style={styles.confirmBikerGradient}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                    >
                                                        <View style={styles.confirmBikerContent}>
                                                            {isTracking ? <ActivityIndicator size="small" color="#000" style={{ marginRight: 10 }} /> : null}
                                                            <Text style={[styles.confirmBikerText, !selectedBiker && { color: '#7F8C8D' }]}>
                                                                {isTracking ? 'sending request...' : `confirm ${selectedBiker ? `booking with ${selectedBiker.name}` : 'order'}`}
                                                            </Text>
                                                            {!isTracking && selectedBiker && <IconButton icon={bi('chevron-right')} size={20} iconColor="#000" style={{ margin: 0 }} />}
                                                        </View>
                                                    </LinearGradient>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.cancelBikerBtn}
                                                    onPress={() => {
                                                        setSelectedRoute(null);
                                                        setEditablePrice(null);
                                                        setRouteCoords(null);
                                                        setBikerPos(null);
                                                        setBikersFound([]);
                                                        setBikerRoutes([]);
                                                        setSelectedBiker(null);
                                                    }}
                                                >
                                                    <Text style={styles.cancelBikerText}>Change Selection / Cancel</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                )}
                                {!showNearby && (bikersFound.length > 0 || drivers.length > 0) && (
                                    <TouchableOpacity style={styles.showNearbyBtn} onPress={() => setShowNearby(true)}>
                                        <Text style={styles.showNearbyText}>Show Nearby Bikers ({bikersFound.length || drivers.length})</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}

                        <View style={{ height: 8 }} />
                    </ScrollView>
                </Surface>
            </View>
            <Portal>
                <Modal
                    visible={showWelcome}
                    onDismiss={dismissWelcome}
                    contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                >
                    <View style={{ overflow: 'hidden', borderRadius: 24, paddingBottom: 10 }}>
                        <LinearGradient
                            colors={[theme.colors.primary, theme.colors.secondary]}
                            style={styles.modalHeader}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <IconButton icon={bi('star')} iconColor="#000" size={30} />
                            <Text style={styles.modalTitle}>Welcome to Biker!</Text>
                        </LinearGradient>

                        <ScrollView style={{ maxHeight: 400, padding: 20 }}>
                            <Text style={styles.welcomeSubtitle}>Quick Guide for Users</Text>

                            <View style={styles.tipRow}>
                                <IconButton icon={bi('map-marker-radius')} iconColor={theme.colors.primary} size={24} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tipTitle}>Book a Ride</Text>
                                    <Text style={styles.tipDesc}>Enter destination or tap anywhere on the map to pin a drop-off point instantly.</Text>
                                </View>
                            </View>

                            <View style={styles.tipRow}>
                                <IconButton icon={bi('package-variant')} iconColor={theme.colors.primary} size={24} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tipTitle}>Send a Package & Local Services</Text>
                                    <Text style={styles.tipDesc}>Switch to 'Send a Package' to deliver parcels, or use 'Local Services' to browse nearby shops, food, pharmacies, and more.</Text>
                                </View>
                            </View>

                            <View style={styles.tipRow}>
                                <IconButton icon={bi('phone-in-talk')} iconColor={theme.colors.primary} size={24} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tipTitle}>In-App Calling</Text>
                                    <Text style={styles.tipDesc}>Once a biker accepts your job, call them directly for free through our secure system.</Text>
                                </View>
                            </View>

                            <View style={styles.tipRow}>
                                <IconButton icon={bi('shield-check')} iconColor={theme.colors.primary} size={24} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tipTitle}>Security First</Text>
                                    <Text style={styles.tipDesc}>Your account history is private. You can wipe all your data at any time in Profile Settings.</Text>
                                </View>
                            </View>

                            <Divider style={{ marginVertical: 15 }} />
                            <Text style={{ textAlign: 'center', opacity: 0.6, fontSize: 12, marginBottom: 20 }}>
                                By dismissng this, you agree to our Terms of Service.
                            </Text>
                        </ScrollView>

                        <Button
                            mode="contained"
                            onPress={dismissWelcome}
                            style={styles.modalBtn}
                            buttonColor={theme.colors.primary}
                            textColor="#000"
                        >
                            Got it!
                        </Button>
                    </View>
                </Modal>
                <Modal
                    visible={showSearching || activeOrder?.status === 'pending_bids'}
                    onDismiss={() => {
                        if (activeOrder?.status === 'pending_bids') return; // Don't dismiss if bidding is active unless cancelled
                        setShowSearching(false);
                    }}
                    contentContainerStyle={[styles.modalContent, { backgroundColor: '#1C1C1E', maxHeight: height * 0.8 }]}
                >
                    <View style={{ padding: 24 }}>
                        <View style={{ alignItems: 'center' }}>
                            <View style={styles.searchingAnimContainer}>
                                <ActivityIndicator size="large" color="#3277FF" />
                                <View style={styles.searchingPulse} />
                            </View>
                            <Text style={styles.searchingTitle}>Waiting for Offers</Text>
                            <Text style={styles.searchingSubtitle}>
                                Bikers nearby are reviewing your request. You'll receive offers shortly...
                            </Text>
                            <View style={styles.searchingInfoBox}>
                                <IconButton icon={bi('package-variant')} size={20} iconColor="#5B5B5E" style={{ margin: 0 }} />
                                <Text style={styles.searchingInfoText}>Order #{searchingOrderId || activeOrder?.id || '---'}</Text>
                            </View>
                        </View>

                        {/* Bids List inside the Search Modal */}
                        {bids.length > 0 && (
                            <View style={{ marginTop: 10, maxHeight: 300 }}>
                                <Text style={styles.bidTitleUnderSearch}>Incoming Offers:</Text>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {bids.map(bid => (
                                        <Surface key={bid.id} style={styles.bidCardUnified} elevation={2}>
                                            <View style={styles.bidRow}>
                                                <Avatar.Text size={36} label={bid.biker?.name?.[0] || 'B'} style={{ backgroundColor: '#2C2C2E' }} />
                                                <View style={styles.bidInfo}>
                                                    <Text style={styles.bidNameUnified}>{bid.biker?.name}</Text>
                                                    <View style={styles.ratingRow}>
                                                        <IconButton icon={bi('star')} size={12} iconColor="#3277FF" style={{ margin: 0 }} />
                                                        <Text style={styles.ratingTextBlue}>{bid.biker?.rating || '5.0'}</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.bidActionUnified}>
                                                    <Text style={styles.bidPriceUnified}>${(bid.priceCents / 100).toFixed(2)}</Text>
                                                    <TouchableOpacity 
                                                        style={styles.acceptBidBtnUnified}
                                                        onPress={() => handleAcceptBid(bid.id)}
                                                    >
                                                        <Text style={styles.acceptBidBtnText}>Accept</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </Surface>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <Button
                            mode="outlined"
                            onPress={() => {
                                const orderIdToCancel = searchingOrderId || activeOrder?.id;
                                Alert.alert('Cancel Request?', 'Are you sure you want to stop searching?', [
                                    { text: 'Keep Waiting' },
                                    { text: 'Stop', onPress: () => { 
                                        setShowSearching(false); 
                                        if (orderIdToCancel) handleCancelOrder(orderIdToCancel);
                                        else handleCancelTrip();
                                    }}
                                ]);
                            }}
                            style={styles.searchingCancelBtn}
                            textColor="#E74C3C"
                        >
                            Cancel Request
                        </Button>
                    </View>
                </Modal>
            </Portal>

            <InAppCallUI
                visible={isCalling}
                status={callState}
                recipientName={activeOrder?.biker?.name || 'Biker'}
                recipientPhoto={activeOrder?.biker?.photo}
                onEndCall={() => {
                    CallService.endCall();
                    setIsCalling(false);
                }}
                onRejectCall={() => {
                    CallService.endCall();
                    setIsCalling(false);
                }}
                onAcceptCall={() => {
                    CallService.acceptCall();
                    setCallState('connected');
                }}
            />

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    bikerMarker: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#A8E05F',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    bikerMarkerSelected: {
        backgroundColor: '#00FD3F',
        borderWidth: 3,
        borderColor: '#000',
    },
    pickupMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickupMarkerInner: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#00d4ff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        elevation: 8,
        shadowColor: '#00d4ff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    pickupMarkerPulse: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0, 212, 255, 0.25)',
        zIndex: -1,
    },
    dropoffMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropoffMarkerInner: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#ff6b6b',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        elevation: 8,
        shadowColor: '#ff6b6b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    dropoffMarkerPulse: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 107, 107, 0.25)',
        zIndex: -1,
    },
    providerMarker: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        padding: 1,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    providerMarkerActive: {
        transform: [{ scale: 1.12 }],
    },
    topBar: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    menuButton: {
        backgroundColor: '#1E1E1E',
        borderRadius: 30,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    profileButton: {
        backgroundColor: '#1E1E1E',
        borderRadius: 30,
        elevation: 8,
        padding: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    locationIndicator: {
        position: 'absolute',
        top: height * 0.35,
        left: width * 0.5 - 20,
        alignItems: 'center',
    },
    pickupLabel: {
        backgroundColor: '#1E1E1E',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 4,
    },
    pickupText: {
        fontSize: 10,
        color: '#B0B0B0',
        fontWeight: '700',
        marginRight: 4,
    },
    pickupRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pickupMain: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    chevron: {
        margin: 0,
        width: 16,
        height: 16,
    },
    locationPin: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerButton: {
        position: 'absolute',
        right: 20,
        bottom: 120,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 30,
        elevation: 6,
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectLocationButton: {
        position: 'absolute',
        right: 20,
        bottom: 180,
        backgroundColor: '#1a6fba',
        borderRadius: 30,
        elevation: 6,
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveLocationButton: {
        position: 'absolute',
        right: 20,
        bottom: 180,
        backgroundColor: '#00C853',
        borderRadius: 20,
        elevation: 4,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        shadowColor: '#00C853',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
    },
    liveLocationText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        marginLeft: 4,
    },
    fitRouteButton: {
        position: 'absolute',
        right: 20,
        bottom: 300,
        backgroundColor: '#00d4ff',
        borderRadius: 24,
        elevation: 6,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        shadowColor: '#00d4ff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
    },
    fitRouteText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        marginLeft: 4,
    },
    chatButton: {
        position: 'absolute',
        right: 20,
        bottom: 235,
        backgroundColor: '#1a6fba',
        borderRadius: 30,
        elevation: 8,
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // KEY CHANGE: bottomPanel uses 'flex-end' anchoring via position absolute at bottom
    // but does NOT set a fixed height — it wraps its content only
    bottomPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        // no maxHeight or minHeight — panel grows to fit content
    },
    bikerSearchBlock: {
        marginBottom: 10,
        backgroundColor: '#1C1C1E',
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: '#2C2C2C',
    },
    bikerSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bikerSearchText: {
        color: '#BDC3C7',
        fontSize: 13,
        marginLeft: 6,
        flex: 1,
    },
    bottomPanelSurface: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 24,
        paddingTop: 12,
    },
    panelContent: {
        paddingBottom: 18,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#333333',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    serviceRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    serviceItem: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 20,
        alignItems: 'center',
        backgroundColor: '#252525',
    },
    activeServiceItem: {
        backgroundColor: '#2C3E50',
        borderWidth: 1,
        borderColor: '#00FD3F',
    },
    serviceIconContainer: {
        position: 'relative',
        marginBottom: 4,
    },
    serviceLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
        color: '#B0B0B0',
    },
    activeServiceLabel: {
        color: '#00FD3F',
    },
    foodBlock: {
        marginBottom: 12,
    },
    foodMenuAnchor: {
        backgroundColor: '#252525',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#2C2C2C',
        marginBottom: 10,
    },
    foodMenuSmall: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: '#7F8C8D',
        marginBottom: 6,
    },
    foodMenuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dropdownContainer: {
        position: 'relative',
        zIndex: 100,
    },
    dropdownOverlay: {
        position: 'absolute',
        top: -100,
        left: -20,
        right: -20,
        height: 300,
        zIndex: 1,
    },
    dropdownMenu: {
        backgroundColor: '#252525',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2C2C2C',
        marginBottom: 10,
        zIndex: 2,
    },
    dropdownItem: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    dropdownItemText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '500',
    },
    foodMenuValue: {
        flex: 1,
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    foodHint: {
        color: '#7F8C8D',
        fontSize: 12,
        marginBottom: 10,
        textAlign: 'center',
    },
    selectedProviderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252525',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#2C2C2C',
        marginBottom: 10,
    },
    selectedProviderLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: '#7F8C8D',
        marginBottom: 2,
    },
    selectedProviderName: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    selectedProviderAddr: {
        fontSize: 12,
        color: '#7F8C8D',
        marginTop: 2,
    },
    providerList: {
        marginTop: 2,
    },
    providerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252525',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#2C2C2C',
    },
    providerName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    providerMeta: {
        fontSize: 11,
        color: '#7F8C8D',
        marginTop: 2,
    },
    quickStats: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    quickStatCard: {
        flex: 1,
        backgroundColor: '#252525',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#2C2C2C',
    },
    quickStatLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: '#7F8C8D',
        marginBottom: 6,
        textAlign: 'center',
    },
    quickStatValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    searchContainer: {
        marginBottom: 10,
    },
    searchBar: {
        backgroundColor: '#2C2C2C',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        paddingHorizontal: 10,
    },
    searchText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#B0B0B0',
        marginLeft: 8,
    },
    pinLocationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E67E22',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginTop: 8,
        alignSelf: 'center',
    },
    pinLocationText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF',
        marginLeft: 4,
    },
    pinningOverlay: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(230, 126, 34, 0.95)',
        borderRadius: 8,
        padding: 12,
        zIndex: 1000,
        alignItems: 'center',
    },
    pinningOverlayText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    confirmContainer: {
        marginTop: 10,
        alignItems: 'center',
    },
    confirmContainerFixed: {
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 15,
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        paddingVertical: 12,
        maxHeight: height * 0.4,
    },
    routeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    routeText: {
        flex: 1,
    },
    routeLabel: {
        fontSize: 12,
        color: '#7F8C8D',
        marginBottom: 4,
    },
    routeChangeHint: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '700',
        color: '#2ECC71',
    },
    statsHeader: {
        flexDirection: 'row',
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: 15,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'space-evenly',
        zIndex: 1000,
        elevation: 1000,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#333',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#888',
        marginTop: 2,
    },
    statValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFF',
        marginTop: 2,
        textAlign: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
        width: '100%',
    },
    priceEditContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2C',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    currencyIcon: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2ECC71',
        marginRight: 4,
    },
    routePriceInput: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2ECC71',
        minWidth: 50,
        textAlign: 'right',
        backgroundColor: 'transparent',
    },
    confirmButton: {
        width: '100%',
        backgroundColor: '#2ECC71',
        borderRadius: 16,
        marginBottom: 16,
        elevation: 4,
    },
    confirmButtonContent: {
        height: 56,
    },
    confirmButtonLabel: {
        color: '#000000',
        fontWeight: 'bold',
        fontSize: 18,
        letterSpacing: 0.5,
    },
    cancelButton: {
        flex: 1,
        borderColor: '#E74C3C',
        borderRadius: 16,
    },
    cancelButtonContent: {
        height: 56,
        paddingHorizontal: 0,
    },
    cancelButtonLabel: {
        color: '#E74C3C',
        fontWeight: 'bold',
        minWidth: 0,
        marginHorizontal: 0,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#7F8C8D',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: '#252525',
        padding: 12,
        borderRadius: 16,
    },
    historyIcon: {
        margin: 0,
        backgroundColor: '#2C2C2C',
        borderRadius: 20,
    },
    placeTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    placeName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    placeCity: {
        fontSize: 12,
        color: '#7F8C8D',
        marginTop: 2,
    },
    bikerListContainer: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 15,
        paddingBottom: 10,
        marginTop: 10,
    },
    bikerListTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginLeft: 15,
        marginBottom: 10,
    },
    bikerScroll: {
        paddingHorizontal: 10,
    },
    bikerCard: {
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        padding: 12,
        marginHorizontal: 5,
        alignItems: 'center',
        width: 100,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    bikerCardSelected: {
        borderColor: '#00C853',
        backgroundColor: 'rgba(0, 200, 83, 0.15)',
    },
    bikerName: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 8,
        textAlign: 'center',
    },
    bikerVehicle: {
        color: '#888',
        fontSize: 10,
        marginTop: 2,
        textAlign: 'center',
    },
    bikerEta: {
        color: '#00C853',
        fontSize: 10,
        marginTop: 2,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modeSwitch: {
        position: 'absolute',
        top: 130,
        right: 20,
        backgroundColor: 'rgba(46, 204, 113, 0.9)',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    activeOrderCard: {
        margin: 15,
        borderRadius: 20,
        padding: 15,
        backgroundColor: '#1C1C1E',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 10,
    },
    activeOrderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    activeOrderInfo: {
        flex: 1,
        marginRight: 10,
    },
    activeOrderLabel: {
        color: '#A8E05F',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    activeOrderBikerName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    activeOrderRoute: {
        color: '#7F8C8D',
        fontSize: 12,
    },
    activeOrderActions: {
        alignItems: 'center',
    },
    commBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        minWidth: 80,
        justifyContent: 'center',
    },
    commBtnText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
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

    // ── Location Search Bar ─────────────────────────────────────────
    searchBarWrapper: {
        position: 'absolute',
        top: 110,
        left: 16,
        right: 16,
        zIndex: 500,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    searchBarSurface: {
        borderRadius: 16,
        backgroundColor: '#1C1C1E',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 10,
    },
    searchBarSurfaceFocused: {
        backgroundColor: '#2C2C2E',
    },
    searchBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        paddingVertical: 0,
        letterSpacing: 0.5,
    },
    suggestionsContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        maxHeight: 300,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: 'transparent',
    },
    suggestionIcon: {
        width: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 4,
    },
    suggestionText: {
        flex: 1,
    },
    suggestionPrimary: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    suggestionSecondary: {
        color: '#7F8C8D',
        fontSize: 12,
        marginTop: 2,
    },
    suggestionsSeparator: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        marginHorizontal: 16,
    },
    searchLoadingContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        padding: 12,
    },
    skeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    skeletonIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.07)',
    },
    skeletonLine: {
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    activeOrderCardStraight: {
        borderRadius: 24,
        padding: 22,
        marginVertical: 12,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(0, 253, 63, 0.15)',
        backgroundColor: 'rgba(28, 28, 30, 0.7)',
    },
    activeOrderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    activeOrderBikerName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 2,
    },
    activeOrderPrice: {
        color: '#00FD3F',
        fontSize: 16,
        fontWeight: '900',
    },
    statusPillFancy: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        alignSelf: 'flex-start',
        marginBottom: 8,
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
    priceLabelSmall: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '900',
        marginTop: 2,
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
    straightRouteBox: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 18,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    straightActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconCircleBtn: {
        width: 46,
        height: 46,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    mainStatusBtn: {
        flex: 1,
        borderRadius: 12,
        height: 46,
        justifyContent: 'center',
    },
    pickupDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00d4ff',
    },
    dropoffSquare: {
        width: 8,
        height: 8,
        backgroundColor: '#ff6b6b',
    },
    routePointStraight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    routeValueStraight: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    straightRouteBox: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },

    // ── Premium Redesign Styles ──────────────────────────────────
    premiumHeader: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 16,
        zIndex: 1000,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greetingSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    appBadge: {
        backgroundColor: '#3277FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    appBadgeText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
    },
    appBadgeSub: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
        marginTop: -3,
    },
    greetingText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        fontWeight: '600',
    },
    userNameText: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
    },
    notificationBell: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    redDot: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF4757',
        borderWidth: 2,
        borderColor: '#000',
    },
    serviceRowPremium: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 25,
        paddingHorizontal: 4,
    },
    serviceItemPremium: {
        alignItems: 'center',
        width: 100,
    },
    serviceIconFrame: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#1E1E20',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2.5,
        borderColor: 'transparent',
    },
    activeServiceFrame: {
        borderColor: '#3277FF',
        backgroundColor: 'rgba(50, 119, 255, 0.05)',
        shadowColor: '#3277FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 10,
    },
    serviceLabelPremium: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: '800',
        color: '#7F8C8D',
        letterSpacing: 0.4,
        textAlign: 'center',
    },
    activeServiceLabelPremium: {
        color: '#FFF',
    },
    nearbySection: {
        marginTop: 15,
        marginBottom: 10,
    },
    nearbyHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
    },
    nearbyTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    hideAllLink: {
        color: '#3277FF',
        fontSize: 14,
        fontWeight: '800',
    },
    nearbyBikerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#121212',
        padding: 16,
        borderRadius: 24,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    nearbyBikerInfo: {
        flex: 1,
        marginLeft: 16,
    },
    nearbyBikerName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
    },
    nearbyBikerItemActive: {
        borderColor: '#3277FF',
        backgroundColor: 'rgba(50, 119, 255, 0.05)',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ratingText: {
        color: '#3277FF', // Blue stars/text
        fontSize: 12,
        fontWeight: '700',
    },
    bookRideBtnPremium: {
        flexDirection: 'row',
        height: 58,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3277FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },

    // Unified Bidding UI Styles
    bidTitleUnderSearch: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 12,
        marginTop: 5,
    },
    bidCardUnified: {
        backgroundColor: '#2C2C2E',
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    bidNameUnified: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    bidActionUnified: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    bidPriceUnified: {
        fontSize: 16,
        fontWeight: '900',
        color: '#3277FF',
        marginBottom: 4,
    },
    acceptBidBtnUnified: {
        backgroundColor: '#3277FF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    acceptBidBtnText: {
        color: '#000',
        fontSize: 12,
        fontWeight: 'bold',
    },
    ratingTextBlue: {
        color: '#3277FF',
        fontSize: 12,
        fontWeight: '700',
    },
    searchingCancelBtn: {
        width: '100%',
        borderRadius: 14,
        borderColor: 'rgba(231, 76, 60, 0.3)',
        marginTop: 20,
    },
    bookRideTextPremium: {
        color: '#000',
        fontSize: 19,
        fontWeight: '900',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    modernBikerMarker: {
        width: 38,
        height: 38,
        justifyContent: 'center',
        alignItems: 'center',
    },
    markerBlackCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#3277FF',
        shadowColor: '#3277FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 5,
        elevation: 8,
    },
    markerCenterDot: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#3277FF',
        bottom: -2,
    },
    confirmBikerBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        height: 56,
        elevation: 8,
        shadowColor: '#3277FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    confirmBikerGradient: {
        flex: 1,
        justifyContent: 'center',
    },
    confirmBikerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    confirmBikerText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'normal',
    },
    cancelBikerBtn: {
        marginTop: 12,
        alignItems: 'center',
        paddingVertical: 10,
    },
    cancelBikerText: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '600',
    },
    showNearbyBtn: {
        backgroundColor: 'rgba(50, 119, 255, 0.1)',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(50, 119, 255, 0.3)',
    },
    showNearbyText: {
        color: '#3277FF',
        fontWeight: '700',
    },
    chipsScroll: {
        marginTop: 12,
    },
    chipsContent: {
        paddingRight: 20,
    },
    chipItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingRight: 12,
        borderRadius: 12,
        marginRight: 8,
        height: 36,
    },
    chipIcon: {
        margin: 0,
        padding: 0,
    },
    chipText: {
        color: '#000',
        fontSize: 13,
        fontWeight: '700',
    },

    routePreviewContainer: { padding: 10 },
    vehicleToggleRow: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 4, marginBottom: 16 },
    vehicleToggleItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12 },
    vehicleToggleActive: { backgroundColor: '#3277FF' },
    vehicleToggleText: { color: 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 14 },
    
    utilityScroll: { marginBottom: 16 },
    utilityChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', paddingHorizontal: 12, height: 36, borderRadius: 18, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    utilityChipActive: { backgroundColor: '#FFFFFF' },
    utilityChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

    routeStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#1C1C1E', borderRadius: 20, padding: 16, marginBottom: 20 },
    routeStatBlock: { alignItems: 'center' },
    routeStatLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', marginBottom: 4 },
    routeStatValue: { color: '#FFF', fontSize: 18, fontWeight: '900' },
    routeStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },

    routeActionsGrid: { gap: 12 },
    mainActionBtn: { backgroundColor: '#3277FF', height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    mainActionBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
    secondaryActionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    secondaryActionBtn: { flex: 1, backgroundColor: '#1C1C1E', height: 70, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
    secondaryActionText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', marginTop: -4 },
    
    mainConfirmBtnLarge: {
        backgroundColor: '#3277FF',
        height: 58,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        shadowColor: '#3277FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 10,
    },
    mainConfirmBtnText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    // Searching Modal Styles
    searchingAnimContainer: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    searchingPulse: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: 'rgba(50, 119, 255, 0.3)',
    },
    searchingTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 10,
        textAlign: 'center',
    },
    searchingSubtitle: {
        color: '#8E8E93',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    searchingInfoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 30,
    },
    searchingInfoText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
        marginLeft: 8,
    },
    searchingCancelBtn: {
        width: '100%',
        borderRadius: 14,
        borderColor: 'rgba(231, 76, 60, 0.3)',
    },
});

export default HomeScreen;
