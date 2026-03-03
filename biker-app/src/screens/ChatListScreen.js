import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, Surface, useTheme, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const ChatListScreen = ({ navigation }) => {
    const theme = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <IconButton 
                    icon="arrow-left" 
                    size={24} 
                    onPress={() => navigation.goBack()} 
                    iconColor={theme.colors.text} 
                />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Messages</Text>
                <View style={{ width: 48 }} />
            </View>

            <View style={[styles.empty, { backgroundColor: theme.colors.surface }]}> 
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Chat not enabled</Text>
                <Text style={[styles.emptyText, { color: theme.colors.secondaryText }]}>This build does not include a messaging backend. Use phone/SMS or Support instead.</Text>
            </View>
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
    empty: { margin: 16, padding: 18, borderRadius: 12 },
    emptyTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
    emptyText: { fontSize: 14, lineHeight: 20 },
    card: {
        borderRadius: 12,
        marginBottom: 12,
        padding: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#2ECC71',
        borderWidth: 2,
        borderColor: '#141414',
    },
    content: {
        flex: 1,
        marginLeft: 12,
    },
    nameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    time: {
        fontSize: 12,
    },
    messageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 14,
        flex: 1,
    },
    unreadBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    unreadText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default ChatListScreen;
