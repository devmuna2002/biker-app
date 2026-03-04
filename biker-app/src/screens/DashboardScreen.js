import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Dimensions } from 'react-native';
import { Text, IconButton, Surface, useTheme, Avatar, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import SheetService from '../api/SheetService';
import { bi } from '../components/AppIcon';

const { width } = Dimensions.get('window');

// ─── helpers ────────────────────────────────────────────────────────────────

const statusColor = (status, theme) => {
    switch (String(status).toLowerCase()) {
        case 'completed': return '#00FD3F';     // Vivid Green
        case 'pending': return theme.colors.warning;
        case 'cancelled': return '#FF4B4B';     // Vibrant Red
        case 'in_transit': return '#3498DB';    // Vivid Blue
        default: return theme.colors.primary;
    }
};

const feeStatusColor = (status, theme) => {
    switch (String(status).toLowerCase()) {
        case 'paid': return '#00FD3F';
        case 'overdue': return '#FF4B4B';
        default: return theme.colors.warning;
    }
};

// ─── header ───────────────────────────────────────────────────────────────

const HeaderSection = ({ greeting, user, navigation, theme }) => (
    <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
            <Text style={[styles.greetingText, { color: theme.colors.secondaryText }]}>{greeting}</Text>
            <Text style={[styles.userNameText, { color: theme.colors.text }]}>{user.name || 'Driver'}</Text>
        </View>
        <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.headerBtnWrap}>
                <Surface style={[styles.headerBtn, { backgroundColor: theme.colors.surface }]} elevation={2}>
                    <IconButton icon={bi('bell-outline')} size={22} iconColor={theme.colors.text} style={{ margin: 0 }} />
                </Surface>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('ProfileSettings')} style={styles.headerBtnWrap}>
                {user.photo ? (
                    <Avatar.Image size={44} source={{ uri: user.photo }} style={{ elevation: 2 }} />
                ) : (
                    <Avatar.Text
                        size={44}
                        label={(user.name || 'D')[0].toUpperCase()}
                        backgroundColor={theme.colors.primary}
                        color="#fff"
                        style={{ elevation: 2 }}
                    />
                )}
            </TouchableOpacity>
        </View>
    </View>
);

// ─── earnings banner ───────────────────────────────────────────────────────

const EarningsBanner = ({ totalEarnings, totalTrips, theme }) => (
    <Surface style={[styles.earningsBanner, { backgroundColor: theme.colors.primary }]} elevation={4}>
        <View style={styles.earningsContent}>
            <View>
                <Text style={styles.earningsLabel}>Estimated Income</Text>
                <Text style={styles.earningsValue}>
                    ${totalEarnings.toFixed(2)}
                </Text>
            </View>
            <View style={styles.earningsIconWrap}>
                <IconButton icon={bi('cash')} size={30} iconColor={theme.colors.primary} style={{ margin: 0 }} />
            </View>
        </View>
        <Divider style={{ backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 12 }} />
        <View style={styles.earningsFooter}>
            <View style={styles.earningsStat}>
                <IconButton icon={bi('motorbike')} size={16} iconColor="#FFF" style={{ margin: 0 }} />
                <Text style={styles.earningsStatText}>{totalTrips} Total Trips</Text>
            </View>
        </View>
    </Surface>
);

// ─── stat card ──────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, accentColor, theme }) => (
    <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={styles.statTop}>
            <View style={[styles.statIconWrap, { backgroundColor: accentColor + '20' }]}>
                <IconButton icon={icon} size={22} iconColor={accentColor} style={{ margin: 0 }} />
            </View>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
        </View>
        <Text style={[styles.statLabel, { color: theme.colors.secondaryText }]}>{label}</Text>
    </Surface>
);

// ─── list items ─────────────────────────────────────────────────────────────

const OrderRow = ({ item, theme }) => {
    const color = statusColor(item.status, theme);
    return (
        <Surface style={[styles.listCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.listCardRow}>
                <View style={[styles.listIconBox, { backgroundColor: color + '15' }]}>
                    <IconButton icon={bi('package-variant-closed')} size={24} iconColor={color} style={{ margin: 0 }} />
                </View>
                <View style={styles.listCardContent}>
                    <Text style={[styles.listCardId, { color: theme.colors.text }]}>Order #{item.id}</Text>
                    {item.dropoffAddress && (
                        <Text style={[styles.listCardSub, { color: theme.colors.secondaryText }]} numberOfLines={1}>
                            {item.dropoffAddress}
                        </Text>
                    )}
                </View>
                <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.badgeText, { color }]}>{String(item.status).toUpperCase()}</Text>
                </View>
            </View>
        </Surface>
    );
};

const FeeRow = ({ item, theme }) => {
    const color = feeStatusColor(item.feeStatus, theme);
    return (
        <Surface style={[styles.listCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.listCardRow}>
                <View style={[styles.listIconBox, { backgroundColor: theme.colors.secondary + '15' }]}>
                    <IconButton icon={bi('cash')} size={24} iconColor={theme.colors.secondary} style={{ margin: 0 }} />
                </View>
                <View style={styles.listCardContent}>
                    <Text style={[styles.listCardId, { color: theme.colors.text }]}>{item.description || 'Fee'}</Text>
                    <Text style={[styles.listCardSub, { color: theme.colors.secondaryText }]}>Status: {item.feeStatus}</Text>
                </View>
                {item.amount != null && (
                    <Text style={[styles.feeAmount, { color: theme.colors.text }]}>${(item.amount / 100).toFixed(2)}</Text>
                )}
            </View>
        </Surface>
    );
};

const CallRow = ({ item, theme }) => {
    const isMissed = String(item.type).toLowerCase() === 'missed';
    const icon = item.type === 'incoming' ? 'arrow-down' : item.type === 'outgoing' ? 'arrow-up' : 'close-circle';
    const iconColor = isMissed ? '#FF4B4B' : theme.colors.secondary;
    return (
        <Surface style={[styles.listCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.listCardRow}>
                <View style={[styles.listIconBox, { backgroundColor: iconColor + '15' }]}>
                    <IconButton icon={bi(icon)} size={24} iconColor={iconColor} style={{ margin: 0 }} />
                </View>
                <View style={styles.listCardContent}>
                    <Text style={[styles.listCardId, { color: theme.colors.text }]}>{item.name || item.phoneNumber || 'Unknown'}</Text>
                    <Text style={[styles.listCardSub, { color: theme.colors.secondaryText }]}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: iconColor + '20' }]}>
                    <Text style={[styles.badgeText, { color: iconColor }]}>
                        {item.duration || (isMissed ? 'MISSED' : '0:00')}
                    </Text>
                </View>
            </View>
        </Surface>
    );
};

// ─── section header ─────────────────────────────────────────────────────────

const SectionHeader = ({ title, count, actionText, onAction, theme, isToggleable, isExpanded, onToggle }) => (
    <TouchableOpacity
        onPress={isToggleable ? onToggle : undefined}
        activeOpacity={isToggleable ? 0.7 : 1}
        style={styles.sectionHeader}
    >
        <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
            {count != null && (
                <View style={[styles.countBubble, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Text style={[styles.countText, { color: theme.colors.primary }]}>{count}</Text>
                </View>
            )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {actionText && (
                <TouchableOpacity onPress={onAction}>
                    <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13, marginRight: isToggleable ? 8 : 0 }}>{actionText}</Text>
                </TouchableOpacity>
            )}
            {isToggleable && (
                <IconButton
                    icon={bi(isExpanded ? 'chevron-up' : 'chevron-down')}
                    size={20}
                    iconColor={theme.colors.secondaryText}
                    style={{ margin: 0, padding: 0, width: 24, height: 24 }}
                />
            )}
        </View>
    </TouchableOpacity>
);

// ─── main screen ────────────────────────────────────────────────────────────

const DashboardScreen = ({ navigation }) => {
    const theme = useTheme();
    const [stats, setStats] = useState({});
    const [orders, setOrders] = useState([]);
    const [fees, setFees] = useState([]);
    const [calls, setCalls] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    // Dropdown toggle states
    const [ordersExpanded, setOrdersExpanded] = useState(true);
    const [feesExpanded, setFeesExpanded] = useState(true);
    const [moreExpanded, setMoreExpanded] = useState(false);

    const user = SheetService.currentUser || {};

    const loadData = useCallback(async () => {
        if (!user?.id) return;
        Promise.allSettled([
            SheetService.dashboardInit({ lat: 0, lng: 0, radiusKm: 0 }, { timeout: 8000 }).then(r => setStats(r?.data?.stats || {})),
            SheetService.getBikerOrders(user.id, { timeout: 8000 }).then(r => setOrders(Array.isArray(r?.data) ? r.data : (r?.data?.orders || []))),
            SheetService.getBikerFees(user.id, { timeout: 8000 }).then(r => setFees(Array.isArray(r) ? r : (r?.data?.fees || []))),
            SheetService.getCallHistory(user.id, { timeout: 8000 }).then(r => setCalls(Array.isArray(r?.data) ? r.data : []))
        ]).finally(() => setRefreshing(false));
    }, [user?.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeFees = Array.isArray(fees) ? fees : [];
    const safeCalls = Array.isArray(calls) ? calls : [];

    const completedOrdersList = safeOrders.filter(o => String(o.status).toLowerCase() === 'completed');
    const completedOrders = completedOrdersList.length;
    const pendingOrders = safeOrders.filter(o => ['pending', 'assigned', 'picked_up', 'in_transit'].includes(String(o.status).toLowerCase())).length;
    const cancelledOrders = safeOrders.filter(o => String(o.status).toLowerCase() === 'cancelled').length;

    const totalEarnings = completedOrdersList.reduce((sum, o) => {
        let amt = 0;
        if (typeof o.price === 'number') amt = o.price;
        else if (typeof o.price === 'string') amt = parseFloat(o.price.replace(/[^0-9.]/g, '')) || 0;
        else if (typeof o.fare === 'number') amt = o.fare;
        else if (typeof o.fare === 'string') amt = parseFloat(o.fare.replace(/[^0-9.]/g, '')) || 0;
        return sum + amt;
    }, 0);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

    const sections = [
        { type: 'header' },
        { type: 'earnings' },
        { type: 'quickStats' },

        { type: 'sectionLabel', id: 'orders-label', title: 'Recent Orders', count: safeOrders.length, isToggleable: true, isExpanded: ordersExpanded, onToggle: () => setOrdersExpanded(!ordersExpanded) },
        ...(ordersExpanded ? (safeOrders.length ? safeOrders.slice(0, 3).map(o => ({ type: 'order', ...o, key: `o-${o.id}` })) : [{ type: 'empty', id: 'e-1', message: 'No orders yet.', icon: 'package-variant-closed' }]) : []),

        { type: 'sectionLabel', id: 'fees-label', title: 'Payment History', count: safeFees.length, isToggleable: true, isExpanded: feesExpanded, onToggle: () => setFeesExpanded(!feesExpanded) },
        ...(feesExpanded ? (safeFees.length ? safeFees.slice(0, 3).map(f => ({ type: 'fee', ...f, key: `f-${f.id || f.feeId}` })) : [{ type: 'empty', id: 'e-2', message: 'No fees processing.', icon: 'cash' }]) : []),

        { type: 'sectionLabel', id: 'more-label', title: 'More Options', count: null, isToggleable: true, isExpanded: moreExpanded, onToggle: () => setMoreExpanded(!moreExpanded) },
        ...(moreExpanded ? [{ type: 'accountActions' }] : []),

        { type: 'footer' }
    ];

    const renderItem = ({ item }) => {
        switch (item.type) {
            case 'header': return <HeaderSection greeting={greeting} user={user} navigation={navigation} theme={theme} />;
            case 'earnings': return <EarningsBanner totalEarnings={totalEarnings} totalTrips={safeOrders.length} theme={theme} />;
            case 'quickStats':
                return (
                    <View style={styles.statsRow}>
                        <StatCard icon={bi('check-circle')} label="Completed" value={completedOrders} accentColor="#00FD3F" theme={theme} />
                        <StatCard icon={bi('time')} label="Pending" value={pendingOrders} accentColor="#F39C12" theme={theme} />
                        <StatCard icon={bi('close-circle')} label="Cancelled" value={cancelledOrders} accentColor="#FF4B4B" theme={theme} />
                    </View>
                );
            case 'sectionLabel':
                return <SectionHeader title={item.title} count={item.count} actionText={item.action} onAction={() => { }} theme={theme} isToggleable={item.isToggleable} isExpanded={item.isExpanded} onToggle={item.onToggle} />;
            case 'order': return <OrderRow item={item} theme={theme} />;
            case 'fee': return <FeeRow item={item} theme={theme} />;
            case 'call': return <CallRow item={item} theme={theme} />;
            case 'empty':
                return (
                    <View style={styles.emptyWrap}>
                        <IconButton icon={bi(item.icon)} size={32} iconColor={theme.colors.outline} />
                        <Text style={[styles.emptyText, { color: theme.colors.secondaryText }]}>{item.message}</Text>
                    </View>
                );
            case 'accountActions':
                return (
                    <Surface style={[styles.listCard, { backgroundColor: theme.colors.surface, borderColor: 'rgba(255, 75, 75, 0.2)', borderWidth: 1 }]} elevation={1}>
                        <TouchableOpacity
                            onPress={() => Alert.alert('Delete Account', 'Are you completely sure? This action is permanent and erases all data.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete Forever', style: 'destructive', onPress: async () => { const r = await SheetService.deleteAccount(user.id); if (r?.success) navigation.replace('Login'); } }])}
                            style={styles.listCardRow}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.listIconBox, { backgroundColor: 'rgba(255, 75, 75, 0.15)' }]}>
                                <IconButton icon={bi('trash')} size={24} iconColor="#FF4B4B" style={{ margin: 0 }} />
                            </View>
                            <View style={styles.listCardContent}>
                                <Text style={[styles.listCardId, { color: '#FF4B4B' }]}>Delete Account</Text>
                                <Text style={[styles.listCardSub, { color: theme.colors.secondaryText }]}>Permanently erase your data</Text>
                            </View>
                            <IconButton icon={bi('chevron-right')} size={20} iconColor={theme.colors.secondaryText} style={{ margin: 0 }} />
                        </TouchableOpacity>
                    </Surface>
                );
            case 'footer': return <View style={{ height: 40 }} />;
            default: return null;
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <FlatList
                data={sections}
                keyExtractor={(item, idx) => item.key || item.id || item.type + idx}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={theme.colors.primary} />}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },

    headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 4 },
    headerLeft: { flex: 1 },
    greetingText: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    userNameText: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerBtnWrap: {},
    headerBtn: { borderRadius: 24, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

    earningsBanner: { borderRadius: 20, padding: 20, marginBottom: 24 },
    earningsContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    earningsLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginBottom: 4 },
    earningsValue: { color: '#FFF', fontSize: 38, fontWeight: '900', letterSpacing: -1 },
    earningsIconWrap: { backgroundColor: '#FFF', borderRadius: 16, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
    earningsFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    earningsStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    earningsStatText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
    earningsAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    earningsActionText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
    statCard: { flex: 1, borderRadius: 18, padding: 14 },
    statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    statIconWrap: { borderRadius: 12, padding: 2 },
    statValue: { fontSize: 22, fontWeight: '800' },
    statLabel: { fontSize: 12, fontWeight: '600' },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 16 },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
    countBubble: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
    countText: { fontSize: 12, fontWeight: '800' },

    listCard: { borderRadius: 16, marginBottom: 12, padding: 12 },
    listCardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    listIconBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    listCardContent: { flex: 1 },
    listCardId: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
    listCardSub: { fontSize: 13, fontWeight: '500' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    feeAmount: { fontSize: 16, fontWeight: '800', marginRight: 4 },

    emptyWrap: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(150,150,150,0.1)', borderStyle: 'dashed', marginBottom: 16 },
    emptyText: { fontSize: 14, fontWeight: '600', marginTop: -8 },

    deleteBtn: { marginTop: 32, borderWidth: 1, borderColor: '#FF4B4B', borderRadius: 16, padding: 16, alignItems: 'center', backgroundColor: 'rgba(255, 75, 75, 0.05)' },
});

export default DashboardScreen;
