import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text, IconButton, Surface, useTheme, Avatar, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import SheetService from '../api/SheetService';
import { bi } from '../components/AppIcon';

const RequestHistoryScreen = ({ navigation }) => {
    const theme = useTheme();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const res = await SheetService.getOrderHistory();
        const orders = res?.data?.orders || [];
        const userRole = SheetService.currentUser?.role;
        const mapped = orders.map((o) => {
            const drop = o?.dropoffLocation?.coordinates;
            const dropoff = drop && drop.length >= 2 ? { lng: Number(drop[0]), lat: Number(drop[1]) } : null;

            // Link back-to-back: show customer if I'm a biker, show biker if I'm a customer
            const otherParty = userRole === 'biker'
                ? (o?.customer?.user?.name || o?.customer?.name || 'Customer')
                : (o?.biker?.user?.name || o?.biker?.name || 'Driver');

            return {
                id: String(o.id),
                date: new Date(o.createdAt).toLocaleString(),
                from: o.pickupAddress || 'Pickup',
                to: o.dropoffAddress || 'Destination',
                price: o.finalPriceCents != null ? `$${(o.finalPriceCents / 100).toFixed(2)}` : `$${(o.suggestedPriceCents / 100).toFixed(2)}`,
                status: o.status,
                otherParty,
                dropoff,
                serviceType: o.serviceType,
            };
        });
        setHistory(mapped);
        setLoading(false);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return theme.colors.secondary;
            case 'cancelled':
                return theme.colors.error;
            default:
                return theme.colors.primary;
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
                if (!item.dropoff) return;
                navigation.navigate('MainApp', {
                    screen: 'HomeDrawer',
                    params: {
                        screen: 'Home',
                        params: {
                            reorder: {
                                name: item.to,
                                lat: item.dropoff.lat,
                                lng: item.dropoff.lng,
                                serviceType: item.serviceType,
                            },
                        },
                    },
                });
            }}
        >
            <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
                {/* Header: Date & Price */}
                <View style={styles.cardHeader}>
                    <Text style={[styles.date, { color: theme.colors.secondaryText }]}>{item.date}</Text>
                    <Text style={[styles.price, { color: theme.colors.text }]}>{item.price}</Text>
                </View>

                <Divider style={{ marginVertical: 12, backgroundColor: theme.colors.outline }} />

                {/* Route Info */}
                <View style={styles.routeContainer}>
                    <View style={styles.timeline}>
                        <View style={[styles.dot, { backgroundColor: theme.colors.secondary }]} />
                        <View style={[styles.line, { backgroundColor: theme.colors.outline }]} />
                        <View style={[styles.square, { backgroundColor: theme.colors.primary }]} />
                    </View>
                    <View style={styles.locations}>
                        <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>{item.from}</Text>
                        <View style={{ height: 16 }} />
                        <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>{item.to}</Text>
                    </View>
                </View>

                <Divider style={{ marginVertical: 12, backgroundColor: theme.colors.outline }} />

                {/* Footer: Other Party & Status */}
                <View style={styles.cardFooter}>
                    <View style={styles.bikerInfo}>
                        <Avatar.Icon
                            size={24}
                            icon={bi(SheetService.currentUser?.role === 'biker' ? 'account' : 'motorbike')}
                            backgroundColor={theme.colors.surfaceVariant}
                            color={theme.colors.text}
                        />
                        <Text style={[styles.bikerName, { color: theme.colors.secondaryText }]}>{item.otherParty}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{String(item.status).toUpperCase()}</Text>
                    </View>
                </View>
            </Surface>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <IconButton icon={bi('arrow-left')} size={24} onPress={() => navigation.goBack()} iconColor={theme.colors.text} />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Request History</Text>
                <View style={{ width: 48 }} />
            </View>

            <FlatList
                data={history}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={loadHistory}
            />
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
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    card: {
        borderRadius: 16,
        marginBottom: 16,
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    date: {
        fontSize: 14,
        fontWeight: '500',
    },
    price: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    routeContainer: {
        flexDirection: 'row',
    },
    timeline: {
        alignItems: 'center',
        marginRight: 12,
        paddingVertical: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    line: {
        width: 1,
        flex: 1,
        marginVertical: 4,
    },
    square: {
        width: 8,
        height: 8,
    },
    locations: {
        flex: 1,
        justifyContent: 'space-between',
    },
    locationText: {
        fontSize: 14,
        fontWeight: '500',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bikerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bikerName: {
        marginLeft: 8,
        fontSize: 14,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default RequestHistoryScreen;
