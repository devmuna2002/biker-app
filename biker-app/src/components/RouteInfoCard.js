import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, IconButton, Button } from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { bi } from './AppIcon';

const { width } = Dimensions.get('window');

const RouteInfoCard = ({ nextStop, destination, onCancel }) => {
    return (
        <View style={styles.container}>
            <BlurView intensity={30} tint="dark" style={styles.blurContainer}>
                {/* Next Charging Stop (or Waypoint) */}
                <View style={styles.cardHeader}>
                    <View style={styles.stopInfo}>
                        <View style={styles.iconContainer}>
                            <IconButton icon={bi('flash')} size={20} iconColor="#F1C40F" />
                        </View>
                        <View>
                            <Text style={styles.stopLabel}>Next Charge</Text>
                            <Text style={styles.stopDetails}>
                                {nextStop.distance} • {nextStop.time} • {nextStop.battery}%
                            </Text>
                        </View>
                    </View>
                    <IconButton icon={bi('chevron-up')} size={24} iconColor="#FFF" />
                </View>

                {/* Destination */}
                <View style={styles.cardBody}>
                    <View style={styles.stopInfo}>
                        <View style={[styles.iconContainer, { backgroundColor: '#E74C3C' }]}>
                            <IconButton icon={bi('map-marker')} size={20} iconColor="#FFF" />
                        </View>
                        <View>
                            <Text style={styles.stopLabel}>Destination</Text>
                            <Text style={styles.stopDetails}>
                                {destination.name}
                            </Text>
                            <Text style={styles.metaDetails}>
                                {destination.distance} • {destination.time} • ETA {destination.eta}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.footer}>
                    <Button
                        mode="contained"
                        buttonColor="#E74C3C"
                        style={styles.actionButton}
                        onPress={onCancel}
                    >
                        End Trip
                    </Button>
                </View>
            </BlurView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        borderRadius: 24,
        overflow: 'hidden', // Required for BlurView border radius on iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    blurContainer: {
        padding: 20,
        backgroundColor: 'rgba(30, 30, 30, 0.6)', // Fallback / Tint
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255, 193, 7, 0.1)', // Gold tint for charging
        marginHorizontal: -20,
        paddingHorizontal: 20,
        paddingTop: 10,
        marginTop: -20,
    },
    stopInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    stopLabel: {
        fontSize: 12,
        color: '#B0B0B0',
        fontWeight: '600',
    },
    stopDetails: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: 'bold',
        marginTop: 2,
    },
    metaDetails: {
        fontSize: 14,
        color: '#B0B0B0',
        marginTop: 2,
    },
    footer: {
        flexDirection: 'row',
        marginTop: 20,
        justifyContent: 'space-between',
    },
    actionButton: {
        flex: 1,
        borderRadius: 12,
    },
});

export default RouteInfoCard;
