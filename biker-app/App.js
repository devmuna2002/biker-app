import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PaperProvider, useTheme } from 'react-native-paper';
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
import CustomDrawerContent from './src/components/CustomDrawerContent';

const RootStack = createStackNavigator();
const MainAppStack = createStackNavigator();
const Drawer = createDrawerNavigator();

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  LogBox.ignoreLogs([
    '[Reanimated] Reduced motion setting is enabled on this device.',
  ]);
}

function MainStack() {
  const theme = useTheme();
  const { isDarkMode } = useAppTheme();
  return (
    <MainAppStack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: isDarkMode ? '#FFFFFF' : '#000000',
        headerTitleStyle: { fontWeight: 'bold' },
        headerShown: false,
      }}
    >
      <MainAppStack.Screen name="Home" component={HomeScreen} />
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

function CustomerDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{ headerShown: false, drawerType: 'front' }}
    >
      <Drawer.Screen name="HomeDrawer" component={MainStack} />
    </Drawer.Navigator>
  );
}

function AppContent() {
  const { isDarkMode } = useAppTheme();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={currentTheme}>
      <NavigationContainer theme={currentTheme}>
        <RootStack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Splash" component={SplashScreen} />
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
          <RootStack.Screen name="RoleSelection" component={RoleSelectionScreen} />
          <RootStack.Screen name="Login" component={LoginScreen} />
          <RootStack.Screen name="Register" component={RegisterScreen} />
          <RootStack.Screen name="BikerDetails" component={BikerDetailsScreen} />
          <RootStack.Screen name="Verification" component={VerificationScreen} />
          <RootStack.Screen name="MainApp" component={CustomerDrawer} />
          <RootStack.Screen name="BikerApp" component={BikerHomeScreen} />
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
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
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
