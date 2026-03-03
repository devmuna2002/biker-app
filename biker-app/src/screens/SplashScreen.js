import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import SheetService from '../api/SheetService';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    withDelay,
    withSequence,
    Easing,
    ReduceMotion,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
    // Animation values
    const line1Y = useSharedValue(40);
    const line1Op = useSharedValue(0);
    const line2Y = useSharedValue(40);
    const line2Op = useSharedValue(0);
    const dotScale = useSharedValue(0);
    const dotOp = useSharedValue(0);
    const underlineW = useSharedValue(0);

    const goToApp = (user) =>
        navigation.replace(
            user?.role === 'biker' || user?.role === 'driver' ? 'BikerApp' : 'MainApp'
        );

    useEffect(() => {
        // Core delay for iOS to ensure native splash has finished hiding
        const START_DELAY = 100;

        const startAnimations = () => {
            // "BIKERS" slides up
            line1Op.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never });
            line1Y.value = withSpring(0, { damping: 16, stiffness: 120, reduceMotion: ReduceMotion.Never });

            // "DELIVERY" slides up slightly after
            line2Op.value = withDelay(220, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
            line2Y.value = withDelay(220, withSpring(0, { damping: 16, stiffness: 120, reduceMotion: ReduceMotion.Never }));

            // Green dot pops in
            dotScale.value = withDelay(600, withSpring(1, { damping: 10, stiffness: 200, reduceMotion: ReduceMotion.Never }));
            dotOp.value = withDelay(600, withTiming(1, { duration: 250, reduceMotion: ReduceMotion.Never }));

            // Underline sweeps across
            underlineW.value = withDelay(750, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
        };

        const timer = setTimeout(startAnimations, START_DELAY);

        // Session check
        const check = async () => {
            await new Promise(r => setTimeout(r, 3500));
            const user = await SheetService.loadSession();
            user ? goToApp(user) : navigation.replace('RoleSelection');
        };
        check();

        return () => clearTimeout(timer);
    }, []);

    const line1Style = useAnimatedStyle(() => ({
        opacity: line1Op.value,
        transform: [{ translateY: line1Y.value }],
    }));
    const line2Style = useAnimatedStyle(() => ({
        opacity: line2Op.value,
        transform: [{ translateY: line2Y.value }],
    }));
    const dotStyle = useAnimatedStyle(() => ({
        opacity: dotOp.value,
        transform: [{ scale: dotScale.value }],
    }));
    const underlineStyle = useAnimatedStyle(() => ({
        width: `${underlineW.value * 100}%`,
    }));

    return (
        <View style={styles.container}>
            <View style={styles.textBlock}>
                {/* BIKERS */}
                <Animated.View style={[styles.lineRow, line1Style]}>
                    <Text style={styles.wordBig}>BIKERS</Text>
                    <Animated.View style={[styles.dot, dotStyle]} />
                </Animated.View>

                {/* DELIVERY */}
                <Animated.View style={line2Style}>
                    <Text style={styles.wordSub}>DELIVERY</Text>
                </Animated.View>

                {/* Green underline sweep */}
                <View style={styles.underlineTrack}>
                    <Animated.View style={[styles.underlineFill, underlineStyle]} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textBlock: {
        alignItems: 'flex-start',
    },
    lineRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    wordBig: {
        fontSize: 64,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 6,
        lineHeight: 70,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#00FD3F',
        marginLeft: 4,
        marginTop: 10,
    },
    wordSub: {
        fontSize: 22,
        fontWeight: '700',
        color: '#00FD3F',
        letterSpacing: 14,
        marginTop: -6,
    },
    underlineTrack: {
        height: 3,
        width: '100%',
        backgroundColor: 'transparent',
        marginTop: 14,
        overflow: 'hidden',
    },
    underlineFill: {
        height: '100%',
        backgroundColor: '#00FD3F',
        borderRadius: 2,
    },
});

export default SplashScreen;
