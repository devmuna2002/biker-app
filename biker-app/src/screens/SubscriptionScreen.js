import React, { useState, useEffect, useCallback } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import { View, StyleSheet, Alert, TouchableOpacity, ScrollView, RefreshControl, Linking } from 'react-native';
import { Text, Button, useTheme, Surface, IconButton, Avatar, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SheetService from '../api/SheetService';
import { bi } from '../components/AppIcon';

// fallback price map in cents (used if server call fails)
const FALLBACK_PLANS = [
  { subscriptionType: 'weekly', amount: 500, currency: 'USD', label: 'Weekly', durationDays: 7 },
  { subscriptionType: 'monthly', amount: 1500, currency: 'USD', label: 'Monthly', durationDays: 30 },
];

const PLAN_ICONS = {
  weekly: bi('calendar-week'),
  monthly: bi('calendar-month'),
  trial: bi('cake-variant'),
};

const PLAN_FEATURES = {
  trial: ['30 days FULL access', 'No payment required', 'Try all premium features'],
  weekly: ['7 days access', 'Accept unlimited orders', 'Priority support'],
  monthly: ['30 days access', 'Accept unlimited orders', 'Priority support', 'Best value'],
};

const PAYMENT_METHODS = [
  { id: 'stripe', label: 'Card (Visa/MC)', icon: bi('credit-card'), color: '#635BFF' },
  { id: 'paypal', label: 'PayPal', icon: bi('alpha-p-circle'), color: '#003087' },
];

const SubscriptionScreen = ({ navigation }) => {
  const theme = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [selectedPlan, setSelectedPlan] = useState('weekly');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentSub, setCurrentSub] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('stripe');

  const loadData = useCallback(async () => {
    const user = SheetService.currentUser;
    setPlans(FALLBACK_PLANS);
    if (!selectedPlan) setSelectedPlan(FALLBACK_PLANS[0].subscriptionType);
    setPageLoading(false);

    // Load current subscription in background
    if (user?.id) {
      SheetService.getBikerSubscriptions(user.id, { timeout: 8000 })
        .then(res => {
          const rawSubs = (res?.data
            ? (Array.isArray(res.data) ? res.data : res.data.subscriptions || [])
            : (Array.isArray(res) ? res : [])).filter(s => !!s);
          const now = new Date();
          rawSubs.forEach(s => {
            if (s.expiryDate && new Date(s.expiryDate) < now) {
              s.subscriptionStatus = 'expired';
            }
          });
          const active = rawSubs.find(s => s.subscriptionStatus === 'active') || null;
          setCurrentSub(active);
        })
        .catch(e => console.log('[SubscriptionScreen] background sub load failed', e?.message));
    }

    // Load plans from server
    try {
      const data = await SheetService.getSubscriptionPlans({ timeout: 8000 });
      if (Array.isArray(data) && data.length > 0) {
        setPlans(data);
        if (!selectedPlan) setSelectedPlan(data[0].subscriptionType);
      }
    } catch { }

    setRefreshing(false);
  }, [selectedPlan]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handlePurchase = async () => {
    const user = SheetService.currentUser;
    if (loading) return;

    if (currentSub?.subscriptionStatus === 'active') {
      Alert.alert(
        'Active Subscription',
        'You already have an active subscription. Would you like to renew or change your plan?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed to Payment', onPress: () => processPurchase() }
        ]
      );
      return;
    }

    processPurchase();
  };

  const processPurchase = async () => {
    const user = SheetService.currentUser;
    if (!user?.id) {
      Alert.alert('Session Error', 'Your session has expired. Please log in again.');
      return;
    }
    setLoading(true);

    try {
      const planObj = (plans && plans.length > 0 ? plans : FALLBACK_PLANS).find(p => p.subscriptionType === selectedPlan) || {};
      const amountCents = planObj.amount || (selectedPlan === 'weekly' ? 500 : 1500);
      const currency = planObj.currency || 'USD';
      const days = planObj.durationDays || (selectedPlan === 'weekly' ? 7 : 30);

      const startDate = new Date();
      const expiry = new Date(startDate);
      expiry.setDate(expiry.getDate() + days);

      const startDateStr = startDate.toISOString().split('T')[0];
      const expiryDateStr = expiry.toISOString().split('T')[0];

      if (paymentMethod === 'stripe') {
        await handleStripePayment(user, amountCents, currency, days, startDateStr, expiryDateStr);
      } else if (paymentMethod === 'paypal') {
        await handlePayPalPayment(user, amountCents, currency, days, startDateStr, expiryDateStr);
      }
    } catch (e) {
      Alert.alert('Payment Error', e?.response?.data?.message || e?.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const handleStripePayment = async (user, amountCents, currency, days, startDateStr, expiryDateStr) => {
    // Step 1: Create PaymentIntent on server
    const intentRes = await SheetService.createStripeIntent(user.id, amountCents, currency, selectedPlan);
    if (!intentRes?.success) {
      throw new Error(intentRes?.message || 'Failed to create payment intent');
    }

    const { clientSecret, paymentIntentId, simulated } = intentRes.data;

    if (simulated) {
      // Dev/demo mode — skip card UI, confirm directly
      await finaliseStripePayment(user, paymentIntentId, amountCents, currency, startDateStr, expiryDateStr, days);
      return;
    }

    // Step 2: Present Stripe payment sheet
    try {
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Biker App',
        style: 'alwaysDark',
        googlePay: { merchantCountryCode: 'US', testEnv: true },
        applePay: { merchantCountryCode: 'US' },
        defaultBillingDetails: {
          email: user.email || '',
        },
        returnURL: 'bikerapp://stripe-redirect',
      });

      if (initError) {
        throw new Error(initError.message);
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          // User closed the sheet
          return;
        }
        throw new Error(presentError.message);
      }
    } catch (stripeErr) {
      console.warn('Stripe Sheet Error:', stripeErr.message);
      Alert.alert('Payment Error', stripeErr.message);
      return;
    }

    // Step 3: Confirm on backend and activate subscription
    await finaliseStripePayment(user, paymentIntentId, amountCents, currency, startDateStr, expiryDateStr, days);
  };

  const finaliseStripePayment = async (user, paymentIntentId, amountCents, currency, startDateStr, expiryDateStr, days) => {
    const confirmRes = await SheetService.confirmStripePayment({
      paymentIntentId,
      bikerId: String(user.id),
      subscriptionType: selectedPlan,
      amountCents,
      currency,
      startDate: startDateStr,
      expiryDate: expiryDateStr,
    });

    if (confirmRes?.success) {
      await onSubscriptionActivated(user, expiryDateStr);
      Alert.alert(
        confirmRes.data?.simulated ? '🧪 Demo: Activation' : '🎉 Payment Successful!',
        confirmRes.data?.simulated
          ? `Your ${selectedPlan} plan features are now unlocked for testing. (Simulated Stripe)`
          : `Your ${selectedPlan} plan is now active for ${days} days.`,
        [{ text: 'Great!', onPress: () => navigation.goBack() }]
      );
    } else {
      throw new Error(confirmRes?.message || 'Payment confirmation failed');
    }
  };

  const handlePayPalPayment = async (user, amountCents, currency, days, startDateStr, expiryDateStr) => {
    // Step 1: Create PayPal order
    const orderRes = await SheetService.createPayPalOrder(user.id, amountCents, currency, selectedPlan);
    if (!orderRes?.success) {
      throw new Error(orderRes?.message || 'Failed to create PayPal order');
    }

    const { orderId, approveUrl, simulated } = orderRes.data;

    if (simulated) {
      // Dev/demo mode — skip browser redirect
      const captureRes = await SheetService.capturePayPalOrder({
        orderId,
        bikerId: String(user.id),
        subscriptionType: selectedPlan,
        amountCents,
        currency,
        startDate: startDateStr,
        expiryDate: expiryDateStr,
      });
      if (captureRes?.success) {
        await onSubscriptionActivated(user, expiryDateStr);
        Alert.alert(
          '🧪 Demo: Activated!',
          `Your ${selectedPlan} plan features are now unlocked for this test session. (Simulated PayPal Transaction)`,
          [{ text: 'Great!', onPress: () => navigation.goBack() }]
        );
      } else {
        throw new Error('PayPal payment simulation failed');
      }
      return;
    }

    // Step 2: Open PayPal approval URL in browser, then handle deep link return
    Alert.alert(
      'PayPal Payment',
      `You will be redirected to PayPal to complete your payment of $${(amountCents / 100).toFixed(2)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open PayPal',
          onPress: async () => {
            try {
              await Linking.openURL(approveUrl);
              // After user returns, ask to confirm
              Alert.alert(
                'Payment Completed?',
                'Did you complete the PayPal payment?',
                [
                  { text: 'Not yet', style: 'cancel' },
                  {
                    text: 'Yes, confirm',
                    onPress: async () => {
                      setLoading(true);
                      try {
                        const captureRes = await SheetService.capturePayPalOrder({
                          orderId,
                          bikerId: String(user.id),
                          subscriptionType: selectedPlan,
                          amountCents,
                          currency,
                          startDate: startDateStr,
                          expiryDate: expiryDateStr,
                        });
                        if (captureRes?.success) {
                          await onSubscriptionActivated(user, expiryDateStr);
                          Alert.alert(
                            '🎉 Activated!',
                            `Your ${selectedPlan} plan is now active.`,
                            [{ text: 'Great!', onPress: () => navigation.goBack() }]
                          );
                        } else {
                          Alert.alert('Error', captureRes?.message || 'Could not verify PayPal payment');
                        }
                      } finally {
                        setLoading(false);
                      }
                    }
                  }
                ]
              );
            } catch (err) {
              Alert.alert('Error', 'Could not open PayPal. Please try again.');
            }
          }
        }
      ]
    );
  };

  const onSubscriptionActivated = async (user, expiryDateStr) => {
    // Update local user with active subscription
    const updated = {
      ...user,
      subscriptionStatus: 'active',
      subscriptionExpiryDate: expiryDateStr,
    };
    SheetService.currentUser = updated;
    try {
      await AsyncStorage.setItem('auth_user', JSON.stringify(updated));
    } catch { }
    setCurrentSub({ subscriptionType: selectedPlan, subscriptionStatus: 'active', expiryDate: expiryDateStr });

    // Clear history
    try {
      if (user?.id) await SheetService.clearBikerHistory(user.id);
    } catch (e) {
      console.log('History clearing failed:', e);
    }
  };

  const formatPrice = (amountCents) => {
    return `$${((amountCents || 0) / 100).toFixed(2)}`;
  };

  const daysRemaining = () => {
    if (!currentSub?.expiryDate) return null;
    const diff = new Date(currentSub.expiryDate) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (pageLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.secondaryText }]}>Loading plans…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon={bi('arrow-left')}
          size={28}
          onPress={() => navigation.goBack()}
          iconColor={theme.colors.text}
        />
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Subscription</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Current Subscription Banner */}
        {currentSub && (
          <View style={[styles.currentSubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.currentSubRow}>
              <Avatar.Icon
                size={44}
                icon={bi(currentSub.subscriptionStatus === 'active' ? 'shield-check' : 'shield-alert')}
                backgroundColor={
                  currentSub.subscriptionStatus === 'active'
                    ? theme.colors.secondary + '20'
                    : theme.colors.error + '20'
                }
                color={
                  currentSub.subscriptionStatus === 'active'
                    ? theme.colors.secondary
                    : theme.colors.error
                }
                style={{ margin: 0 }}
              />
              <View style={styles.currentSubInfo}>
                <Text style={[styles.currentSubTitle, { color: theme.colors.text }]}>
                  {String(currentSub.subscriptionType || '').charAt(0).toUpperCase() +
                    String(currentSub.subscriptionType || '').slice(1)}{' '}
                  Plan
                </Text>
                <View style={styles.currentSubMeta}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          currentSub.subscriptionStatus === 'active'
                            ? theme.colors.secondary + '20'
                            : theme.colors.error + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color:
                            currentSub.subscriptionStatus === 'active'
                              ? theme.colors.secondary
                              : theme.colors.error,
                        },
                      ]}
                    >
                      {String(currentSub.subscriptionStatus).toUpperCase()}
                    </Text>
                  </View>
                  {daysRemaining() != null && currentSub.subscriptionStatus === 'active' && (
                    <Text style={[styles.daysLeft, { color: theme.colors.secondaryText }]}>
                      {daysRemaining()} days left
                    </Text>
                  )}
                </View>
              </View>
            </View>
            {currentSub.expiryDate && (
              <Text style={[styles.expiryText, { color: theme.colors.secondaryText }]}>
                {currentSub.subscriptionStatus === 'active' ? 'Expires' : 'Expired'}{' '}
                {new Date(currentSub.expiryDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        {/* Section Title */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {currentSub?.subscriptionStatus === 'active' ? 'Available Plans' : 'Choose a Plan'}
        </Text>
        <Text style={[styles.sectionSub, { color: theme.colors.secondaryText }]}>
          Subscribe to go online and start earning
        </Text>

        {/* Plan Cards */}
        {plans.map((p) => {
          const isSelected = selectedPlan === p.subscriptionType;
          const isActive = currentSub?.subscriptionStatus === 'active' && currentSub.subscriptionType === p.subscriptionType;
          const features = PLAN_FEATURES[p.subscriptionType] || ['Full access', 'Accept orders'];
          const icon = PLAN_ICONS[p.subscriptionType] || bi('calendar');

          return (
            <TouchableOpacity
              key={p.subscriptionType}
              activeOpacity={0.7}
              onPress={() => setSelectedPlan(p.subscriptionType)}
            >
              <Surface
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: isSelected ? theme.colors.primary : 'transparent',
                    borderWidth: isSelected ? 2 : 0,
                  },
                ]}
                elevation={isSelected ? 4 : 1}
              >
                <View style={styles.planCardInternal}>
                  {/* Popular badge */}
                  {p.subscriptionType === 'monthly' && (
                    <View style={[styles.popularBadge, { backgroundColor: '#F39C12' }]}>
                      <Text style={styles.popularText}>BEST VALUE</Text>
                    </View>
                  )}

                  <View style={styles.planHeader}>
                    <View style={[styles.planIconWrap, { backgroundColor: isSelected ? theme.colors.primary + '20' : theme.colors.outline + '30' }]}>
                      <Avatar.Icon
                        size={40}
                        icon={icon}
                        backgroundColor="transparent"
                        color={isSelected ? theme.colors.primary : theme.colors.secondaryText}
                        style={{ margin: 0 }}
                      />
                    </View>
                    <View style={styles.planInfo}>
                      <Text style={[styles.planName, { color: theme.colors.text }]}>
                        {p.label || String(p.subscriptionType).charAt(0).toUpperCase() + String(p.subscriptionType).slice(1)}
                      </Text>
                      <Text style={[styles.planPrice, { color: theme.colors.primary }]}>
                        {formatPrice(p.amount)}
                        <Text style={styles.planPeriod}>
                          /{p.subscriptionType === 'weekly' ? 'week' : 'month'}
                        </Text>
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        {
                          borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
                        },
                      ]}
                    >
                      {isSelected && (
                        <View style={[styles.radioInner, { backgroundColor: theme.colors.primary }]} />
                      )}
                    </View>
                  </View>

                  <Divider style={{ backgroundColor: theme.colors.outline + '40', marginVertical: 12 }} />

                  <View style={{ gap: 8 }}>
                    {features.map((f, fi) => (
                      <View key={fi} style={styles.featureRow}>
                        <IconButton
                          icon={bi('check-circle')}
                          size={16}
                          iconColor={theme.colors.primary}
                          style={{ margin: 0 }}
                        />
                        <Text style={[styles.featureText, { color: theme.colors.text }]}>{f}</Text>
                      </View>
                    ))}
                  </View>

                  {isActive && (
                    <View style={[styles.activePlanLabel, { backgroundColor: theme.colors.secondary + '20' }]}>
                      <Text style={[styles.activePlanLabelText, { color: theme.colors.secondary }]}>CURRENT ACTIVE PLAN</Text>
                    </View>
                  )}
                </View>
              </Surface>
            </TouchableOpacity>
          );
        })}

        {/* Payment Methods */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 24 }]}>Secure Payment</Text>
        <Text style={[styles.sectionSub, { color: theme.colors.secondaryText }]}>Real money transaction – securely processed</Text>

        <View style={styles.paymentRow}>
          {PAYMENT_METHODS.map(pm => (
            <TouchableOpacity
              key={pm.id}
              style={[
                styles.paymentOption,
                paymentMethod === pm.id && { borderColor: pm.color, backgroundColor: pm.color + '15' }
              ]}
              onPress={() => setPaymentMethod(pm.id)}
            >
              <IconButton
                icon={pm.icon}
                size={28}
                iconColor={paymentMethod === pm.id ? pm.color : '#7F8C8D'}
                style={{ margin: 0 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.paymentLabel, { color: paymentMethod === pm.id ? theme.colors.text : '#7F8C8D' }]}>
                  {pm.label}
                </Text>
                {pm.id === 'stripe' && (
                  <Text style={{ fontSize: 10, color: '#7F8C8D', marginTop: 2 }}>Visa · Mastercard · Amex</Text>
                )}
                {pm.id === 'paypal' && (
                  <Text style={{ fontSize: 10, color: '#7F8C8D', marginTop: 2 }}>PayPal balance · Bank</Text>
                )}
              </View>
              {paymentMethod === pm.id && (
                <IconButton icon={bi('check-circle')} size={18} iconColor={pm.color} style={{ margin: 0 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Security note */}
        <View style={styles.securityNote}>
          <IconButton icon={bi('lock')} size={16} iconColor="#7F8C8D" style={{ margin: 0 }} />
          <Text style={{ color: '#7F8C8D', fontSize: 11, flex: 1 }}>
            Payments are encrypted and processed securely. Your card details are never stored on our servers.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Purchase Button */}
      <View style={[styles.bottomBar, { backgroundColor: theme.colors.background }]}>
        <Button
          mode="contained"
          onPress={handlePurchase}
          loading={loading}
          disabled={loading}
          style={[styles.purchaseBtn, { backgroundColor: theme.colors.secondary }]}
          contentStyle={styles.purchaseBtnContent}
          labelStyle={[styles.purchaseBtnLabel, { color: currentSub?.subscriptionStatus === 'active' ? theme.colors.secondaryText : '#000' }]}
        >
          {currentSub?.subscriptionStatus === 'active'
            ? 'Already Subscribed'
            : `Pay ${formatPrice((plans.find(p => p.subscriptionType === selectedPlan) || {}).amount)} via ${paymentMethod === 'stripe' ? 'Card' : 'PayPal'}`}
        </Button>
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // ── current sub ──
  currentSubCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  currentSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentSubInfo: {
    flex: 1,
  },
  currentSubTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  currentSubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  daysLeft: {
    fontSize: 12,
  },
  expiryText: {
    fontSize: 12,
    marginTop: 8,
    marginLeft: 56,
  },

  // ── section ──
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 14,
    marginBottom: 16,
  },

  // ── plan cards ──
  planCard: {
    borderRadius: 16,
    padding: 0,
    marginBottom: 14,
    position: 'relative',
  },
  planCardInternal: {
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: -28,
    transform: [{ rotate: '35deg' }],
    paddingHorizontal: 32,
    paddingVertical: 3,
  },
  popularText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planIconWrap: {
    borderRadius: 12,
    padding: 4,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 2,
  },
  planPeriod: {
    fontSize: 13,
    fontWeight: '400',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '500',
  },
  activePlanLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  activePlanLabelText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // ── payment ──
  paymentRow: {
    gap: 10,
    marginTop: 8,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 8,
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },

  // ── bottom bar ──
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 28,
  },
  purchaseBtn: {
    borderRadius: 16,
    elevation: 4,
  },
  purchaseBtnContent: {
    height: 56,
  },
  purchaseBtnLabel: {
    fontSize: 17,
    fontWeight: 'bold',
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
});

export default SubscriptionScreen;
