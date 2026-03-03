import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Text, IconButton, Divider, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SheetService from '../api/SheetService';
import { bi } from '../components/AppIcon';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM_HOST = 'https://router.project-osrm.org';

// OSRM route function - called directly from frontend
async function getRoadRoute(fromLat, fromLng, toLat, toLng) {
    const url = `${OSRM_HOST}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    console.log('OSRM URL:', url);

    const response = await fetch(url);
    const data = await response.json();
    console.log('OSRM response:', data.code, data.message || '');

    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
        return {
            distanceKm: data.routes[0].distance / 1000,
            durationMin: Math.round(data.routes[0].duration / 60),
            points: data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }))
        };
    }
    throw new Error(data.message || 'No route found');
}

// Helper: reverse geocode coordinates to a human-friendly address
const reverseGeocodeCoords = async (lat, lng) => {
    try {
        const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
            headers: { 'User-Agent': 'BikerApp/1.0' }
        });
        const data = await res.json();
        if (data.display_name) {
            // Build a cleaner label
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

const RouteSelectionScreen = ({ navigation, route }) => {
    const theme = useTheme();
    const fromLabel = route?.params?.fromLabel;
    const [from, setFrom] = useState(fromLabel || 'Current Location');
    const [to, setTo] = useState(route?.params?.initialQuery || '');
    const [recentLocations, setRecentLocations] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pinMode, setPinMode] = useState(false);
    const [pinnedLocation, setPinnedLocation] = useState(null);
    const inputRef = useRef(null);

    const pickup = route?.params?.pickup;
    const serviceType = route?.params?.serviceType || 'bike';
    const initialQuery = route?.params?.initialQuery;
    const selectedCoords = route?.params?.selectedCoords;
    const isFoodMode = route?.params?.isFoodMode;
    // Derived header title for the top bar
    const headerTitle = serviceType === 'courier' ? 'Send a package' : isFoodMode ? 'Food delivery' : 'Where to?';


    // Handle place selection (refactored to avoid hooks inside this function)
    const handlePlaceSelection = async (place) => {
        const isCourierMode = serviceType === 'courier';

        // Build destination payload from the provided place
        const destination = {
            label: place?.label || place?.name,
            lat: place?.lat,
            lng: place?.lng,
            placeId: place?.placeId || place?.id,
        };

        if (!destination || destination.lat == null || destination.lng == null) {
            // Fallback to simple text input if coordinates are missing
            setTo(destination?.label || '');
            return;
        }

        // If we want a nicer label, try reverse geocoding to enrich the destination
        try {
            const addr = await reverseGeocodeCoords(destination.lat, destination.lng);
            const label = addr?.short || destination.label;
            const fullLabel = addr?.full || destination.label;
            handleRouteSelection({ label, fullLabel, lat: destination.lat, lng: destination.lng, placeId: destination.placeId });
        } catch (e) {
            // Fallback path if geocoding fails
            handleRouteSelection({ label: destination.label, fullLabel: destination.label, lat: destination.lat, lng: destination.lng, placeId: destination.placeId });
        }
    };
    // Initialize from label when provided via navigation params
    useEffect(() => {
        if (typeof fromLabel === 'string' && fromLabel.trim().length > 0) {
            setFrom(fromLabel);
        }
    }, [fromLabel]);

    // If a pre-selected coordinate was provided, resolve its address and route
    useEffect(() => {
        if (selectedCoords?.lat && selectedCoords?.lng) {
            reverseGeocodeCoords(selectedCoords.lat, selectedCoords.lng).then(addressData => {
                const label = addressData?.short || 'Pinned Location';
                const fullLabel = addressData?.full || 'Location selected on map';
                handleRouteSelection({ label, fullLabel, lat: selectedCoords.lat, lng: selectedCoords.lng });
            });
        }
    }, [selectedCoords]);

    useEffect(() => {
        if (typeof initialQuery === 'string' && initialQuery.length > 0) {
            setTo(initialQuery);
        }
    }, [initialQuery]);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const savedHistory = await AsyncStorage.getItem('search_history');
            if (savedHistory) {
                setRecentLocations(JSON.parse(savedHistory));
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    };

    const saveToHistory = async (destination) => {
        try {
            const label = destination?.label || destination?.name;
            if (!label) return;
            const newHistory = [
                {
                    id: destination?.placeId || Date.now().toString(),
                    placeId: destination?.placeId,
                    label,
                    lat: destination?.lat,
                    lng: destination?.lng,
                    city: 'Recently added',
                },
                ...recentLocations.filter((item) => (item.label || item.name) !== label),
            ].slice(0, 5);
            setRecentLocations(newHistory);
            await AsyncStorage.setItem('search_history', JSON.stringify(newHistory));
        } catch (error) {
            console.error('Error saving history:', error);
        }
    };

    const clearHistory = async () => {
        try {
            await AsyncStorage.removeItem('search_history');
            setRecentLocations([]);
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    };

    const handleRouteSelection = async (destination) => {
        if (!destination || typeof destination !== 'object') {
            Alert.alert('Select a destination from suggestions.');
            return;
        }
        if (!pickup?.lat || !pickup?.lng) {
            alert('Pickup location not ready. Go back and try again.');
            return;
        }
        if (destination.lat == null || destination.lng == null) {
            alert('Select a destination with coordinates.');
            return;
        }

        // Set loading state
        let routeData = {
            from: from,
            to: destination.label,
            pickupLat: pickup.lat,
            pickupLng: pickup.lng,
            dropoff: { lat: destination.lat, lng: destination.lng, label: destination.label },
            serviceType,
            priceCents: 100,
            distanceKm: 1,
            etaMinutes: 10,
            currency: '$',
            points: null,
            isFoodMode: isFoodMode,
            foodKind: isFoodMode ? route?.params?.foodKind : undefined
        };

        // Get OSRM route directly (no backend needed)
        let routeSuccess = false;

        try {
            const roadRoute = await getRoadRoute(pickup.lat, pickup.lng, destination.lat, destination.lng);

            if (roadRoute) {
                routeData.distanceKm = roadRoute.distanceKm || 1;
                routeData.etaMinutes = roadRoute.durationMin || 10;
                routeData.points = roadRoute.points;
                routeSuccess = true;
            }
        } catch (e) {
            console.log('Directions error:', e.message);
            Alert.alert('Error', 'Could not find road route. Please check your internet connection.');
            setLoading(false);
            return;
        }

        if (!routeSuccess) {
            Alert.alert('Error', 'Could not find road route. Please try again.');
            setLoading(false);
            return;
        }

        // Calculate price using formula: price = distance_km / 1.3 (no backend needed)
        const priceDollars = routeData.distanceKm / 1.3;
        const priceCents = Math.round(priceDollars * 100);
        const minFareCents = 100;
        routeData.priceCents = Math.max(minFareCents, priceCents);

        // Update route data globally
        global.selectedRouteData = routeData;

        // Navigate back to HomeScreen with valid route data
        // RouteSelection and Home are siblings in MainAppStack, so direct navigate works.
        navigation.navigate('Home', { selectedRoute: routeData });

        // Save draft order
        try {
            const draftRes = await SheetService.upsertDraft({
                pickupLat: pickup.lat,
                pickupLng: pickup.lng,
                pickupAddress: from,
                dropoffLat: destination.lat,
                dropoffLng: destination.lng,
                dropoffAddress: destination.label,
                serviceType,
                estimatedPriceCents: routeData.priceCents,
                distanceKm: routeData.distanceKm,
                etaMinutes: routeData.etaMinutes,
            });
            if (draftRes?.success === false) {
                console.log('Draft save failed:', draftRes.message);
            }
        } catch (e) {
            console.log('Draft save error:', e);
        }

        setLoading(false);
    };

    /**
     * Enhanced local search - searches nearby places as user types
     */
    useEffect(() => {
        let active = true;
        let searchTimeout;

        const searchPlaces = async (query) => {
            const q = query.trim();
            if (q.length < 1) {
                setSuggestions([]);
                return;
            }
            setLoading(true);

            // Get user's current location center for local search
            const centerLat = pickup?.lat || route?.params?.location?.latitude || -17.8;
            const centerLng = pickup?.lng || route?.params?.location?.longitude || 31.0;

            // Small viewbox for local results (~15km radius)
            const viewboxSize = 0.15;
            const viewbox = `${centerLng - viewboxSize},${centerLat + viewboxSize},${centerLng + viewboxSize},${centerLat - viewboxSize}`;

            let allResults = [];

            // Search queries to get local results
            try {
                const params = new URLSearchParams({
                    q: q,
                    format: 'json',
                    limit: '15',
                    addressdetails: '1',
                    'accept-language': 'en',
                    viewbox: viewbox,
                    bounded: '0',
                    countrycodes: 'zw',
                });

                const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
                    headers: { 'User-Agent': 'BikerApp/1.0' }
                });
                const data = await res.json();

                if (Array.isArray(data) && active) {
                    allResults = data.map(place => {
                        const addr = place.address || {};
                        const category = place.class || place.type || 'place';

                        // Build readable label
                        let label = '';
                        if (addr.house_number) label += addr.house_number + ' ';
                        label += addr.road || addr.street || place.display_name?.split(',')[0] || q;

                        // Add suburb/city if available
                        const city = addr.suburb || addr.neighbourhood || addr.city || addr.town || addr.village;
                        if (city && !label.includes(city)) label += ', ' + city;

                        return {
                            placeId: place.place_id?.toString(),
                            label: label.trim(),
                            fullLabel: place.display_name,
                            lat: parseFloat(place.lat),
                            lng: parseFloat(place.lon),
                            type: place.type,
                            category: category,
                            city: city,
                            importance: place.importance || 0,
                        };
                    });
                }
            } catch (e) {
                console.log('Search error:', e.message);
            }

            if (active) {
                // Remove duplicates and sort by distance to pickup location
                const seen = new Map();
                allResults.forEach(item => {
                    const key = `${item.lat?.toFixed(4)},${item.lng?.toFixed(4)}`;
                    if (!seen.has(key) || (seen.get(key).importance || 0) < (item.importance || 0)) {
                        seen.set(key, item);
                    }
                });

                // Sort by distance to user location
                const results = Array.from(seen.values()).sort((a, b) => {
                    const distA = Math.sqrt(Math.pow(a.lat - centerLat, 2) + Math.pow(a.lng - centerLng, 2));
                    const distB = Math.sqrt(Math.pow(b.lat - centerLat, 2) + Math.pow(b.lng - centerLng, 2));
                    return distA - distB;
                });

                setSuggestions(results.slice(0, 15));
                setLoading(false);
            }
        };

        // Debounce search - 300ms delay
        searchTimeout = setTimeout(() => searchPlaces(to), 300);

        return () => {
            active = false;
            clearTimeout(searchTimeout);
        };
    }, [to, pickup?.lat, pickup?.lng]);

    const renderRecentLocation = ({ item }) => (
        <TouchableOpacity
            style={[styles.recentItem, { borderBottomColor: theme.colors.outline }]}
            onPress={() => {
                const label = item.label || item.name;
                if (item.lat != null && item.lng != null) {
                    handleRouteSelection({
                        label,
                        lat: Number(item.lat),
                        lng: Number(item.lng),
                        placeId: item.placeId || item.id,
                    });
                    return;
                }
                setTo(label || '');
            }}
        >
            <IconButton icon={bi('history')} size={24} iconColor={theme.colors.secondaryText} />
            <View style={styles.locationTextContainer}>
                <Text style={[styles.locationName, { color: theme.colors.text }]}>{item.label || item.name}</Text>
                <Text style={[styles.locationCity, { color: theme.colors.secondaryText }]}>{item.city}</Text>
            </View>
        </TouchableOpacity>
    );

    const getCategoryIcon = (category, type) => {
        const cat = (category || type || '').toLowerCase();

        // Amenities
        if (cat.includes('school') || cat.includes('college') || cat.includes('university')) return 'school';
        if (cat.includes('church') || cat.includes('chapel') || cat.includes('mosque') || cat.includes('temple') || cat.includes('religion')) return 'church';
        if (cat.includes('bar') || cat.includes('restaurant') || cat.includes('cafe') || cat.includes('food')) return 'food';
        if (cat.includes('shop') || cat.includes('store') || cat.includes('market') || cat.includes('supermarket')) return 'shopping';
        if (cat.includes('hospital') || cat.includes('clinic') || cat.includes('pharmacy') || cat.includes('doctor')) return 'hospital';
        if (cat.includes('bank') || cat.includes('atm')) return 'bank';
        if (cat.includes('hotel') || cat.includes('guesthouse') || cat.includes('lodge')) return 'bed';
        if (cat.includes('park') || cat.includes('garden')) return 'tree';
        if (cat.includes('gym') || cat.includes('fitness') || cat.includes('sports')) return 'dumbbell';
        if (cat.includes('fuel') || cat.includes('gas')) return 'gas-station';
        if (cat.includes('parking')) return 'parking';

        // Roads & highways
        if (cat.includes('road') || cat.includes('street') || cat.includes('highway') || cat.includes('avenue') || cat.includes('lane')) return 'road-variant';
        if (cat.includes('residential')) return 'home';

        // Buildings
        if (cat.includes('building') || cat.includes('commercial') || cat.includes('office')) return 'office-building';
        if (cat.includes('house') || cat.includes('residential')) return 'home';

        // Default
        if (cat.includes('amenity')) return 'store';
        if (cat.includes('highway')) return 'road';
        if (cat.includes('place')) return 'city';
        return 'map-marker';
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <IconButton
                    icon={bi('close')}
                    size={28}
                    onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainApp')}
                    iconColor={theme.colors.text}
                />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{headerTitle}</Text>
                <View style={{ width: 48 }} />
            </View>
            <View style={styles.content}>
                <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, zIndex: 1 }]}>
                    <View style={styles.inputRow}>
                        <View style={styles.dotContainer}>
                            <View style={[styles.greenRing, { borderColor: theme.colors.secondary }]}>
                                <View style={[styles.greenDot, { backgroundColor: theme.colors.secondary }]} />
                            </View>
                            <View style={styles.dashedLine} />
                            <View style={[styles.blackSquare, { backgroundColor: theme.colors.primary }]} />
                        </View>
                        <View style={styles.inputsWrapper}>
                            <View style={styles.inputBox}>
                                <Text style={[styles.label, { color: theme.colors.secondaryText }]}>From</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.colors.text }]}
                                    value={from}
                                    onChangeText={setFrom}
                                    placeholder="Pickup point"
                                    placeholderTextColor={theme.colors.placeholder}
                                />
                            </View>
                            <Divider style={{ backgroundColor: theme.colors.outline }} />
                            <View style={[styles.inputBoxActive, { height: 50 }]}>
                                <IconButton icon={bi('magnify')} size={20} style={styles.searchIcon} iconColor={theme.colors.placeholder} />
                                <TextInput
                                    ref={inputRef}
                                    style={[styles.input, { color: theme.colors.text, flex: 1 }]}
                                    value={to}
                                    onChangeText={(text) => { setTo(text); }}
                                    placeholder="Search for a destination..."
                                    placeholderTextColor={theme.colors.placeholder}
                                    autoFocus
                                    returnKeyType="search"
                                    onSubmitEditing={() => {
                                        if (suggestions?.[0]) handleRouteSelection(suggestions[0]);
                                        else alert('Pick a destination from suggestions.');
                                    }}
                                />
                                {loading && (
                                    <ActivityIndicator size="small" color={theme.colors.secondary} style={{ marginRight: 8 }} />
                                )}
                                {to.length > 0 && !loading && (
                                    <IconButton
                                        icon={bi('close-circle')}
                                        size={18}
                                        iconColor={theme.colors.secondaryText}
                                        style={{ margin: 0 }}
                                        onPress={() => { setTo(''); setSuggestions([]); }}
                                    />
                                )}
                            </View>
                        </View>
                    </View>
                </View>

                {/* Suggestions */}
                {suggestions.length > 0 && (
                    <View style={{ marginHorizontal: 15, marginTop: 4, backgroundColor: theme.colors.surface, borderRadius: 12, overflow: 'hidden', maxHeight: 360 }}>
                        {suggestions.map((s, idx) => (
                            <TouchableOpacity
                                key={s.placeId || `s-${idx}`}
                                onPress={() => handleRouteSelection(s)}
                                style={[styles.recentItem, { borderBottomColor: theme.colors.outline }]}
                            >
                                <IconButton
                                    icon={bi(getCategoryIcon(s.category, s.type))}
                                    size={22}
                                    iconColor={theme.colors.primary}
                                    style={{ margin: 0, marginRight: 4 }}
                                />
                                <View style={styles.locationTextContainer}>
                                    <Text style={[styles.locationName, { color: theme.colors.text }]} numberOfLines={1}>
                                        {s.label}
                                    </Text>
                                    <Text style={[styles.locationCity, { color: theme.colors.secondaryText }]} numberOfLines={1}>
                                        {s.fullLabel || 'Tap to set destination'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Pin location hint - always visible */}
                <TouchableOpacity
                    style={styles.pinHintButton}
                    onPress={() => navigation.goBack()}
                >
                    <IconButton icon={bi('map-marker-plus')} size={18} iconColor="#00C853" style={{ margin: 0 }} />
                    <Text style={styles.pinHintText}>Long-press map to pin location</Text>
                </TouchableOpacity>

                {/* No results hint */}
                {!loading && to.length > 2 && suggestions.length === 0 && (
                    <View style={styles.noResultsBox}>
                        <IconButton icon={bi('map-search-outline')} size={32} iconColor="#555" />
                        <Text style={{ color: '#555', textAlign: 'center', fontSize: 13 }}>
                            No results for "{to}".{'\n'}Try a street name, suburb, or city.
                        </Text>
                        <TouchableOpacity
                            style={styles.pinButton}
                            onPress={() => navigation.goBack()}
                        >
                            <IconButton icon={bi('map-marker-radius')} size={20} iconColor="#fff" style={{ margin: 0 }} />
                            <Text style={styles.pinButtonText}>Select on Map</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Recent Locations header */}
                {recentLocations.length > 0 && suggestions.length === 0 && (
                    <View style={styles.historyHeader}>
                        <Text style={[styles.historyTitle, { color: theme.colors.secondaryText }]}>Recent Locations</Text>
                        <TouchableOpacity onPress={clearHistory}>
                            <Text style={styles.clearText}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <FlatList
                    data={suggestions.length > 0 ? [] : recentLocations}
                    renderItem={renderRecentLocation}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    keyboardShouldPersistTaps="handled"
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginTop: 20,
        marginBottom: 10,
    },
    historyTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    clearText: {
        fontSize: 14,
        color: '#E74C3C',
        fontWeight: 'bold',
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 10,
        elevation: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    inputContainer: {
        margin: 15,
        borderRadius: 16,
        padding: 5,
        elevation: 4,
    },
    inputRow: {
        flexDirection: 'row',
    },
    dotContainer: {
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 15,
        paddingBottom: 15,
    },
    greenRing: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    greenDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dashedLine: {
        width: 1,
        height: 30,
        backgroundColor: '#333333',
        marginVertical: 4,
    },
    blackSquare: {
        width: 10,
        height: 10,
    },
    inputsWrapper: {
        flex: 1,
    },
    inputBox: {
        paddingHorizontal: 10,
        paddingVertical: 12,
    },
    inputBoxActive: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 2,
    },
    label: {
        fontSize: 12,
        marginBottom: 4,
    },
    input: {
        fontSize: 16,
        paddingVertical: 2,
    },
    searchIcon: {
        margin: 0,
        backgroundColor: 'transparent',
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    locationTextContainer: {
        flex: 1,
        justifyContent: 'center',
        marginLeft: 14,
    },
    locationName: {
        fontSize: 16,
        fontWeight: '500',
    },
    locationCity: {
        fontSize: 12,
        marginTop: 2,
    },
    list: {
        paddingBottom: 20,
    },
    noResultsBox: {
        alignItems: 'center',
        marginTop: 40,
        paddingHorizontal: 30,
    },
    pinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00C853',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        marginTop: 15,
    },
    pinButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 5,
    },
    pinHintButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 200, 83, 0.15)',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        marginHorizontal: 15,
        marginBottom: 10,
    },
    pinHintText: {
        color: '#00C853',
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 5,
    },
});

export default RouteSelectionScreen;
