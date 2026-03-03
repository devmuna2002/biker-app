import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text, IconButton, Surface, useTheme, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import SheetService from '../api/SheetService';

const NotificationsScreen = ({ navigation }) => {
    const theme = useTheme();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        const res = await SheetService.getNotifications();
        const data = res?.data?.notifications || [];
        setNotifications(
            data.map((n) => ({
                id: String(n.id),
                title: n.type || 'notification',
                message: n.message,
                type: n.type,
                read: Boolean(n.isRead),
                date: n.createdAt ? new Date(n.createdAt).toLocaleString() : '',
            })),
        );
        setLoading(false);
    };

    const handleMarkAsRead = async (id) => {
        await SheetService.markAsRead(id);
        setNotifications(notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
        ));
    };

    const getIcon = (type) => {
        switch (type) {
            case 'safety': return 'shield-alert';
            case 'delivery': return 'package-variant';
            case 'promo': return 'tag-heart';
            default: return 'bell-ring';
        }
    };

    const getColor = (type) => {
        switch (type) {
            case 'safety': return theme.colors.error;
            case 'delivery': return theme.colors.primary;
            case 'promo': return '#F1C40F'; // Gold
            default: return theme.colors.secondary;
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            onPress={() => handleMarkAsRead(item.id)}
            activeOpacity={0.7}
        >
            <Surface style={[
                styles.card,
                { backgroundColor: item.read ? theme.colors.surface : '#1F1F1F', borderColor: item.read ? 'transparent' : theme.colors.primary }
            ]} elevation={item.read ? 0 : 2}>
                <View style={styles.row}>
                    <Avatar.Icon
                        size={40}
                        icon={getIcon(item.type)}
                        backgroundColor="transparent"
                        color={getColor(item.type)}
                        style={{ margin: 0 }}
                    />
                    <View style={styles.content}>
                        <View style={styles.headerRow}>
                            <Text style={[styles.title, { color: theme.colors.text, fontWeight: item.read ? 'normal' : 'bold' }]}>{item.title}</Text>
                            <Text style={[styles.date, { color: theme.colors.secondaryText }]}>{item.date}</Text>
                        </View>
                        <Text style={[styles.message, { color: theme.colors.secondaryText }]} numberOfLines={2}>{item.message}</Text>
                    </View>
                    {!item.read && <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />}
                </View>
            </Surface>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} iconColor={theme.colors.text} />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Notifications</Text>
                <IconButton icon="dots-vertical" size={24} iconColor={theme.colors.text} />
            </View>

            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={loadNotifications}
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
        borderRadius: 12,
        marginBottom: 12,
        padding: 16,
        borderWidth: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        marginLeft: 12,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
    },
    date: {
        fontSize: 12,
    },
    message: {
        fontSize: 14,
        lineHeight: 20,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginLeft: 8,
    },
});

export default NotificationsScreen;
