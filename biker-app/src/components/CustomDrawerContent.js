import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { DrawerContentScrollView, DrawerItem, useDrawerStatus } from '@react-navigation/drawer';
import { Avatar, Text, IconButton, Divider, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import SheetService from '../api/SheetService';
import { bi } from './AppIcon';
import AppSecurity from '../utils/AppSecurity';

const CustomDrawerContent = ({ extraProps, isBikerFlow, ...props }) => {
    const theme = useTheme();
    const isDrawerOpen = useDrawerStatus() === 'open';
    const [user, setUser] = React.useState(SheetService.currentUser || { name: 'User', photo: null });
    const [notificationCount, setNotificationCount] = React.useState(0);

    React.useEffect(() => {
        if (isDrawerOpen) {
            setUser(SheetService.currentUser || { name: 'User', photo: null });
        }
    }, [isDrawerOpen]);

    React.useEffect(() => {
        const loadNotifications = async () => {
            const res = await SheetService.getNotifications();
            const items = res?.data?.notifications || [];
            const unread = items.filter(n => !n.isRead).length;
            setNotificationCount(unread);
        };
        // Poll for notifications every 10s
        loadNotifications();
        const interval = setInterval(loadNotifications, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <DrawerContentScrollView {...props} contentContainerStyle={[styles.drawerContainer, { backgroundColor: theme.colors.background }]}>
            {/* Unique Header Design - Compact */}
            <LinearGradient
                colors={[theme.colors.surface, theme.colors.background]}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                <TouchableOpacity
                    style={styles.profileSection}
                    onPress={() => props.navigation.navigate('ProfileSettings')}
                >
                    <View style={styles.avatarContainer}>
                        {user.photo ? (
                            <Avatar.Image size={60} source={{ uri: user.photo }} />
                        ) : (
                            <Avatar.Text size={60} label={user.name[0]} backgroundColor={theme.colors.primary} color={theme.colors.onPrimary || '#FFF'} />
                        )}
                        <View style={[styles.editBadge, { backgroundColor: theme.colors.secondary }]}>
                            <IconButton icon={bi('pencil')} size={10} iconColor="#000" />
                        </View>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: theme.colors.text }]}>{user.name}</Text>
                        <Text style={[styles.userRole, { color: theme.colors.secondaryText }]}>
                            {isBikerFlow ? 'Biker account' : 'Customer account'}
                        </Text>
                    </View>
                </TouchableOpacity>
            </LinearGradient>

            {/* Menu Items - Compact */}
            <View style={styles.menuSection}>

                <DrawerItem
                    label="Request history"
                    icon={({ color, size }) => <IconButton icon={bi('history')} size={20} iconColor={theme.colors.primary} />}
                    onPress={() => props.navigation.navigate('RequestHistory')}
                    labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                    style={styles.drawerItem}
                />
                {isBikerFlow && (
                    <>
                        <DrawerItem
                            label="Plans & Subscription"
                            icon={({ color, size }) => <IconButton icon={bi('card-membership')} size={20} iconColor={theme.colors.primary} />}
                            onPress={() => props.navigation.navigate('Subscription')}
                            labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                            style={styles.drawerItem}
                        />
                        <DrawerItem
                            label="Biker Services"
                            icon={({ color, size }) => <IconButton icon={bi('plus-box')} size={20} iconColor={theme.colors.primary} />}
                            onPress={() => {
                                props.navigation.closeDrawer();
                                extraProps?.onOpenActions?.();
                            }}
                            labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                            style={styles.drawerItem}
                        />
                    </>
                )}
                <DrawerItem
                    label="Send a Package"
                    icon={({ color, size }) => <IconButton icon={bi('package-variant-closed')} size={20} iconColor={theme.colors.primary} />}
                    onPress={() => props.navigation.navigate('HomeDrawer', { screen: 'Couriers' })}
                    labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                    style={styles.drawerItem}
                />
                <DrawerItem
                    label="Local Services"
                    icon={({ color, size }) => <IconButton icon={bi('store')} size={20} iconColor={theme.colors.primary} />}
                    onPress={() => props.navigation.navigate('HomeDrawer', { screen: 'CityToCity' })}
                    labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                    style={styles.drawerItem}
                />
                <DrawerItem
                    label="Notifications"
                    icon={({ color, size }) => (
                        <View>
                            <IconButton icon={bi('bell-outline')} size={20} iconColor={theme.colors.primary} />
                            {notificationCount > 0 && (
                                <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
                                    <Text style={styles.badgeText}>{notificationCount}</Text>
                                </View>
                            )}
                        </View>
                    )}
                    onPress={() => props.navigation.navigate('Notifications')}
                    labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                    style={styles.drawerItem}
                />
                <DrawerItem
                    label="Messages"
                    icon={({ color, size }) => <IconButton icon={bi('chat-outline')} size={20} iconColor={theme.colors.primary} />}
                    onPress={() => props.navigation.navigate('ChatList')}
                    labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                    style={styles.drawerItem}
                />

                <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

                <DrawerItem
                    label="Safety"
                    icon={({ color, size }) => <IconButton icon={bi('shield-check-outline')} size={20} iconColor={theme.colors.secondary} />}
                    onPress={() => props.navigation.navigate('Safety')}
                    labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                    style={styles.drawerItem}
                />
                <DrawerItem
                    label="Settings"
                    icon={({ color, size }) => <IconButton icon={bi('cog-outline')} size={20} iconColor={theme.colors.secondaryText} />}
                    onPress={() => props.navigation.navigate('ProfileSettings')}
                    labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                    style={styles.drawerItem}
                />
                <DrawerItem
                    label="Help"
                    icon={({ color, size }) => <IconButton icon={bi('information-outline')} size={20} iconColor={theme.colors.secondaryText} />}
                    onPress={() => props.navigation.navigate('Help')}
                    labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                    style={styles.drawerItem}
                />
                <DrawerItem
                    label="Support"
                    icon={({ color, size }) => <IconButton icon={bi('message-outline')} size={20} iconColor={theme.colors.secondaryText} />}
                    onPress={() => props.navigation.navigate('Support')}
                    labelStyle={[styles.drawerLabel, { color: theme.colors.text }]}
                    style={styles.drawerItem}
                />

                <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />



                <DrawerItem
                    label="Logout"
                    icon={({ color, size }) => <IconButton icon={bi('logout')} size={20} iconColor={theme.colors.error} />}
                    onPress={async () => {
                        await AppSecurity.clearSession();
                        await SheetService.logout();
                        props.navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }}
                    labelStyle={[styles.drawerLabel, { color: theme.colors.error }]}
                    style={styles.drawerItem}
                />
            </View>

            <View style={styles.footer}>
                <Image
                    source={require('../../assets/logo.png')}
                    style={styles.drawerLogo}
                    resizeMode="contain"
                />
                <View style={styles.socialRow}>
                    <IconButton icon={bi('facebook')} size={24} iconColor="#1877F2" />
                    <IconButton icon={bi('instagram')} size={24} iconColor="#E4405F" />
                </View>
                <Text style={styles.versionText}>v1.0.4 Premium</Text>
            </View>
        </DrawerContentScrollView>
    );
};

const styles = StyleSheet.create({
    drawerContainer: {
        flex: 1,
        paddingTop: 0,
    },
    header: {
        paddingTop: 40,
        paddingBottom: 10,
        paddingHorizontal: 15,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        marginBottom: 5,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderRadius: 8,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#000',
    },
    userInfo: {
        marginLeft: 12,
        flex: 1,
    },
    userName: {
        fontSize: 18, // Reduced
        fontWeight: 'bold',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    starIcon: {
        margin: 0,
        marginLeft: -6,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '500',
    },
    userRole: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    menuSection: {
        paddingTop: 0,
    },
    drawerLabel: {
        fontSize: 14, // Reduced
        fontWeight: '600',
        marginLeft: -10,
    },
    drawerItem: {
        marginVertical: -8, // Tightened
    },
    badge: {
        position: 'absolute',
        top: 5,
        right: 5,
        borderRadius: 8,
        width: 14,
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 8,
        fontWeight: 'bold',
    },
    divider: {
        marginVertical: 5,
        height: 1,
    },
    footer: {
        marginTop: 'auto',
        padding: 15, // Reduced
        alignItems: 'center',
    },
    driverButton: {
        width: '100%',
        paddingVertical: 12, // Reduced
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 10, // Reduced
        elevation: 4,
    },
    driverButtonText: {
        fontSize: 16, // Reduced
        fontWeight: 'bold',
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
    },
    drawerLogo: {
        width: 80,
        height: 80,
        marginBottom: 10,
        opacity: 0.9,
        alignSelf: 'center',
    },
    versionText: {
        fontSize: 10,
        color: '#666',
        marginTop: 5,
    },
});

export default CustomDrawerContent;
