import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Text, IconButton, Surface, useTheme, Avatar, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import SheetService from '../api/SheetService';

// ─── helpers ────────────────────────────────────────────────────────────────

const statusColor = (status, theme) => {
    switch (String(status).toLowerCase()) {
        case 'completed': return theme.colors.secondary;   // green
        case 'pending': return theme.colors.warning;     // amber
        case 'cancelled': return theme.colors.error;       // red
        default: return theme.colors.primary;
    }
};

const feeStatusColor = (status, theme) => {
    switch (String(status).toLowerCase()) {
        case 'paid': return theme.colors.secondary;
        case 'overdue': return theme.colors.error;
        default: return theme.colors.warning;
    }
};

// ─── stat card ──────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, accentColor, theme }) => (
    <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={[styles.statIconWrap, { backgroundColor: accentColor + '20' }]}>
            <Avatar.Icon
                size={40}
                icon={icon}
                backgroundColor="transparent"
                color={accentColor}
                style={{ margin: 0 }}
            />
        </View>
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.colors.secondaryText }]}>{label}</Text>
    </Surface>
);

// ─── order row ──────────────────────────────────────────────────────────────

const OrderRow = ({ item, theme }) => {
    const color = statusColor(item.status, theme);
    return (
        <Surface style={[styles.listCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.listCardRow}>
                <Avatar.Icon
                    size={36}
                    icon="package-variant-closed"
                    backgroundColor={theme.colors.primary + '20'}
                    color={theme.colors.primary}
                    style={{ margin: 0 }}
                />
                <View style={styles.listCardContent}>
                    <Text style={[styles.listCardId, { color: theme.colors.text }]}>
                        Order #{item.id}
                    </Text>
                    {item.dropoffAddress ? (
                        <Text
                            style={[styles.listCardSub, { color: theme.colors.secondaryText }]}
                            numberOfLines={1}
                        >
                            {item.dropoffAddress}
                        </Text>
                    ) : null}
                </View>
                <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.badgeText, { color }]}>
                        {String(item.status).toUpperCase()}
                    </Text>
                </View>
            </View>
        </Surface>
    );
};

// ─── call row ───────────────────────────────────────────────────────────────

const CallRow = ({ item, theme }) => {
    const isMissed = String(item.type).toLowerCase() === 'missed';
    const icon = item.type === 'incoming' ? 'phone-incoming' : item.type === 'outgoing' ? 'phone-outgoing' : 'phone-missed';
    const iconColor = isMissed ? theme.colors.error : theme.colors.primary;

    return (
        <Surface style={[styles.listCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.listCardRow}>
                <Avatar.Icon
                    size={36}
                    icon={icon}
                    backgroundColor={iconColor + '20'}
                    color={iconColor}
                    style={{ margin: 0 }}
                />
                <View style={styles.listCardContent}>
                    <Text style={[styles.listCardId, { color: theme.colors.text }]}>
                        {item.name || item.phoneNumber || 'Unknown'}
                    </Text>
                    <Text style={[styles.listCardSub, { color: theme.colors.secondaryText }]}>
                        {item.phoneNumber} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: (isMissed ? theme.colors.error : theme.colors.secondary) + '20' }]}>
                    <Text style={[styles.badgeText, { color: isMissed ? theme.colors.error : theme.colors.secondary }]}>
                        {item.duration || (isMissed ? 'MISSED' : '0:00')}
                    </Text>
                </View>
            </View>
        </Surface>
    );
};

// ─── fee row ────────────────────────────────────────────────────────────────

const FeeRow = ({ item, theme }) => {
    const color = feeStatusColor(item.feeStatus, theme);
    return (
        <Surface style={[styles.listCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.listCardRow}>
                <Avatar.Icon
                    size={36}
                    icon="cash-multiple"
                    backgroundColor={theme.colors.secondary + '20'}
                    color={theme.colors.secondary}
                    style={{ margin: 0 }}
                />
                <View style={styles.listCardContent}>
                    <Text style={[styles.listCardId, { color: theme.colors.text }]}>
                        {item.description || item.feeStatus || 'Fee'}
                    </Text>
                    {item.feeStatus ? (
                        <Text style={[styles.listCardSub, { color: theme.colors.secondaryText }]}>
                            Status: {item.feeStatus}
                        </Text>
                    ) : null}
                </View>
                {item.amount != null && (
                    <Text style={[styles.feeAmount, { color: theme.colors.text }]}>
                        ${(item.amount / 100).toFixed(2)}
                    </Text>
                )}
                <View style={[styles.badge, { backgroundColor: color + '20', marginLeft: 8 }]}>
                    <Text style={[styles.badgeText, { color }]}>
                        {String(item.feeStatus || 'PENDING').toUpperCase()}
                    </Text>
                </View>
            </View>
        </Surface>
    );
};

// ─── section header ─────────────────────────────────────────────────────────

const SectionHeader = ({ title, count, theme }) => (
    <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
        {count != null && (
            <View style={[styles.countBubble, { backgroundColor: theme.colors.primary + '20' }]}>
                <Text style={[styles.countText, { color: theme.colors.primary }]}>{count}</Text>
            </View>
        )}
    </View>
);

// ─── main screen ────────────────────────────────────────────────────────────

const DashboardScreen = ({ navigation }) => {
    const theme = useTheme();
    const [stats, setStats] = useState({});
    const [orders, setOrders] = useState([]);
    const [fees, setFees] = useState([]);
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(false); // start false to show UI immediately
    const [refreshing, setRefreshing] = useState(false);

    const user = SheetService.currentUser || {};

    const loadData = useCallback(async () => {
        if (!user?.id) { setLoading(false); return; }

        // Fetch each independently so they update the UI as they arrive
        const p1 = SheetService.dashboardInit({ lat: 0, lng: 0, radiusKm: 0 }, { timeout: 8000 })
            .then(res => setStats(res?.data?.stats || {}))
            .catch(() => console.warn('[Dashboard] stats failed'));

        const p2 = SheetService.getBikerOrders(user.id, { timeout: 8000 })
            .then(res => {
                // Backend might return { success: true, data: { orders: [...] } } 
                // or sometimes { success: true, data: [...] }
                const data = res?.data;
                const ordersArray = Array.isArray(data) ? data : (Array.isArray(data?.orders) ? data.orders : []);
                setOrders(ordersArray);
            })
            .catch(() => { console.warn('[Dashboard] orders failed'); setOrders([]); });

        const p3 = SheetService.getBikerFees(user.id, { timeout: 8000 })
            .then(res => {
                const data = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.fees) ? res.data.fees : []));
                setFees(data);
            })
            .catch(() => { console.warn('[Dashboard] fees failed'); setFees([]); });

        const p4 = SheetService.getCallHistory(user.id, { timeout: 8000 })
            .then(res => {
                const data = res?.data;
                setCalls(Array.isArray(data) ? data : []);
            })
            .catch(() => { console.warn('[Dashboard] calls failed'); setCalls([]); });

        Promise.allSettled([p1, p2, p3, p4]).finally(() => {
            setLoading(false);
            setRefreshing(false);
        });
    }, [user?.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const onRefresh = () => { setRefreshing(true); loadData(); };

    // ── aggregate for earnings ──
    const safeFees = Array.isArray(fees) ? fees : [];
    const safeCalls = Array.isArray(calls) ? calls : [];
    const totalEarnings = safeFees
        .filter(f => String(f.feeStatus).toLowerCase() === 'paid')
        .reduce((sum, f) => sum + (f.amount || 0), 0);

    const safeOrders = Array.isArray(orders) ? orders : [];
    const completedOrders = safeOrders.filter(o => String(o.status).toLowerCase() === 'completed').length;
    const pendingOrders = safeOrders.filter(o => ['pending', 'assigned', 'picked_up', 'in_transit'].includes(String(o.status).toLowerCase())).length;
    const cancelledOrders = safeOrders.filter(o => String(o.status).toLowerCase() === 'cancelled').length;
    const totalOrders = safeOrders.length;

    // ── greeting ──
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

    // ── flat-list data structure ──
    const sections = [
        { type: 'header' },
        { type: 'stats' },
        { type: 'sectionLabel', id: 'orders-label', title: 'Recent Orders', count: totalOrders },
        ...(safeOrders.length > 0
            ? safeOrders.slice(0, 5).map(o => ({ type: 'order', ...o, key: `order-${o.id}` }))
            : [{ type: 'empty', id: 'no-orders', message: 'No orders yet', icon: 'package-variant-closed' }]
        ),
        { type: 'sectionLabel', id: 'calls-label', title: 'Call History', count: safeCalls.length },
        ...(safeCalls.length > 0
            ? safeCalls.slice(0, 5).map(c => ({ type: 'call', ...c, key: `call-${c.id}` }))
            : [{ type: 'empty', id: 'no-calls', message: 'No call history', icon: 'phone' }]
        ),
        { type: 'sectionLabel', id: 'fees-label', title: 'Fees', count: safeFees.length },
        ...(safeFees.length > 0
            ? safeFees.slice(0, 5).map(f => ({ type: 'fee', ...f, key: `fee-${f.id || f.feeId}` }))
            : [{ type: 'empty', id: 'no-fees', message: 'No fees on record', icon: 'cash-multiple' }]
        ),
        { type: 'accountActions' },
        { type: 'footer' },
    ];

    const renderItem = ({ item }) => {
        switch (item.type) {
            case 'header':
                return (
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={[styles.greeting, { color: theme.colors.secondaryText }]}>{greeting}</Text>
                            <Text style={[styles.userName, { color: theme.colors.text }]}>{user.name || 'Driver'}</Text>
                        </View>
                        <View style={styles.headerIcons}>
                            {navigation && (
                                <>
                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('Notifications')}
                                        style={[styles.headerIconBtn, { backgroundColor: theme.colors.surface }]}
                                    >
                                        <IconButton icon="bell-outline" size={22} iconColor={theme.colors.text} style={{ margin: 0 }} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('ProfileSettings')}
                                        style={[styles.headerIconBtn, { backgroundColor: theme.colors.surface, marginLeft: 8 }]}
                                    >
                                        {user.photo ? (
                                            <Avatar.Image size={36} source={{ uri: user.photo }} />
                                        ) : (
                                            <Avatar.Text
                                                size={36}
                                                label={(user.name || 'D')[0].toUpperCase()}
                                                backgroundColor={theme.colors.primary}
                                                color="#fff"
                                            />
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                );

            case 'stats':
                return (
                    <View style={styles.statsGrid}>
                        <StatCard
                            icon="check-circle-outline"
                            label="Completed"
                            value={completedOrders}
                            accentColor={theme.colors.secondary}
                            theme={theme}
                        />
                        <StatCard
                            icon="clock-outline"
                            label="Pending"
                            value={pendingOrders}
                            accentColor={theme.colors.warning}
                            theme={theme}
                        />
                        <StatCard
                            icon="close-circle-outline"
                            label="Cancelled"
                            value={cancelledOrders}
                            accentColor={theme.colors.error}
                            theme={theme}
                        />
                        <StatCard
                            icon="motorbike"
                            label="Total Trips"
                            value={totalOrders}
                            accentColor={theme.colors.primary}
                            theme={theme}
                        />
                        <StatCard
                            icon="cash"
                            label="Earnings"
                            value={`$${(totalEarnings / 100).toFixed(0)}`}
                            accentColor="#F1C40F"
                            theme={theme}
                        />
                    </View>
                );

            case 'sectionLabel':
                return (
                    <>
                        <Divider style={{ backgroundColor: theme.colors.outline, marginVertical: 8 }} />
                        <SectionHeader title={item.title} count={item.count} theme={theme} />
                    </>
                );

            case 'order':
                return <OrderRow item={item} theme={theme} />;

            case 'call':
                return <CallRow item={item} theme={theme} />;

            case 'fee':
                return <FeeRow item={item} theme={theme} />;

            case 'empty':
                return (
                    <Surface style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]} elevation={0}>
                        <Avatar.Icon
                            size={40}
                            icon={item.icon}
                            backgroundColor={theme.colors.outline + '30'}
                            color={theme.colors.secondaryText}
                            style={{ margin: 0 }}
                        />
                        <Text style={[styles.emptyText, { color: theme.colors.secondaryText }]}>{item.message}</Text>
                    </Surface>
                );

            case 'accountActions':
                return (
                    <View style={styles.accountActions}>
                        <Divider style={{ backgroundColor: theme.colors.outline, marginVertical: 8 }} />
                        <TouchableOpacity
                            onPress={() => {
                                Alert.alert(
                                    'Delete Account',
                                    'Are you sure you want to delete your account? This action is permanent and cannot be undone.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: async () => {
                                                const res = await SheetService.deleteAccount(user.id);
                                                if (res?.success) navigation.replace('Login');
                                            }
                                        }
                                    ]
                                );
                            }}
                            style={[styles.deleteBtn, { borderColor: theme.colors.error }]}
                        >
                            <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>DELETE ACCOUNT</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'footer':
                return <View style={{ height: 24 }} />;

            default:
                return null;
        }
    };

    // removed full screen loading indicator to keep UI snappy

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <FlatList
                data={sections}
                keyExtractor={(item, idx) => item.key || item.id || item.type + idx}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.primary}
                        colors={[theme.colors.primary]}
                    />
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    list: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 32, // avoid collision with system navigation
    },

    // ── header ──
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        fontSize: 13,
        fontWeight: '500',
    },
    userName: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 2,
    },
    headerIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIconBtn: {
        borderRadius: 20,
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },

    // ── stats ──
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 8,
    },
    statCard: {
        width: '47%',
        borderRadius: 16,
        padding: 16,
        alignItems: 'flex-start',
        gap: 8,
    },
    statIconWrap: {
        borderRadius: 12,
        padding: 6,
    },
    statValue: {
        fontSize: 26,
        fontWeight: 'bold',
        marginTop: 4,
    },
    statLabel: {
        fontSize: 13,
        fontWeight: '500',
    },

    // ── section header ──
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 12,
        gap: 8,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    countBubble: {
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    countText: {
        fontSize: 12,
        fontWeight: 'bold',
    },

    // ── list cards ──
    listCard: {
        borderRadius: 14,
        marginBottom: 10,
        padding: 14,
    },
    listCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    listCardContent: {
        flex: 1,
    },
    listCardId: {
        fontSize: 14,
        fontWeight: '600',
    },
    listCardSub: {
        fontSize: 12,
        marginTop: 2,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    feeAmount: {
        fontSize: 15,
        fontWeight: 'bold',
    },

    // ── empty state ──
    emptyCard: {
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },

    // ── loading ──
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 15,
    },
    accountActions: {
        marginTop: 20,
        marginBottom: 10,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    deleteBtn: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
    },
});

export default DashboardScreen;
