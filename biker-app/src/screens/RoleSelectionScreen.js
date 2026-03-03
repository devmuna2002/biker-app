import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    FadeInDown,
    FadeInUp
} from 'react-native-reanimated';
import BrandMark from '../components/BrandMark';

const RoleSelectionScreen = ({ navigation }) => {
    const [selectedRole, setSelectedRole] = useState(null);

    const titleOpacity = useSharedValue(0);
    const titleTranslateY = useSharedValue(-20);

    useEffect(() => {
        titleOpacity.value = withTiming(1, { duration: 800 });
        titleTranslateY.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.exp) });
    }, []);

    const titleStyle = useAnimatedStyle(() => ({
        opacity: titleOpacity.value,
        transform: [{ translateY: titleTranslateY.value }],
    }));

    const handleProceed = () => {
        if (selectedRole) {
            navigation.navigate('Register', { role: selectedRole });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Animated.View style={[styles.header, titleStyle]}>
                    <BrandMark size={80} subtitle="Welcome" logoColor="#00C853" />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200).duration(800)}>
                    <Text style={styles.instruction}>Select your account type</Text>
                </Animated.View>

                <View style={styles.selectionContainer}>
                    <Animated.View entering={FadeInDown.delay(300).duration(800)}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setSelectedRole('user')}
                            style={[
                                styles.optionRow,
                                selectedRole === 'user' && styles.optionRowActive
                            ]}
                        >
                            <View style={styles.radioOuter}>
                                {selectedRole === 'user' && <View style={styles.radioInner} />}
                            </View>
                            <Text style={styles.optionTitle}>Customer</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(400).duration(800)}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setSelectedRole('biker')}
                            style={[
                                styles.optionRow,
                                selectedRole === 'biker' && styles.optionRowActive
                            ]}
                        >
                            <View style={styles.radioOuter}>
                                {selectedRole === 'biker' && <View style={styles.radioInner} />}
                            </View>
                            <Text style={styles.optionTitle}>Biker</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                <Animated.View entering={FadeInUp.delay(500).duration(800)} style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[
                            styles.proceedButton,
                            !selectedRole && styles.proceedButtonDisabled
                        ]}
                        disabled={!selectedRole}
                        onPress={handleProceed}
                        activeOpacity={0.8}
                    >
                        <Text style={[
                            styles.proceedButtonText,
                            !selectedRole && styles.proceedButtonTextDisabled
                        ]}>
                            Proceed
                        </Text>
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.footer}>
                    <Text style={styles.footerText}>
                        Already have an account?{" "}
                        <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
                            Sign In
                        </Text>
                    </Text>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0B0B',
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    instruction: {
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: '700',
        marginBottom: 24,
        textAlign: 'center',
    },
    selectionContainer: {
        gap: 16,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        padding: 18,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    optionRowActive: {
        backgroundColor: 'rgba(0, 200, 83, 0.05)',
        borderColor: '#00C853',
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#555',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#00C853',
    },
    optionTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonContainer: {
        marginTop: 40,
    },
    proceedButton: {
        backgroundColor: '#00C853',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    proceedButtonDisabled: {
        backgroundColor: 'rgba(0, 200, 83, 0.3)',
    },
    proceedButtonText: {
        color: '#000000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    proceedButtonTextDisabled: {
        color: 'rgba(0, 0, 0, 0.5)',
    },
    footer: {
        marginTop: 32,
        alignItems: 'center',
    },
    footerText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
    },
    link: {
        color: '#00C853',
        fontWeight: 'bold',
    },
});

export default RoleSelectionScreen;
