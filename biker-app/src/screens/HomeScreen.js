import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StatusBar, TextInput, FlatList, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { Text, Avatar, IconButton, Surface, Button, Menu, useTheme, Portal, Modal, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useNavigation, useRoute, DrawerActions, useFocusEffect } from '@react-navigation/native';
import SheetService from '../api/SheetService';
import AppSecurity from '../utils/AppSecurity';
import { bi } from '../components/AppIcon';
import mapStyle from '../theme/mapStyle.json';

const { width, height } = Dimensions.get('window');
const HomeScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const route = useRoute();
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
    const [selectedBiker, setSelectedBiker] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [draftOrderId, setDraftOrderId] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [editablePrice, setEditablePrice] = useState(null);
    const [mapFocused, setMapFocused] = useState(false);
    const [pinningMode, setPinningMode] = useState(false);
    const [routePickup, setRoutePickup] = useState(null); // pickup from route selection
    const [ambientPlaces, setAmbientPlaces] = useState([]);

    // ── Location Search State ──────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
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

    // Local state to trigger re-render on profile update
    const [user, setUser] = useState(SheetService.currentUser);
    const [showWelcome, setShowWelcome] = useState(false);

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
            setUser(SheetService.currentUser);
        }, [])
    );

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

    const refreshNearby = async (coords) => {
        try {
            const init = await SheetService.dashboardInit({ lat: coords.latitude, lng: coords.longitude, radiusKm: 5 });
            if (init?.success) {
                setDashboard(init.data);
                setDrivers(init.data.nearbyDrivers || []);
                setUser(init.data.user || SheetService.currentUser);
            }
            // Fetch ambient places for map richness
            try {
                const mapPlaces = await SheetService.getNearbyProviders({
                    lat: coords.latitude,
                    lng: coords.longitude,
                    kind: 'restaurant',
                    radiusM: 3000,
                    limit: 15
                });
                if (mapPlaces?.data?.providers) {
                    setAmbientPlaces(mapPlaces.data.providers);
                }
            } catch { /* ignore */ }
            // attempt to flush any cached draft orders when network is available
            try {
                await SheetService.flushDraftQueue();
            } catch { /* ignore */ }

            if (!socketRef.current) {
                try {
                    socketRef.current = await SheetService.connectTrackingSocket();

                    // Register with backend
                    if (SheetService.currentUser?.id) {
                        socketRef.current.emit('register', {
                            userId: SheetService.currentUser.id,
                            userType: 'customer'
                        });
                    }
                } catch (err) {
                    // socket connection failure is non-fatal; log for debugging
                    console.log('[HomeScreen] socket connect failed', err);
                }
            }
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        if (!location) return;
        refreshNearby(location);
        const interval = setInterval(() => refreshNearby(location), 10000);
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

    const handleConfirmOrder = async () => {
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
            setIsTracking(true);

            // 1. Save a fully-populated draft
            const draftRes = await SheetService.upsertDraft({
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
            });

            const draftId = draftRes?.data?.draftOrder?.id || draftOrderId;
            if (draftId) setDraftOrderId(draftId);

            // 2. Confirm and create — pass the selected biker so backend uses them directly
            const res = await SheetService.createOrder({
                paymentMethod: 'cash',
                draftOrderId: draftId,
                preferredBikerId: selectedBiker?.id || undefined,
            });

            if (!res?.success) {
                const msg = res?.message || 'Order creation failed';
                Alert.alert(
                    'Order Failed',
                    msg.includes('No drivers') || msg.includes('ServiceUnavailable')
                        ? 'No bikers are available right now. Please try again in a moment.'
                        : msg
                );
                setIsTracking(false);
                return;
            }

            const orderId = res.data.orderId;
            const newOrder = {
                id: orderId,
                status: 'pending',
                biker: selectedBiker,
                pickup: pickupPoint,
                dropoff: selectedRoute?.dropoff || { lat: selectedRoute?.dropoffLat, lng: selectedRoute?.dropoffLng, label: selectedRoute?.to }
            };
            setActiveOrder(newOrder);

            // 3. Subscribe to live tracking for this order
            const socket = socketRef.current?.connected ? socketRef.current : await SheetService.connectTrackingSocket();
            socketRef.current = socket;
            socket.emit('subscribe', { orderId });

            socket.off('tracking_update');
            socket.on('tracking_update', (u) => {
                if (u?.orderId !== orderId) return;
                setBikerPos({ latitude: u.lat, longitude: u.lng });
            });

            socket.off('order_accepted');
            socket.on('order_accepted', (data) => {
                if (data?.orderId !== orderId) return;
                setActiveOrder(prev => prev ? { ...prev, status: 'accepted', biker: data.biker } : prev);
                Alert.alert('Biker Accepted', `${data.biker?.name || 'A biker'} is on the way!`);
            });

            socket.off('order_status_update');
            socket.on('order_status_update', async (data) => {
                if (data?.orderId !== orderId) return;
                setActiveOrder(prev => prev ? { ...prev, status: data.status } : prev);
                if (data.status === 'completed') {
                    const completedBiker = data.biker || {};
                    const completedOrderId = data.orderId;
                    // Persist pending rating so user can't bypass it
                    await AppSecurity.setPendingRating(
                        completedOrderId,
                        completedBiker.id,
                        completedBiker.name || 'Your Biker'
                    );
                    setActiveOrder(null);
                    setSelectedRoute(null);
                    setIsTracking(false);
                    // Force navigate to mandatory rating
                    navigation.navigate('Rating', {
                        bikerId: completedBiker.id,
                        bikerName: completedBiker.name || 'Your Biker',
                        bikerPhoto: completedBiker.photo || null,
                        orderId: completedOrderId,
                    });
                }
            });

            Alert.alert('Order Confirmed! 🎉', `Your biker ${selectedBiker?.name ? '(' + selectedBiker.name + ') ' : ''}is on the way.`);
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to confirm order';
            Alert.alert(
                'Order Failed',
                msg.toLowerCase().includes('no driver') || msg.toLowerCase().includes('unavailable')
                    ? 'No bikers available nearby. Please try again or wait a moment.'
                    : msg
            );
            setIsTracking(false);
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
            setFoodMenuVisible(false);
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
                    {!selectedRoute && !selectedProvider && (ambientPlaces || []).map(p => (
                        <Marker
                            key={`ambient-${p.id}`}
                            coordinate={{ latitude: p.lat, longitude: p.lng }}
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
                    ))}
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

                    {bikerPos && (
                        <Marker coordinate={bikerPos} title="Your Biker">
                            <Avatar.Icon size={40} icon={bi('motorbike')} backgroundColor="#000" color="#A8E05F" />
                        </Marker>
                    )}

                    {drivers.filter(d => d?.coords?.lat && d?.coords?.lng).map((driver) => (
                        <Marker
                            key={String(driver.id)}
                            coordinate={{
                                latitude: driver.coords.lat,
                                longitude: driver.coords.lng,
                            }}
                            title={driver.name}
                            description={driver.vehicleType || 'Biker'}
                            onPress={() => {
                                setSelectedBiker(driver);
                                handleServiceSelect('bike');
                            }}
                        >
                            <View style={[styles.bikerMarker, selectedBiker?.id === driver.id && styles.bikerMarkerSelected]}>
                                <Avatar.Icon size={30} icon={bi('motorbike')} backgroundColor={selectedBiker?.id === driver.id ? "#00FD3F" : "#A8E05F"} color="#000" />
                            </View>
                        </Marker>
                    ))}

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
                                    backgroundColor={selectedProvider?.id === p.id ? '#00FD3F' : '#111'}
                                    color={selectedProvider?.id === p.id ? '#000' : '#A8E05F'}
                                />
                            </View>
                        </Marker>
                    ))}
                </MapView>)}

            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                >
                    <IconButton icon={bi('menu')} size={28} iconColor="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => navigation.navigate('ProfileSettings')}
                >
                    {user?.photo ? (
                        <Avatar.Image size={40} source={{ uri: user.photo }} />
                    ) : (
                        <Avatar.Icon size={40} icon={bi('account')} backgroundColor="#F4F6F7" color="#BDC3C7" />
                    )}
                </TouchableOpacity>
            </View>

            {/* ── inDrive-Style Floating Search Bar (single, no Surface overflow) ── */}
            <View style={styles.searchBarWrapper} pointerEvents="box-none">
                <View style={[
                    styles.searchBarSurface,
                    searchFocused && styles.searchBarSurfaceFocused
                ]}>
                    <View style={styles.searchBarRow}>
                        <IconButton
                            icon={bi('magnify')}
                            size={22}
                            iconColor={searchFocused ? '#00FD3F' : '#BDC3C7'}
                            style={{ margin: 0, marginLeft: 4 }}
                        />
                        <TextInput
                            ref={searchInputRef}
                            style={styles.searchInput}
                            placeholder="Where to go?"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={searchQuery}
                            onChangeText={handleSearchInput}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                            returnKeyType="search"
                            autoCorrect={false}
                        />
                        {searchLoading && (
                            <ActivityIndicator size="small" color="#00FD3F" style={{ marginRight: 12 }} />
                        )}
                        {searchQuery.length > 0 && !searchLoading && (
                            <TouchableOpacity onPress={clearSearch} style={{ paddingRight: 8 }}>
                                <IconButton icon={bi('close-circle')} size={18} iconColor="#7F8C8D" style={{ margin: 0 }} />
                            </TouchableOpacity>
                        )}
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
                                                iconColor={index === 0 ? '#00FD3F' : '#7F8C8D'}
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
                        bounces={true}
                        alwaysBounceVertical={true}
                    >
                        <View style={styles.handle} />

                        {/* Active Order Card */}
                        {activeOrder && (
                            <Surface style={styles.activeOrderCard} elevation={2}>
                                <View style={styles.activeOrderTop}>
                                    <View style={styles.activeOrderInfo}>
                                        <Text style={styles.activeOrderLabel}>{activeOrder.status === 'pending' ? 'Searching for Biker' : 'Trip in Progress'}</Text>
                                        <Text style={styles.activeOrderBikerName}>{activeOrder.biker?.name || 'Finding Driver...'}</Text>
                                        <Text style={styles.activeOrderRoute} numberOfLines={1}>To: {activeOrder.dropoff?.label || activeOrder.dropoff?.address || 'Destination'}</Text>
                                    </View>
                                    <View style={styles.activeOrderActions}>
                                        <TouchableOpacity
                                            style={[styles.commBtn, { backgroundColor: '#3498DB', marginBottom: 8 }]}
                                            onPress={() => navigation.navigate('Chat', {
                                                orderId: activeOrder.id,
                                                recipientName: activeOrder.biker?.name || 'Driver',
                                                recipientRole: 'driver',
                                                recipientPhone: activeOrder.biker?.phone,
                                                recipientId: activeOrder.biker?.id,
                                            })}
                                        >
                                            <IconButton icon={bi('chat')} size={24} iconColor="#FFF" style={{ margin: 0 }} />
                                            <Text style={styles.commBtnText}>Chat</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.commBtn, { backgroundColor: '#E74C3C' }]}
                                            onPress={() => {
                                                Alert.alert('Cancel Trip', 'Are you sure you want to cancel this trip?', [
                                                    { text: 'No' },
                                                    {
                                                        text: 'Yes, Cancel', style: 'destructive', onPress: () => {
                                                            setActiveOrder(null);
                                                            setIsTracking(false);
                                                            setSelectedRoute(null);
                                                        }
                                                    }
                                                ]);
                                            }}
                                        >
                                            <IconButton icon={bi('close')} size={24} iconColor="#FFF" style={{ margin: 0 }} />
                                            <Text style={styles.commBtnText}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </Surface>
                        )}

                        {!activeOrder && (
                            <>
                                {/* Stats Header - shown at top for Send a Package when route selected */}
                                {(activeService === 'courier' || activeService === 'bike') && selectedRoute && (
                                    <View style={[styles.statsHeader, { justifyContent: 'space-evenly', marginBottom: 12, marginTop: 4 }]}>
                                        <View style={styles.statItem}>
                                            <Text style={[styles.statLabel, { textAlign: 'center' }]}>BIKE</Text>
                                            <Text style={[styles.statValue, { textAlign: 'center' }]}>
                                                {bikersFound.length > 0 ? `${bikersFound.length} available` : 'Searching...'}
                                            </Text>
                                        </View>
                                        <View style={styles.statDivider} />
                                        <View style={styles.statItem}>
                                            <Text style={[styles.statLabel, { textAlign: 'center' }]}>ETA</Text>
                                            <Text style={[styles.statValue, { textAlign: 'center' }]}>
                                                {bikersFound.length > 0 && bikersFound[0]?.distanceKm
                                                    ? `${Math.ceil(bikersFound[0].distanceKm / 20 * 60)} min`
                                                    : selectedRoute?.etaMinutes
                                                        ? `${selectedRoute.etaMinutes} min`
                                                        : '--'}
                                            </Text>
                                        </View>
                                        <View style={styles.statDivider} />
                                        <View style={styles.statItem}>
                                            <Text style={[styles.statLabel, { textAlign: 'center' }]}>ESTIMATE</Text>
                                            <Text style={[styles.statValue, { textAlign: 'center' }]}>
                                                {selectedRoute?.currency || '$'}{((editablePrice || selectedRoute?.priceCents || 0) / 100).toFixed(2)}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                {/* Service Categories */}
                                <View style={styles.serviceRow}>
                                    {services.map((service, idx) => (
                                        <TouchableOpacity
                                            key={service.id}
                                            style={[
                                                styles.serviceItem,
                                                idx !== services.length - 1 && { marginRight: 12 },
                                                activeService === service.id && styles.activeServiceItem,
                                            ]}
                                            onPress={() => handleServiceSelect(service.id)}
                                        >
                                            <View style={styles.serviceIconContainer}>
                                                <IconButton
                                                    icon={bi(service.icon)}
                                                    size={30}
                                                    iconColor={activeService === service.id ? '#00FD3F' : '#FFFFFF'}
                                                />
                                            </View>
                                            <Text
                                                style={[
                                                    styles.serviceLabel,
                                                    activeService === service.id && styles.activeServiceLabel,
                                                ]}
                                            >
                                                {service.label}
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



                                {/* Route confirmation - always visible when route selected */}
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
                                                <Text style={styles.routeChangeHint}>Tap to change</Text>
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

                                        <View style={styles.buttonRow}>
                                            {!selectedBiker ? (
                                                <Button
                                                    mode="contained"
                                                    onPress={triggerBikerSearch}
                                                    loading={searchingBikers}
                                                    disabled={searchingBikers || !selectedRoute}
                                                    style={[styles.confirmButton, { flex: 2, backgroundColor: '#00C853' }]}
                                                    contentStyle={styles.confirmButtonContent}
                                                    labelStyle={styles.confirmButtonLabel}
                                                >
                                                    {searchingBikers ? 'Searching...' : bikersFound.length > 0 ? `${bikersFound.length} Bikers Found` : 'Find Biker'}
                                                </Button>
                                            ) : (
                                                <Button
                                                    mode="contained"
                                                    onPress={handleConfirmOrder}
                                                    loading={isTracking}
                                                    disabled={isTracking || !selectedBiker}
                                                    style={[styles.confirmButton, { flex: 2, backgroundColor: '#00C853' }]}
                                                    contentStyle={styles.confirmButtonContent}
                                                    labelStyle={styles.confirmButtonLabel}
                                                >
                                                    Confirm with {selectedBiker.name}
                                                </Button>
                                            )}
                                            <Button
                                                mode="outlined"
                                                onPress={() => {
                                                    setSelectedRoute(null);
                                                    setEditablePrice(null);
                                                    setRouteCoords(null);
                                                    setBikerPos(null);
                                                    setIsTracking(false);
                                                    setBikersFound([]);
                                                    setBikerRoutes([]);
                                                    setSearchError(null);
                                                    setSearchingBikers(false);
                                                    setSelectedBiker(null);
                                                    setRoutePickup(null);
                                                    if (route.params?.selectedRoute || route.params?.reorder) {
                                                        navigation.setParams({ selectedRoute: null, reorder: null });
                                                    }
                                                    if (activeService !== 'local_services') setSelectedProvider(null);
                                                }}
                                                style={styles.cancelButton}
                                                contentStyle={styles.cancelButtonContent}
                                                labelStyle={styles.cancelButtonLabel}
                                            >
                                                Cancel
                                            </Button>
                                        </View>

                                        {/* Biker List */}
                                        {bikersFound.length > 0 && (
                                            <View style={styles.bikerListContainer}>
                                                <Text style={styles.bikerListTitle}>Select a Biker</Text>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bikerScroll}>
                                                    {bikersFound.map((biker) => (
                                                        <TouchableOpacity
                                                            key={biker.id}
                                                            style={[
                                                                styles.bikerCard,
                                                                selectedBiker?.id === biker.id && styles.bikerCardSelected
                                                            ]}
                                                            onPress={() => {
                                                                setSelectedBiker(biker);
                                                                if (socketRef.current?.connected) {
                                                                    socketRef.current.emit('biker_selected', {
                                                                        bikerId: biker.id,
                                                                        bikerName: biker.name,
                                                                        orderId: draftOrderId,
                                                                        userName: SheetService.currentUser?.name || 'Customer'
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <Avatar.Icon
                                                                size={40}
                                                                icon={bi('motorbike')}
                                                                color={selectedBiker?.id === biker.id ? "#000" : "#00C853"}
                                                                style={{ backgroundColor: selectedBiker?.id === biker.id ? "#00C853" : "rgba(0,200,83,0.2)" }}
                                                            />
                                                            <Text style={styles.bikerName} numberOfLines={1}>{biker.name}</Text>
                                                            <Text style={styles.bikerVehicle}>{biker.vehicleNumber || biker.vehicleType || 'Bike'}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
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

                                {/* History & Recent – only shown when no route selected */}
                                {recentPlaces.length > 0 && (
                                    <>
                                        <Text style={styles.sectionTitle}>History &amp; Recent</Text>
                                        {recentPlaces.map((place) => (
                                            <TouchableOpacity
                                                key={place.id}
                                                style={styles.recentItem}
                                                onPress={() => selectRecentDestination(place)}
                                            >
                                                <IconButton icon={bi('history')} size={24} iconColor="#BDC3C7" style={styles.historyIcon} />
                                                <View style={styles.placeTextContainer}>
                                                    <Text style={styles.placeName}>{place.name}</Text>
                                                    <Text style={styles.placeCity}>{place.city}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </>
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
                </Modal>
            </Portal>
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
        overflow: 'hidden',
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
    },
    cancelButtonLabel: {
        color: '#E74C3C',
        fontWeight: 'bold',
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

    // ── Location Search Bar ─────────────────────────────────────────
    searchBarWrapper: {
        position: 'absolute',
        top: 110,
        left: 16,
        right: 16,
        zIndex: 500,
    },
    searchBarSurface: {
        borderRadius: 18,
        backgroundColor: 'rgba(18, 18, 18, 0.97)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
    },
    searchBarSurfaceFocused: {
        borderColor: '#00FD3F',
        borderWidth: 1.5,
    },
    searchBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 52,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '500',
        paddingVertical: 0,
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
});

export default HomeScreen;
