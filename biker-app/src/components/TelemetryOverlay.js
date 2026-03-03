import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

const TelemetryOverlay = ({ currentSpeed = 0, speedLimit = 60 }) => {
    // Animation for speed changes (simplified)
    const speedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(1) }], // Placeholder for future animation
        };
    });

    const isSpeeding = currentSpeed > speedLimit;

    return (
        <View style={styles.container}>
            {/* Speed Limit Sign */}
            <View style={styles.speedLimitContainer}>
                <View style={styles.speedLimitCircle}>
                    <Text style={styles.limitLabel}>LIMIT</Text>
                    <Text style={styles.limitValue}>{speedLimit}</Text>
                </View>
            </View>

            {/* Current Speed Display */}
            <Animated.View style={[styles.speedDisplay, speedStyle]}>
                <Text style={[styles.currentSpeed, isSpeeding && styles.speedingText]}>
                    {currentSpeed}
                </Text>
                <Text style={styles.unitLabel}>km/h</Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 100,
        left: 20,
        alignItems: 'center',
    },
    speedLimitContainer: {
        marginBottom: 15,
        backgroundColor: '#FFFFFF',
        borderRadius: 25,
        borderWidth: 4,
        borderColor: '#E74C3C', // Red ring
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    speedLimitCircle: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    limitLabel: {
        fontSize: 6,
        fontWeight: 'bold',
        color: '#000',
    },
    limitValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
        marginTop: -2,
    },
    speedDisplay: {
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 10,
        borderRadius: 12,
    },
    currentSpeed: {
        fontSize: 42,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -1,
    },
    speedingText: {
        color: '#E74C3C', // Turn red if speeding
    },
    unitLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#B0B0B0',
        marginTop: -5,
    },
});

export default TelemetryOverlay;
