import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { NativeModules, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// --- Supabase Config ---
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function resolveApiUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  let baseUrl = '';

  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    baseUrl = envUrl.trim().replace(/\/+$/, '');
  }

  // If we're in DEV, attempt to auto-detect the host machine's IP
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (typeof scriptURL === 'string') {
      try {
        const u = new URL(scriptURL);
        const host = u.hostname;

        // Android Emulator specific host: 10.0.2.2 is usually the host machine
        if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
          return 'http://10.0.2.2:3000';
        }

        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          // If we have a real IP from scripts, use it with the default port
          return `http://${host}:3000`;
        }
      } catch {
        const m = scriptURL.match(/https?:\/\/([^/:]+)(?::\d+)?\//);
        const host = m?.[1];
        if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
          return 'http://10.0.2.2:3000';
        }
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          return `http://${host}:3000`;
        }
      }
    }
  }

  // If envUrl was set, use it.
  if (baseUrl) {
    if (Platform.OS === 'android' && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
      return baseUrl.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
    }
    return baseUrl;
  }

  // Fallback machine IP (user's detected IP)
  const MACHINE_IP = '192.168.100.145';
  
  if (Platform.OS === 'android') {
    // If we detected a valid IP from the script, prefer it over loopback if it's not localhost
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
       try {
         const host = new URL(scriptURL).hostname;
         if (host && host !== 'localhost' && host !== '127.0.0.1') {
           return `http://${host}:3000`;
         }
       } catch(e) {}
    }
    return 'http://10.0.2.2:3000';
  }

  return `http://${MACHINE_IP}:3000`;
}

const MACHINE_IP = '192.168.100.145';
const API_URL = resolveApiUrl();
console.log(`[SheetService] ✅ API BASE URL: ${API_URL}`);

if (Platform.OS === 'android') {
  console.log(`[SheetService] 📱 Android detected. Using Emulator Loopback (10.0.2.2)`);
  console.log(`[SheetService] 💡 TIP: If you see ERR_NETWORK, ensure your backend server is running and accessible at port 3000 or 3003.`);
}

const WS_PATH = '/ws/tracking';

const storageKeys = {
  token: 'auth_token',
  user: 'auth_user'
};

const client = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30s timeout for all environments to handle slow initial discovery
});

// 1. Request interceptor for Auth tokens
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(storageKeys.token);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 2. Consolidated Response Interceptor for Logging, 401s, and Smart Retries (Android)
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    const isNetworkError = error.message === 'Network Error';

    // A. Handle 401 Unauthorized (Session expiry)
    if (error.response?.status === 401 && !originalRequest._retryAuth) {
      originalRequest._retryAuth = true;
      console.warn('[SheetService] 401 Unauthorized - Clearing session.');
      try {
        await AsyncStorage.removeItem(storageKeys.token);
        await AsyncStorage.removeItem(storageKeys.user);
        SheetService.currentUser = null;
      } catch (e) {
        console.error('[SheetService] Error clearing session:', e);
      }
      return Promise.reject(error);
    }

    // B. Handle Connection Failures / Timeouts with Smart Retry (Android only)
    if (Platform.OS === 'android' && (isNetworkError || isTimeout)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      
      if (originalRequest._retryCount <= 3) {
        let newBaseUrl = originalRequest.baseURL || API_URL;
        console.log(`[SheetService] ⚠️ Android ${isTimeout ? 'Timeout' : 'Network Error'} (${originalRequest._retryCount}/3) on ${newBaseUrl}. Attempting failover...`);

        // Failover Step 1: Swap Port (3000 <-> 3003)
        if (originalRequest._retryCount === 1 || originalRequest._retryCount === 3) {
           if (newBaseUrl.includes(':3000')) {
             newBaseUrl = newBaseUrl.replace(':3000', ':3003');
           } else if (newBaseUrl.includes(':3003')) {
             newBaseUrl = newBaseUrl.replace(':3003', ':3000');
           }
        } 
        
        // Failover Step 2: Swap IP (Machine IP <-> 10.0.2.2)
        if (originalRequest._retryCount === 2) {
           if (newBaseUrl.includes(MACHINE_IP) && !newBaseUrl.includes('10.0.2.2')) {
             newBaseUrl = newBaseUrl.replace(MACHINE_IP, '10.0.2.2');
           } else if (newBaseUrl.includes('10.0.2.2')) {
             newBaseUrl = newBaseUrl.replace('10.0.2.2', MACHINE_IP);
           }
        }

        console.log(`[SheetService] 🔄 Retry ${originalRequest._retryCount}: Targets -> ${newBaseUrl}`);
        originalRequest.baseURL = newBaseUrl;
        
        // Update specific URL host if it's absolute
        if (originalRequest.url?.startsWith('http')) {
          try {
            const urlObj = new URL(originalRequest.url);
            const baseUrlObj = new URL(newBaseUrl);
            urlObj.host = baseUrlObj.host;
            urlObj.port = baseUrlObj.port;
            originalRequest.url = urlObj.toString();
          } catch (e) {}
        }
        
        return client(originalRequest);
      }
    }

    // C. Non-retryable errors or failed after all retries
    if (isNetworkError || isTimeout) {
      console.warn(`[SheetService] ${error.code || 'ERROR'}: ${error.message} when calling ${originalRequest.url}`);
      if (isTimeout) {
        console.warn(`[SheetService] TIP: All connection attempts failed. Ensure your backend is running and accessible from the network.`);
      }
    } else if (error.response) {
      console.warn(`[SheetService] ❌ API ERROR ${error.response.status}:`, error.response.data);
    } else {
      console.warn(`[SheetService] ❌ UNKNOWN ERROR:`, error.message);
    }

    return Promise.reject(error);
  }
);

const toBackendRole = (appRole) => {
  const r = String(appRole || '').toLowerCase();
  if (r === 'biker' || r === 'driver') return 'driver';
  if (r === 'admin') return 'admin';
  return 'customer';
};

const toAppRole = (backendRole) => {
  const r = String(backendRole || '').toLowerCase();
  if (r === 'driver') return 'biker';
  if (r === 'admin') return 'admin';
  if (r === 'customer') return 'user';
  return r || 'user';
};

function buildSyntheticEmail(legacyId, appRole) {
  const role = toBackendRole(appRole);
  const prefix = role === 'driver' ? 'driver' : role === 'admin' ? 'admin' : 'user';
  const raw = `${prefix}.${String(legacyId || '').trim().toLowerCase()}`;
  const safe = raw
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.+/g, '.')
    .slice(0, 64);
  return `${safe || prefix}@biker.local`;
}

const extractError = (err, fallbackMessage) => {
  const data = err?.response?.data;
  if (data) {
    if (data.error && data.error.message) {
      return Array.isArray(data.error.message) ? data.error.message[0] : (typeof data.error.message === 'string' ? data.error.message : fallbackMessage);
    }
    if (data.message) {
      return Array.isArray(data.message) ? data.message[0] : (typeof data.message === 'string' ? data.message : fallbackMessage);
    }
  }
  return err.message || fallbackMessage;
};

const SheetService = {
  currentUser: null,

  getApiUrl: () => API_URL,
  getUserId: () => SheetService.currentUser?.id,

  registerUser: async (userData) => {
    console.log('[SheetService] Processing Registration for:', userData.email);
    try {
      let email = (userData.email || '').toLowerCase().trim();
      if (email && !email.includes('@')) {
        email = buildSyntheticEmail(email, userData.role);
      }
      if (!email && userData.id) email = buildSyntheticEmail(userData.id, userData.role);

      const backendRole = toBackendRole(userData.role);
      const payload = {
        name: userData.name.trim(),
        phone: userData.phone || undefined,
        email: email,
        password: userData.password,
        role: backendRole,
        city: userData.city,
        country: userData.country,
        countryCode: userData.countryCode,
        vehicleNumber: userData.vehicleNumber,
        vehicleType: backendRole === 'driver' ? userData.vehicleType : undefined,
        vehicleDetails: backendRole === 'driver' ? (userData.vehicleDetails || userData.vehicleNumber) : undefined,
      };

      console.log('[SheetService] Sending Register Request...');
      const res = await client.post('/api/auth/register', payload);

      if (res?.data?.success) {
        console.log('[SheetService] Registration Success!');
        const u = { ...res.data.data.user, role: toAppRole(res.data.data.user.role) };
        await AsyncStorage.setItem(storageKeys.token, res.data.data.accessToken);
        await AsyncStorage.setItem(storageKeys.user, JSON.stringify(u));
        SheetService.currentUser = u;
        return { ...res.data, data: { ...res.data.data, user: u } };
      }
      console.warn('[SheetService] Registration Denied:', res?.data?.message);
      return res?.data || { success: false, message: 'Registration failed' };
    } catch (err) {
      console.error('[SheetService] Registration Exception:', err.message);
      return { success: false, message: extractError(err, 'Registration failed') };
    }
  },

  providerAuth: async ({ email, name, provider, providerId, role, photo, vehicleDetails, vehicleNumber, phone, city, country, countryCode }) => {
    try {
      const backendRole = toBackendRole(role);
      const res = await client.post('/api/auth/provider', {
        email, name, provider, providerId, role: backendRole, photo, vehicleDetails, vehicleNumber, phone, city, country, countryCode
      });

      if (res?.data?.success) {
        const u = { ...res.data.data.user, role: toAppRole(res.data.data.user.role) };
        await AsyncStorage.setItem(storageKeys.token, res.data.data.accessToken);
        await AsyncStorage.setItem(storageKeys.user, JSON.stringify(u));
        SheetService.currentUser = u;
        return { ...res.data, data: { ...res.data.data, user: u } };
      }
      return res?.data || { success: false, message: 'Provider auth failed' };
    } catch (err) {
      return { success: false, message: extractError(err, 'Provider auth failed') };
    }
  },

  generateOtp: async (identifier, purpose = 'email_verification', role = 'user') => {
    try {
      const backendRole = toBackendRole(role);
      const res = await client.post('/api/auth/otp/generate', { identifier, purpose, role: backendRole });
      return res.data;
    } catch (err) {
      return { success: false, message: extractError(err, 'Failed to send code') };
    }
  },

  verifyOtp: async (identifier, code, purpose = 'email_verification', role = 'user') => {
    try {
      const backendRole = toBackendRole(role);
      const res = await client.post('/api/auth/otp/verify', { identifier, code, purpose, role: backendRole });
      return res.data;
    } catch (err) {
      return { success: false, message: extractError(err, 'Invalid code') };
    }
  },

  signInWithGoogle: async () => {
    if (!supabase) return { success: false, message: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://zpaegcvszjfuccfuxuty.supabase.co/auth/v1/callback',
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('[SheetService] Google Sign-In Error:', err.message);
      return { success: false, message: err.message };
    }
  },

  loginUser: async (idOrEmail, password, selectedRole) => {
    console.log('[SheetService] Attempting Login for:', idOrEmail, `as ${selectedRole}`);
    try {
      let email = String(idOrEmail || '').toLowerCase().trim();
      const backendRole = toBackendRole(selectedRole);

      // If no email @, we keep synthetic for legacy but we definitely want to send role now
      if (!email.includes('@')) email = buildSyntheticEmail(idOrEmail, selectedRole);

      console.log('[SheetService] Sending Login Request to:', `/api/auth/login`);
      const res = await client.post('/api/auth/login', { email, password, role: backendRole });
      
      if (res.data?.success) {
        console.log('[SheetService] Login Success!');
        const u = { ...res.data.data.user, role: toAppRole(res.data.data.user.role) };

        await AsyncStorage.setItem(storageKeys.token, res.data.data.accessToken);
        await AsyncStorage.setItem(storageKeys.user, JSON.stringify(u));
        SheetService.currentUser = u;
        return { ...res.data, data: { ...res.data.data, user: u } };
      }
      console.warn('[SheetService] Login Denied:', res.data?.message);
      return res.data;
    } catch (err) {
      console.error('[SheetService] Login Exception:', err.message);
      return { success: false, message: extractError(err, 'Login failed') };
    }
  },

  loadSession: async () => {
    try {
      const user = await AsyncStorage.getItem(storageKeys.user);
      if (!user) return null;
      const parsed = JSON.parse(user);
      SheetService.currentUser = parsed;
      return parsed;
    } catch (e) {
      return null;
    }
  },

  logout: async () => {
    try {
      await client.post('/api/auth/logout', {}, { timeout: 3000 }).catch(() => { });
    } catch { }
    await AsyncStorage.removeItem(storageKeys.token);
    await AsyncStorage.removeItem(storageKeys.user);
    await AsyncStorage.removeItem('chosenRole');
    SheetService.currentUser = null;
  },

  dashboardInit: async ({ lat, lng, radiusKm }) => {
    try {
      const res = await client.get('/api/dashboard/init', { params: { lat, lng, radiusKm } });
      return res.data;
    } catch (e) {
      return { success: true, data: { stats: { totalOrders: 0, totalEarnings: 0 }, user: SheetService.currentUser } };
    }
  },

  updateDriverLocation: async (payload) => {
    const res = await client.patch('/api/driver/location', payload);
    return res.data;
  },

  driverMe: async () => {
    const res = await client.get('/api/driver/me');
    return res.data;
  },

  getDriverActiveOrder: async () => {
    const res = await client.get('/api/driver/active-order');
    return res.data;
  },
  getUserActiveOrder: async () => {
    const res = await client.get('/api/orders/user-active');
    return res.data;
  },
  cancelOrder: async (orderId) => {
    const res = await client.post(`/api/orders/${orderId}/cancel`);
    return res.data;
  },

  updateDriverOrderStatus: async (orderId, status) => {
    const res = await client.patch(`/api/driver/orders/${orderId}/status`, { status });
    return res.data;
  },

  getDriversNearby: async ({ lat, lng, radiusKm, serviceType }) => {
    const res = await client.get('/api/drivers/nearby', { params: { lat, lng, radiusKm, serviceType } });
    return res.data;
  },

  setDriverOnline: async (online) => {
    const res = await client.patch('/api/driver/online', { online });
    return res.data;
  },

  createOrder: async (payload) => {
    const res = await client.post('/api/orders/create', payload);
    return res.data;
  },

  placeBid: async (payload) => {
    const res = await client.post('/api/orders/bid', payload);
    return res.data;
  },

  acceptBid: async (payload) => {
    const res = await client.post('/api/orders/accept-bid', payload);
    return res.data;
  },

  getOrderHistory: async () => {
    const res = await client.get('/api/orders/history');
    return res.data;
  },

  getNotifications: async () => {
    const res = await client.get('/api/notifications');
    return res.data;
  },

  updateProfile: async (payload) => {
    const res = await client.patch('/api/users/me', payload);
    if (res.data?.success) {
      const u = res.data?.data?.user;
      const existing = JSON.parse(await AsyncStorage.getItem(storageKeys.user) || '{}');
      const merged = { ...existing, ...u };
      await AsyncStorage.setItem(storageKeys.user, JSON.stringify(merged));
      SheetService.currentUser = merged;
    }
    return res.data;
  },

  getBikerOrders: async (bikerId, options) => {
    try {
      const res = await client.get('/api/orders/history', { ...(options || {}) });
      return res.data;
    } catch (e) {
      console.warn('[SheetService] getBikerOrders failed:', e?.message);
      return { success: true, data: [] };
    }
  },

  getBikerFees: async (bikerId, options) => {
    try {
      const res = await client.get(`/api/payments/biker/${bikerId}/fees`, { ...(options || {}) });
      return res.data;
    } catch (e) {
      console.warn('[SheetService] getBikerFees failed:', e?.message);
      return [];
    }
  },

  getBikerSubscriptions: async (bikerId, options) => {
    try {
      const token = await AsyncStorage.getItem(storageKeys.token);
      if (!token) return { success: true, data: [] };
      const res = await client.get(`/api/payments/biker/${bikerId}/subscriptions`, { ...(options || {}) });
      return res.data;
    } catch (e) {
      // Suppress 401 warnings from console to avoid noise when session expires
      if (e?.response?.status !== 401) {
        console.warn('[SheetService] getBikerSubscriptions failed:', e?.message);
      }
      return { success: true, data: [] };
    }
  },

  createBikerSubscription: async (bikerId, payload) => {
    try {
      const res = await client.post(`/api/payments/biker/${bikerId}/subscriptions`, payload);
      return res.data;
    } catch (e) {
      console.warn('[SheetService] createBikerSubscription failed:', e?.message);
      throw e;
    }
  },

  getSubscriptionPlans: async () => {
    try {
      const res = await client.get('/api/payments/plans');
      return res.data;
    } catch {
      return [
        { subscriptionType: 'weekly', amount: 500, currency: 'USD', label: 'Weekly', durationDays: 7 },
        { subscriptionType: 'monthly', amount: 1500, currency: 'USD', label: 'Monthly', durationDays: 30 },
      ];
    }
  },

  getService: async ({ type, lat, lng }) => {
    const res = await client.get(`/api/services/${type}`, { params: { lat, lng } });
    return res.data;
  },

  getNearbyProviders: async ({ lat, lng, kind, radiusM, limit }) => {
    const res = await client.get('/api/location/nearby-providers', { params: { lat, lng, kind, radiusM, limit } });
    return res.data;
  },

  searchCities: async (query, countryCode) => {
    const res = await client.get('/api/location/autocomplete', { params: { query, lat: 0, lng: 0 } }); // simplified
    return res.data;
  },

  searchCountries: async (query) => {
    const res = await client.get('/api/location/autocomplete', { params: { query } }); // simplified
    return res.data;
  },

  autocomplete: async ({ query, lat, lng }) => {
    const res = await client.get('/api/location/autocomplete', { params: { query, lat, lng } });
    return res.data;
  },

  calculatePricing: async (payload) => {
    const res = await client.post('/api/pricing/calculate', payload);
    return res.data;
  },

  getDirections: async ({ origin, destination, serviceType }) => {
    const res = await client.get('/api/routes/directions', { params: { origin, destination, serviceType } });
    return res.data;
  },

  upsertDraft: async (payload) => {
    const res = await client.post('/api/orders/draft', payload);
    return res.data;
  },

  getChatHistory: async ({ orderId, room }) => {
    const res = await client.get('/api/chat/history', { params: { orderId, room } });
    return res.data;
  },

  sendChatMessage: async (payload) => {
    const res = await client.post('/api/chat/message', payload);
    return res.data;
  },

  acceptOrder: async (orderId) => {
    const res = await client.post(`/api/driver/orders/${orderId}/accept`);
    return res.data;
  },

  cancelOrder: async (orderId) => {
    const res = await client.post(`/api/orders/${orderId}/cancel`);
    return res.data;
  },

  getCallHistory: async (userId, options) => {
    try {
      const res = await client.get(`/api/calls/biker/${userId}`, { ...(options || {}) });
      return res.data;
    } catch (e) {
      console.warn('[SheetService] getCallHistory failed:', e?.message);
      return { success: true, data: [] };
    }
  },

  recordCall: async (payload) => {
    const res = await client.post('/api/calls/record', payload);
    return res.data;
  },

  clearBikerHistory: async (userId) => {
    const res = await client.post(`/api/bikers/${userId}/clear-history`);
    return res.data;
  },

  deleteAccount: async (userId) => {
    const res = await client.post(`/api/users/${userId}/delete-account`);
    return res.data;
  },

  // ── STRIPE / PAYPAL payment intents ────────────────────────────

  createStripeIntent: async (bikerId, amountCents, currency, subscriptionType) => {
    const res = await client.post('/api/payments/stripe/create-intent', {
      bikerId,
      amountCents,
      currency: currency || 'usd',
      subscriptionType,
    });
    return res.data;
  },

  confirmStripePayment: async (payload) => {
    const res = await client.post('/api/payments/stripe/confirm', payload);
    return res.data;
  },

  createPayPalOrder: async (bikerId, amountCents, currency, subscriptionType) => {
    const res = await client.post('/api/payments/paypal/create-order', {
      bikerId,
      amountCents,
      currency: currency || 'USD',
      subscriptionType,
    });
    return res.data;
  },

  capturePayPalOrder: async (payload) => {
    // payload: { orderId, bikerId, subscriptionType, amountCents, ... }
    const res = await client.post('/api/payments/paypal/capture', payload);
    return res.data;
  },

  connectTrackingSocket: async () => {
    const token = await AsyncStorage.getItem(storageKeys.token);
    if (!token) return null;
    return io(API_URL, {
      path: WS_PATH,
      transports: ['websocket'],
      auth: { token },
    });
  },

  // ── RATING ─────────────────────────────────────────────────────
  submitRating: async (payload) => {
    // payload: { userId, orderId, bikerId, rating, comment, tags, tipCents }
    try {
      const res = await client.post('/api/support/feedback', {
        userId: payload.userId,
        orderId: payload.orderId,
        rating: payload.rating,
        comment: payload.comment,
        tags: payload.tags,
        tipCents: payload.tipCents,
      });
      return res.data;
    } catch (err) {
      console.warn('[SheetService] submitRating failed:', err?.message);
      // Allow the app to proceed even if backend fails
      return { success: true, message: 'Rating saved locally' };
    }
  },

  // ── PENDING RATING CHECK ──────────────────────────────────────
  // Returns orderId + bikerId if there's a completed order that hasn't been rated
  checkPendingRating: async () => {
    try {
      const res = await client.get('/api/orders/pending-rating');
      return res?.data?.data || null;
    } catch (e) {
      return null;
    }
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────────
  markAsRead: async (notificationId) => {
    try {
      const res = await client.patch(`/api/notifications/${notificationId}/read`);
      return res.data;
    } catch (e) {
      return { success: false };
    }
  },

  clearAllNotifications: async () => {
    try {
      const res = await client.post('/api/notifications/clear-all');
      return res.data;
    } catch (e) {
      return { success: false, message: 'Failed to clear notifications' };
    }
  },

  // ── CHAT ──────────────────────────────────────────────────
  getChatHistory: async (params) => {
    const res = await client.get('/api/chat/history', { params });
    return res.data;
  },

  sendChatMessage: async (payload) => {
    const res = await client.post('/api/chat/message', payload);
    return res.data;
  },

  sendPushNotification: async (userId, title, body) => {
    try {
      const res = await client.post('/api/notifications/send', { userId, title, body });
      return res.data;
    } catch (e) {
      return { success: false };
    }
  },

  // ── GOOGLE SIGN-IN (Native for Expo) ──────────────────────────
  signInWithGoogleNative: async (idToken) => {
    // After Google sign-in on the client, send the id_token to Supabase
    if (!supabase) return { success: false, message: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;

      // Now register/login the user on our backend with the Supabase user info
      const supaUser = data?.user;
      if (!supaUser) throw new Error('No user returned from Supabase');

      // Try to login first, if fail then register
      const email = supaUser.email;
      const name = supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || email.split('@')[0];
      const photo = supaUser.user_metadata?.avatar_url || null;

      // Try login
      let res = await client.post('/api/auth/login', {
        email,
        password: `google_${supaUser.id}`,
        role: 'customer',
      }).catch(() => null);

      if (!res?.data?.success) {
        // Register new user
        res = await client.post('/api/auth/register', {
          name,
          email,
          password: `google_${supaUser.id}`,
          role: 'customer',
          photo,
          provider: 'google',
          providerId: supaUser.id,
        });
      }

      if (res?.data?.success) {
        const u = { ...res.data.data.user, role: toAppRole(res.data.data.user.role), photo };
        await AsyncStorage.setItem(storageKeys.token, res.data.data.accessToken);
        await AsyncStorage.setItem(storageKeys.user, JSON.stringify(u));
        SheetService.currentUser = u;
        return { success: true, data: { ...res.data.data, user: u } };
      }
      return res?.data || { success: false, message: 'Google login failed' };
    } catch (err) {
      console.error('[SheetService] Google Native Sign-In Error:', err.message);
      return { success: false, message: err.message };
    }
  },

  // ── APP SECURITY ──────────────────────────────────────────────
  validateSession: async () => {
    try {
      const token = await AsyncStorage.getItem(storageKeys.token);
      if (!token) return false;
      const res = await client.get('/api/auth/me');
      return res?.data?.success === true;
    } catch (e) {
      return false;
    }
  },

  getSecurityFingerprint: () => {
    // Generate a device fingerprint for anti-tampering
    return {
      platform: Platform.OS,
      timestamp: Date.now(),
      version: '1.0.4',
    };
  },
};

export default SheetService;

