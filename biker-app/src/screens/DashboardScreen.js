import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Dimensions } from 'react-native';
import { Text, IconButton, Surface, useTheme, Avatar, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import SheetService from '../api/SheetService';
import AppIcon, { bi } from '../components/AppIcon';

const { width } = Dimensions.get('window');

// ─── helpers ────────────────────────────────────────────────────────────────

const statusColor = (status, theme) => {
    switch (String(status).toLowerCase()) {
        case 'completed': return '#3277FF';     // Blue
        case 'pending': return '#5AC8FA';       // Light Blue
        case 'cancelled': return '#FF4B4B';     // Keep Red for cancellation
        case 'in_transit': return '#3277FF';
        default: return theme.colors.primary;
    }
};

const feeStatusColor = (status, theme) => {
    switch (String(status).toLowerCase()) {
        case 'paid': return '#3277FF';
        case 'overdue': return '#FF4B4B';
        default: return '#5AC8FA';
    }
};

// ─── header ───────────────────────────────────────────────────────────────

const HeaderSection = ({ user, theme, navigation }) => (
    <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.avatarWrap} onPress={() => navigation.navigate('Profile')}>
                {user.photo ? (
                    <Avatar.Image size={48} source={{ uri: user.photo }} />
                ) : (
                    <Avatar.Text
                        size={48}
                        label={(user.name || 'O')[0].toUpperCase()}
                        backgroundColor={theme.colors.primary}
                        color="#fff"
                    />
                )}
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
                <Text style={[styles.greetingText, { color: theme.colors.secondaryText }]}>Ready to deliver!</Text>
                <Text style={[styles.userNameText, { color: theme.colors.text }]}>
                    {user.name || 'Oliver Bennet'} 👋
                </Text>
            </View>
        </View>
        <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconCircle} onPress={() => navigation.navigate('Help')}>
                <IconButton icon={bi('help')} size={24} iconColor="#FFF" style={{ margin: 0 }} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconCircle} onPress={() => navigation.navigate('Notifications')}>
                <IconButton icon={bi('bell')} size={24} iconColor="#FFF" style={{ margin: 0 }} />
                <View style={[styles.unreadBadge, { backgroundColor: theme.colors.error }]} />
            </TouchableOpacity>
        </View>
    </View>
);

// ─── grid metrics ─────────────────────────────────────────────────────────

const MetricCard = ({ label, value, icon, color, isPrimary, theme }) => (
    <Surface
        style={[
            styles.metricCard,
            { backgroundColor: isPrimary ? theme.colors.primary : theme.colors.surface }
        ]}
        elevation={2}
    >
        <View style={styles.metricTop}>
            <View style={[styles.metricIconWrap, { backgroundColor: isPrimary ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }]}>
                <AppIcon name={icon} size={28} color={isPrimary ? '#FFF' : theme.colors.primary} />
            </View>
            <View style={[styles.arrowCircle, { backgroundColor: '#FFF' }]}>
                <IconButton icon={bi('arrow-top-right')} size={18} iconColor="#121212" style={{ margin: 0 }} />
            </View>
        </View>
        <View style={styles.metricBottom}>
            <Text style={[styles.metricLabel, { color: isPrimary ? 'rgba(255,255,255,0.8)' : theme.colors.secondaryText }]}>{label}</Text>
            <Text style={[styles.metricValue, { color: '#FFF' }]}>{value}</Text>
        </View>
    </Surface>
);

const MetricsGrid = ({ totalOrders, totalEarnings, pendingCount, rating, theme }) => (
    <View style={styles.metricsGrid}>
        <MetricCard label="Total Deliveries" value={totalOrders} icon="package-variant-closed" color={theme.colors.primary} isPrimary theme={theme} />
        <MetricCard label="Total Earnings" value={`$${totalEarnings.toLocaleString()}`} icon="cash" theme={theme} />
        <MetricCard label="Average Rating" value={rating || '5.0'} icon="star" theme={theme} />
        <MetricCard label="Pending Jobs" value={pendingCount} icon="time-outline" theme={theme} />
    </View>
);

// ─── Performance Summary (Repurposed from Stock Overview) ───────────────────

const SummaryPillar = ({ label, value, color, theme }) => (
    <View style={styles.stockPillar}>
        <View style={styles.stockPillarHeader}>
            <View style={[styles.stockDot, { backgroundColor: color }]} />
            <Text style={styles.stockPillarLabel}>{label}</Text>
        </View>
        <Text style={[styles.stockPillarValue, { color: '#FFF' }]}>{value}</Text>
    </View>
);

const ActivitySummary = ({ completed, pending, cancelled, theme }) => (
    <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Performance Summary</Text>
        <Surface style={[styles.stockContainer, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <SummaryPillar label="Completed" value={completed} color="#3277FF" theme={theme} />
            <View style={styles.stockDivider} />
            <SummaryPillar label="Pending" value={pending} color="#5AC8FA" theme={theme} />
            <View style={styles.stockDivider} />
            <SummaryPillar label="Cancelled" value={cancelled} color="#FF453A" theme={theme} />
        </Surface>
    </View>
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

    const user = SheetService.currentUser || {};

    const loadData = useCallback(async () => {
        if (!user?.id) return;
        Promise.allSettled([
            SheetService.dashboardInit({ lat: 0, lng: 0, radiusKm: 0 }, { timeout: 30000 }).then(r => setStats(r?.data?.stats || {})),
            SheetService.getBikerOrders(user.id, { timeout: 30000 }).then(r => setOrders(Array.isArray(r?.data) ? r.data : (r?.data?.orders || []))),
            SheetService.getBikerFees(user.id, { timeout: 30000 }).then(r => setFees(Array.isArray(r) ? r : (r?.data?.fees || []))),
            SheetService.getCallHistory(user.id, { timeout: 30000 }).then(r => setCalls(Array.isArray(r?.data) ? r.data : []))
        ]).finally(() => setRefreshing(false));
    }, [user?.id]);

    useEffect(() => {
        loadData();
        const interval = setInterval(() => {
            loadData();
        }, 20000);
        return () => clearInterval(interval);
    }, [loadData]);

    const safeOrders = Array.isArray(orders) ? orders : [];
    
    // Real Data Calculations
    const completedOrdersList = safeOrders.filter(o => String(o.status).toLowerCase() === 'completed');
    const completedCount = completedOrdersList.length;
    const pendingCount = safeOrders.filter(o => ['pending', 'assigned', 'picked_up', 'in_transit'].includes(String(o.status).toLowerCase())).length;
    const cancelledCount = safeOrders.filter(o => String(o.status).toLowerCase() === 'cancelled').length;

    const totalEarnings = completedOrdersList.reduce((sum, o) => {
        let amt = 0;
        if (typeof o.price === 'number') amt = o.price;
        else if (typeof o.price === 'string') amt = parseFloat(o.price.replace(/[^0-9.]/g, '')) || 0;
        else if (typeof o.fare === 'number') amt = o.fare;
        else if (typeof o.fare === 'string') amt = parseFloat(o.fare.replace(/[^0-9.]/g, '')) || 0;
        return sum + (amt / 100); // Usually stored in cents
    }, 0);

    const sections = [
        { type: 'header' },
        { type: 'metrics' },
        { type: 'activity' },

        { 
            type: 'sectionLabel', 
            id: 'recent-label', 
            title: 'Recent Deliveries', 
            action: 'See all',
            onAction: () => navigation.navigate('RequestHistory')
        },
        ...(safeOrders.length ? safeOrders.slice(0, 5).map(o => ({ type: 'order', ...o, key: `o-${o.orderId || o.id}` })) : [{ type: 'empty', id: 'e-1', message: 'No deliveries yet.', icon: 'package-variant-closed' }]),

        { type: 'footer' }
    ];

    const renderItem = ({ item }) => {
        switch (item.type) {
            case 'header': return <HeaderSection user={user} theme={theme} navigation={navigation} />;
            case 'metrics': return (
                <MetricsGrid 
                    totalOrders={completedCount} 
                    totalEarnings={totalEarnings} 
                    pendingCount={pendingCount}
                    rating={user?.rating}
                    theme={theme} 
                />
            );
            case 'activity': return (
                <ActivitySummary 
                    completed={completedCount} 
                    pending={pendingCount} 
                    cancelled={cancelledCount} 
                    theme={theme} 
                />
            );
            case 'sectionLabel':
                return <SectionHeader title={item.title} actionText={item.action} onAction={item.onAction} theme={theme} />;
            case 'order': return <OrderRow item={item} theme={theme} />;
            case 'empty':
                return (
                    <View style={styles.emptyWrap}>
                        <IconButton icon={bi(item.icon)} size={32} iconColor={theme.colors.outline} />
                        <Text style={[styles.emptyText, { color: theme.colors.secondaryText }]}>{item.message}</Text>
                    </View>
                );
            case 'footer': return <View style={{ height: 120 }} />;
            default: return null;
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
            <FlatList
                data={sections}
                keyExtractor={(item, idx) => item.key || item.id || item.type + idx}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#3277FF" />}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    list: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },

    headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 4 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarWrap: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#121212' },
    headerTextWrap: {},
    greetingText: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
    userNameText: { fontSize: 18, fontWeight: '800' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#121212', alignItems: 'center', justifyContent: 'center' },
    unreadBadge: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#121212' },

    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
    metricCard: { width: (width - 56) / 2, height: (width - 56) / 2, borderRadius: 28, padding: 20, justifyContent: 'space-between' },
    metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    metricIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    arrowCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    metricBottom: {},
    metricLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
    metricValue: { fontSize: 22, fontWeight: '900' },

    sectionContainer: { marginBottom: 24 },
    sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
    stockContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24 },
    stockPillar: { flex: 1, alignItems: 'center' },
    stockPillarHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
    stockDot: { width: 8, height: 8, borderRadius: 4 },
    stockPillarLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' },
    stockPillarValue: { fontSize: 18, fontWeight: '900' },
    stockDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 4 },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 20, fontWeight: '800' },

    listCard: { borderRadius: 24, marginBottom: 12, padding: 16 },
    listCardRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    listIconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    listCardContent: { flex: 1 },
    listCardId: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    listCardSub: { fontSize: 13, fontWeight: '500' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '800' },

    emptyWrap: { alignItems: 'center', paddingVertical: 32, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderStyle: 'dashed' },
    emptyText: { fontSize: 14, fontWeight: '600' },
});

export default DashboardScreen;
