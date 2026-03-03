import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import BrandMark from '../components/BrandMark';

const { width, height } = Dimensions.get('window');

const storageKey = 'hasSeenOnboarding';

const palette = {
  greenA: '#00FD3F',
  greenB: '#2ECC71',
  greenDeep: '#0A7A2B',
  black: '#0B0B0B',
};

const Page = ({ item, i, scrollX }) => {
  const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

  const heroStyle = useAnimatedStyle(() => {
    const t = interpolate(scrollX.value, inputRange, [28, 0, -28], Extrapolate.CLAMP);
    const s = interpolate(scrollX.value, inputRange, [0.94, 1, 0.94], Extrapolate.CLAMP);
    const o = interpolate(scrollX.value, inputRange, [0.25, 1, 0.25], Extrapolate.CLAMP);
    return {
      transform: [{ translateX: t }, { scale: s }],
      opacity: o,
    };
  });

  const copyStyle = useAnimatedStyle(() => {
    const y = interpolate(scrollX.value, inputRange, [18, 0, 18], Extrapolate.CLAMP);
    const o = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolate.CLAMP);
    return {
      transform: [{ translateY: y }],
      opacity: o,
    };
  });

  return (
    <View style={[styles.page, { width }]}>
      <Animated.View style={[styles.hero, heroStyle]}>
        <Image source={{ uri: item.imageUri }} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.heroShade} />
        <View style={styles.heroTag}>
          <Text style={styles.heroTagText}>{item.tag}</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.copy, copyStyle]}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>

        <View style={styles.bullets}>
          {item.bullets.map((b, bi) => (
            <Bullet key={`${item.key}:${bi}`} text={b} idx={bi} pageIndex={i} scrollX={scrollX} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

const Bullet = ({ text, idx, pageIndex, scrollX }) => {
  const inputRange = [(pageIndex - 1) * width, pageIndex * width, (pageIndex + 1) * width];

  const rowStyle = useAnimatedStyle(() => {
    const y = interpolate(scrollX.value, inputRange, [22 + idx * 8, 0, 22 + idx * 8], Extrapolate.CLAMP);
    const o = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolate.CLAMP);
    return {
      transform: [{ translateY: y }],
      opacity: o,
    };
  });

  return (
    <Animated.View style={[styles.bulletRow, rowStyle]}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </Animated.View>
  );
};

const OnboardingScreen = ({ navigation }) => {
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 6000 }), -1, true);
  }, []);

  const blob1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(float.value, [0, 1], [-30, 50]) },
      { translateY: interpolate(float.value, [0, 1], [-10, 30]) },
      { rotate: `${interpolate(float.value, [0, 1], [-6, 6])}deg` },
    ],
  }));

  const blob2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(float.value, [0, 1], [40, -40]) },
      { translateY: interpolate(float.value, [0, 1], [20, -20]) },
      { rotate: `${interpolate(float.value, [0, 1], [8, -8])}deg` },
    ],
  }));

  const pages = useMemo(
    () => [
      {
        key: 'welcome',
        tag: 'Welcome to Biker App',
        title: '30-Day Free Trial',
        body: 'Every new biker gets 30 days of full access for free! No upfront payment needed - start earning immediately.',
        bullets: ['30-day free trial on first signup', 'Weekly (5 days) or Monthly plans', 'Trial available for FIRST timers only'],
        imageUri: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1200&q=80',
      },
      {
        key: 'restricted',
        tag: 'Biker Restricted Mode',
        title: 'View Requests Anytime',
        body: 'No active subscription? No problem. You can still go online in "Restricted Mode" to watch live requests as they pop up.',
        bullets: [
          'Watch requests popping as notifications',
          'Learn the area before you subscribe',
          'Subscribe anytime to unlock accepting orders',
        ],
        imageUri: 'https://images.unsplash.com/photo-1621244093864-1647440092f3?auto=format&fit=crop&w=1200&q=80',
      },
      {
        key: 'calling',
        tag: 'Safety & Connectivity',
        title: 'In-App Calling System',
        body: 'Connect with your customer or biker instantly through our secure in-app VoIP system once a job is accepted.',
        bullets: [
          'Free in-app calls (no credit needed)',
          'Real-time chat for better coordination',
          'Logged history for your security',
        ],
        imageUri: 'https://images.unsplash.com/photo-1516733725897-1aa73b87c8e8?auto=format&fit=crop&w=1200&q=80',
      },
      {
        key: 'security',
        tag: 'Your Data, Your Rules',
        title: 'History & Privacy',
        body: 'Every new subscription clears your history for a fresh start. Need to leave? Your data is retrievable if you return.',
        bullets: [
          'History clears on every new plan',
          'Wipe account data in Settings',
          'Return anytime - your profile is waiting',
        ],
        imageUri: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
      },
    ],
    [],
  );

  useEffect(() => {
    pages.forEach((p) => {
      if (p?.imageUri) {
        Image.prefetch(p.imageUri).catch(() => { });
      }
    });
  }, [pages]);

  const setSeenAndGo = async (routeName, params = {}) => {
    await AsyncStorage.setItem(storageKey, 'true');
    navigation.replace(routeName, params);
  };

  const onNext = () => {
    if (index >= pages.length - 1) {
      setSeenAndGo('Login');
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  return (
    <LinearGradient
      colors={[palette.greenA, palette.greenB]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <Animated.View pointerEvents="none" style={[styles.blob, styles.blob1, blob1]} />
        <Animated.View pointerEvents="none" style={[styles.blob, styles.blob2, blob2]} />

        <View style={styles.header}>
          <View style={{ width: 72 }} />
          <BrandMark
            size={64}
            showWordmark={false}
            gradientColors={[palette.black, palette.greenDeep]}
            innerColor={palette.black}
            iconColor={palette.greenA}
          />
          <Button mode="text" textColor={palette.black} onPress={() => setSeenAndGo('Login')}>
            Skip
          </Button>
        </View>

        <Animated.FlatList
          ref={listRef}
          data={pages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            setIndex(i);
          }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item, index: i }) => <Page item={item} i={i} scrollX={scrollX} />}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {pages.map((p, i) => (
              <View
                key={p.key}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === index ? palette.black : 'rgba(11,11,11,0.25)',
                    width: i === index ? 18 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {index === pages.length - 1 ? (
            <View style={styles.actions}>
              <Button
                mode="contained"
                buttonColor={palette.black}
                textColor={palette.greenA}
                style={styles.primary}
                onPress={() => setSeenAndGo('Login')}
              >
                Login
              </Button>
              <Button
                mode="outlined"
                textColor={palette.black}
                style={styles.secondary}
                onPress={() => setSeenAndGo('Register')}
              >
                Create account
              </Button>
            </View>
          ) : (
            <Button
              mode="contained"
              buttonColor={palette.black}
              textColor={palette.greenA}
              style={styles.primary}
              onPress={onNext}
            >
              Next
            </Button>
          )}

          <Text style={styles.credit}>By Clever M Antonio</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  page: {
    paddingHorizontal: 18,
    paddingTop: 22,
  },
  hero: {
    height: Math.min(420, Math.round(height * 0.46)),
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: palette.black,
    borderWidth: 1,
    borderColor: 'rgba(11,11,11,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  heroTag: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,253,63,0.25)',
  },
  heroTagText: {
    textAlign: 'center',
    color: palette.greenA,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  copy: {
    marginTop: 18,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  title: {
    textAlign: 'center',
    color: palette.black,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  body: {
    textAlign: 'center',
    color: palette.greenDeep,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 320,
  },
  bullets: {
    marginTop: 14,
    width: '100%',
    maxWidth: 360,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.black,
    marginRight: 10,
  },
  bulletText: {
    color: palette.black,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  credit: {
    marginTop: 12,
    textAlign: 'center',
    color: 'rgba(11,11,11,0.65)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 99,
  },
  actions: {
    gap: 12,
  },
  primary: {
    borderRadius: 14,
  },
  secondary: {
    borderRadius: 14,
    borderColor: 'rgba(11,11,11,0.65)',
  },
  blob: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 999,
  },
  blob1: {
    width: 220,
    height: 220,
    top: 110,
    left: -80,
  },
  blob2: {
    width: 260,
    height: 260,
    bottom: 130,
    right: -120,
  },
});

export default OnboardingScreen;
