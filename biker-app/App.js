import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { View, StyleSheet, Platform, TouchableOpacity, Animated, Dimensions, Pressable, Switch, Alert } from 'react-native';
import { NavigationContainer, useNavigation, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PaperProvider, useTheme, IconButton, Text, Surface } from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { darkTheme, lightTheme } from './src/theme/theme';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';

import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import RouteSelectionScreen from './src/screens/RouteSelectionScreen';
import ProfileSettingsScreen from './src/screens/ProfileSettingsScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import RequestHistoryScreen from './src/screens/RequestHistoryScreen';
import CouriersScreen from './src/screens/CouriersScreen';
import CityToCityScreen from './src/screens/CityToCityScreen';
import SafetyScreen from './src/screens/SafetyScreen';
import HelpScreen from './src/screens/HelpScreen';
import SupportScreen from './src/screens/SupportScreen';
import RatingScreen from './src/screens/RatingScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatScreen from './src/screens/ChatScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import BikerDetailsScreen from './src/screens/BikerDetailsScreen';
import VerificationScreen from './src/screens/VerificationScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';

import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CustomDrawerContent from './src/components/CustomDrawerContent';
import { bi } from './src/components/AppIcon';
import SheetService from './src/api/SheetService';

const Tab = createBottomTabNavigator();
const RootStack = createStackNavigator();
const MainAppStack = createStackNavigator();
const Drawer = createDrawerNavigator();
const { width, height } = Dimensions.get('window');

// ─── Quick Action Overlay ────────────────────────────────────────────────────

const QuickActionOverlay = ({ visible, onClose, statusProps }) => {
  const theme = useTheme();
  const animation = React.useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();
  const { isOnline, toggleOnline, subscription, user } = statusProps || {};

  React.useEffect(() => {
    Animated.spring(animation, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [visible]);

  if (!visible) return null;

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const rotate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['45deg', '0deg'],
  });

  const actions = [
    { id: 'request', label: 'New Request', icon: 'plus-circle', color: '#3277FF', screen: 'RouteSelection' },
    { id: 'map', label: 'Live Map', icon: 'map', color: '#2ECC71', screen: 'Home' },
    { id: 'support', label: 'Support', icon: 'help-circle', color: '#F1C40F', screen: 'Support' },
    { id: 'settings', label: 'Settings', icon: 'cog', color: '#95A5A6', screen: 'ProfileSettings' },
  ];

  return (
    <Pressable style={styles.overlayContainer} onPress={onClose}>
      <Animated.View style={[styles.overlayBg, { opacity: animation }]} />
      <Animated.View style={[styles.actionSheet, { transform: [{ translateY }] }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>QUICK ACTIONS</Text>
          <View style={styles.sheetDivider} />
        </View>
        <View style={styles.actionsGrid}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionItem}
              onPress={() => {
                onClose();
                navigation.navigate(action.screen);
              }}
            >
              <Surface style={[styles.actionIconWrap, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: action.color }]} elevation={2}>
                <IconButton icon={bi(action.icon)} size={32} iconColor={action.color} />
              </Surface>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {user?.role === 'biker' && (
          <View style={styles.statusSection}>
            <View style={styles.sheetDivider} />
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>Biker Status</Text>
                <Text style={[styles.statusSubtitle, { color: isOnline ? '#2ECC71' : '#FF4B4B' }]}>
                  {isOnline ? 'Active & Receiving Jobs' : 'Offline'}
                </Text>
              </View>
              <Switch
                value={isOnline}
                onValueChange={toggleOnline}
                trackColor={{ false: '#333', true: '#3277FF20' }}
                thumbColor={isOnline ? '#3277FF' : '#999'}
              />
            </View>

            <TouchableOpacity 
              style={[styles.overlaySubBadge, { borderColor: subscription?.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C' }]}
              onPress={() => {
                onClose();
                navigation.navigate('Subscription');
              }}
            >
              <View style={[styles.subBadgeDot, { backgroundColor: subscription?.subscriptionStatus === 'active' ? '#2ECC71' : '#E74C3C' }]} />
              <Text style={styles.overlaySubText}>
                {subscription?.subscriptionStatus === 'active' 
                  ? `${String(subscription.subscriptionType).toUpperCase()} Plan` 
                  : 'No Active Plan'}
              </Text>
              <IconButton icon={bi('chevron-right')} size={16} iconColor="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.closeSheetBtn} onPress={onClose}>
          <IconButton icon={bi('close')} size={28} iconColor="#FFF" />
        </TouchableOpacity>
      </Animated.View>
    </Pressable>
  );
};

function MainStack() {
  console.log('[App] Rendering MainStack');
  const theme = useTheme();
  const { isDarkMode } = useAppTheme();
  return (
    <MainAppStack.Navigator
      initialRouteName="Main"
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: isDarkMode ? '#FFFFFF' : '#000000',
        headerTitleStyle: { fontWeight: 'bold' },
        headerShown: false,
      }}
    >
      <MainAppStack.Screen name="Main" component={HomeScreen} />
      <MainAppStack.Screen name="RouteSelection" component={RouteSelectionScreen} />
      <MainAppStack.Screen name="Couriers" component={CouriersScreen} />
      <MainAppStack.Screen name="CityToCity" component={CityToCityScreen} />

      {/* Shared Screens also available in MainStack for direct navigation in Customer flow */}
      <MainAppStack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
      <MainAppStack.Screen name="Subscription" component={SubscriptionScreen} />
      <MainAppStack.Screen name="Notifications" component={NotificationsScreen} />
      <MainAppStack.Screen name="RequestHistory" component={RequestHistoryScreen} />
      <MainAppStack.Screen name="Safety" component={SafetyScreen} />
      <MainAppStack.Screen name="Help" component={HelpScreen} />
      <MainAppStack.Screen name="Support" component={SupportScreen} />
      <MainAppStack.Screen name="Rating" component={RatingScreen} />
    </MainAppStack.Navigator>
  );
}

// Ensure BikerHomeScreen and others are imported correctly
import BikerHomeScreen from './src/screens/BikerHomeScreen';

const COMMON_TAB_BAR_STYLE = {
  backgroundColor: '#000000',
  borderTopWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.08)',
  height: 85,
  paddingBottom: Platform.OS === 'ios' ? 30 : 15,
  position: 'absolute',
  bottom: 30,
  left: 12,
  right: 12,
  borderRadius: 28,
  elevation: 10,
  shadowColor: '#000',
  shadowOpacity: 0.4,
  shadowRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.05)',
  paddingTop: 8,
};

const TabButton = ({ onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      width: 58, height: 58, borderRadius: 29, backgroundColor: '#3277FF',
      justifyContent: 'center', alignItems: 'center', marginBottom: 35,
      shadowColor: '#3277FF', shadowOpacity: 0.6, shadowRadius: 15, elevation: 12,
      borderWidth: 4, borderColor: '#000',
    }}
  >
    <IconButton icon={bi('plus')} size={32} iconColor="#FFF" style={{ margin: 0 }} />
  </TouchableOpacity>
);

function CustomerTabNavigator({ extraProps }) {
  console.log('[App] Rendering CustomerTabNavigator');
  const theme = useTheme();

  const getTabBarVisibility = (route) => {
    const routeName = getFocusedRouteNameFromRoute(route) ?? 'Home';
    return route.name === 'Home' && routeName === 'Home' ? COMMON_TAB_BAR_STYLE : { display: 'none' };
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: getTabBarVisibility(route),
        tabBarActiveTintColor: '#3277FF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;
          if (route.name === 'Main') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'My delivery') iconName = focused ? 'package-variant' : 'package-variant-closed';
          else if (route.name === 'Post') return null;
          else if (route.name === 'Subscription') iconName = focused ? 'card-membership' : 'card-membership';
          else if (route.name === 'Profile') iconName = focused ? 'account' : 'account-outline';
          return <IconButton icon={bi(iconName)} size={size + 2} iconColor={color} />;
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: -4 },
      })}
    >
      <Tab.Screen name="Main" component={MainStack} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="My delivery" component={RequestHistoryScreen} options={{ tabBarLabel: 'Orders' }} />
      <Tab.Screen 
        name="Post" 
        component={View} 
        options={{ 
          tabBarLabel: '',
          tabBarButton: () => <TabButton onPress={extraProps.onOpenActions} />
        }} 
      />
      <Tab.Screen name="Subscription" component={SubscriptionScreen} options={{ tabBarLabel: 'Plans' }} />
      <Tab.Screen name="Profile" component={ProfileSettingsScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

function BikerTabNavigator({ extraProps }) {
  console.log('[App] Rendering BikerTabNavigator');
  const theme = useTheme();

  const getTabBarVisibility = (route) => {
    const routeName = getFocusedRouteNameFromRoute(route) ?? route.name;
    const hideOn = ['Subscription', 'Profile', 'Account', 'ProfileSettings'];
    if (hideOn.includes(routeName)) return { display: 'none' };
    return COMMON_TAB_BAR_STYLE;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: getTabBarVisibility(route),
        tabBarActiveTintColor: '#3277FF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'My delivery') iconName = focused ? 'map-marker' : 'map-marker-outline';
          else if (route.name === 'Post') return null;
          else if (route.name === 'Subscription') iconName = focused ? 'card-membership' : 'card-membership';
          else if (route.name === 'Profile') iconName = focused ? 'account' : 'account-outline';
          return <IconButton icon={bi(iconName)} size={size + 2} iconColor={color} />;
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: -4 },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: 'Main' }} />
      <Tab.Screen name="My delivery">
        {props => <BikerHomeScreen {...props} {...extraProps} />}
      </Tab.Screen>
      <Tab.Screen 
        name="Post" 
        component={View} 
        options={{ 
          tabBarLabel: '',
          tabBarButton: () => <TabButton onPress={extraProps.onOpenActions} />
        }} 
      />
      <Tab.Screen name="Subscription" component={SubscriptionScreen} options={{ tabBarLabel: 'Plans' }} />
      <Tab.Screen name="Profile" component={ProfileSettingsScreen} options={{ tabBarLabel: 'Account' }} />
    </Tab.Navigator>
  );
}
function BikerDrawer({ extraProps }) {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} isBikerFlow={true} extraProps={extraProps} />}
      screenOptions={{ headerShown: false, drawerType: 'front' }}
    >
      <Drawer.Screen name="BikerMainDrawer">
        {props => <BikerTabNavigator {...props} extraProps={extraProps} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
}

function CustomerDrawer({ extraProps }) {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} isBikerFlow={false} extraProps={extraProps} />}
      screenOptions={{ headerShown: false, drawerType: 'front' }}
    >
      <Drawer.Screen name="MainDrawer">
        {props => <MainStack {...props} extraProps={extraProps} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
}

function AppContent() {
  console.log('[App] Rendering AppContent');
  const { isDarkMode } = useAppTheme();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const [showQuickActions, setShowQuickActions] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(false);
  const [subscription, setSubscription] = React.useState(null);
  const [user, setUser] = React.useState(SheetService.currentUser);
  console.log('[App] Current User Role:', user?.role);

  React.useEffect(() => {
    const init = async () => {
      const u = await SheetService.loadSession();
      const role = await AsyncStorage.getItem('chosenRole');
      if (u) {
        if (role) setUser({ ...u, chosenRole: role });
        else setUser(u);
      }
    };
    init();
  }, []);

  React.useEffect(() => {
    if (user?.id && user.role === 'biker') {
      const loadStatus = async () => {
        const res = await SheetService.getBikerSubscriptions(user.id);
        const sub = Array.isArray(res?.data) ? res.data[0] : (res?.data?.subscriptions?.[0]);
        setSubscription(sub);
      };
      loadStatus();
    }
  }, [user]);

  const toggleOnline = async () => {
    const newState = !isOnline;

    // Check if user has active trial or active subscription
    const now = new Date();
    const trialActive = user?.trialExpiryDate && new Date(user.trialExpiryDate) > now;
    const subActive = subscription?.subscriptionStatus === 'active';

    // Show informative alert if going online without subscription/trial
    if (newState && !subActive && !trialActive) {
      Alert.alert(
        'Restricted Mode',
        'Your free trial has expired. You can view incoming requests but cannot accept them until you subscribe.',
        [
          { text: 'View Requests', style: 'default' },
          { text: 'Subscribe', onPress: () => { setShowQuickActions(false); /* navigation.navigate handled by caller */ }, style: 'cancel' }
        ]
      );
    }

    setIsOnline(newState);
    try {
      const res = await SheetService.setDriverOnline(newState);

      if (res?.success === false) {
        setIsOnline(!newState);
        Alert.alert(
          'Cannot change status',
          res?.message || 'Could not update online status. Please ensure your driver profile is complete.'
        );
        return;
      }
      
      if (res?.data?.isOnline !== undefined) {
        setIsOnline(res.data.isOnline);
      }
    } catch (e) {
      setIsOnline(!newState);
      Alert.alert('Cannot go online', 'Unable to change online status');
    }
  };

  const statusProps = {
    isOnline,
    setIsOnline,
    toggleOnline,
    subscription,
    setSubscription,
    user,
    setUser: (u) => {
      console.log('[App] Updating user state:', u?.role);
      setUser(u);
    }
  };

  const extraProps = {
    onOpenActions: () => setShowQuickActions(true),
    ...statusProps
  };

  return (
    <PaperProvider theme={currentTheme}>
      <NavigationContainer theme={currentTheme}>
        <RootStack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Splash" component={SplashScreen} />
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
          <RootStack.Screen name="RoleSelection" component={RoleSelectionScreen} />
          <RootStack.Screen name="Login">
            {props => <LoginScreen {...props} setUser={setUser} />}
          </RootStack.Screen>
          <RootStack.Screen name="Register">
            {props => <RegisterScreen {...props} setUser={setUser} />}
          </RootStack.Screen>
          <RootStack.Screen name="BikerDetails" component={BikerDetailsScreen} />
          <RootStack.Screen name="Verification" component={VerificationScreen} />
          <RootStack.Screen name="MainApp">
            {props => {
              const activeRole = user?.chosenRole || user?.role;
              return activeRole === 'biker' 
                ? <BikerDrawer {...props} extraProps={extraProps} />
                : <CustomerDrawer {...props} extraProps={extraProps} />
            }}
          </RootStack.Screen>
          <RootStack.Screen name="BikerApp">
            {props => <BikerDrawer {...props} extraProps={extraProps} />}
          </RootStack.Screen>
          <RootStack.Screen name="ChatList" component={ChatListScreen} />
          <RootStack.Screen name="Chat" component={ChatScreen} />
          <RootStack.Screen name="Dashboard" component={DashboardScreen} />

          {/* Shared Screens in RootStack for Biker flow and general access */}
          <RootStack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
          <RootStack.Screen name="Subscription" component={SubscriptionScreen} />
          <RootStack.Screen name="Notifications" component={NotificationsScreen} />
          <RootStack.Screen name="RequestHistory" component={RequestHistoryScreen} />
          <RootStack.Screen name="Safety" component={SafetyScreen} />
          <RootStack.Screen name="Help" component={HelpScreen} />
          <RootStack.Screen name="Support" component={SupportScreen} />
          <RootStack.Screen name="Rating" component={RatingScreen} />
        </RootStack.Navigator>
        <QuickActionOverlay 
          visible={showQuickActions} 
          onClose={() => setShowQuickActions(false)} 
          statusProps={statusProps}
        />
      </NavigationContainer>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  actionSheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sheetTitle: {
    color: '#3277FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  sheetDivider: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  actionItem: {
    width: (width - 88) / 2,
    alignItems: 'center',
    marginBottom: 20,
  },
  actionIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 10,
  },
  actionLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeSheetBtn: {
    alignSelf: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 25,
  },
  statusSection: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 5,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statusSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  overlaySubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  subBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  overlaySubText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
});

export default function App() {
  console.log('[App] Initializing App entry point');
  const stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StripeProvider
            publishableKey={stripeKey}
            merchantIdentifier="merchant.biker.app" // update if needed
          >
            <AppContent />
          </StripeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
