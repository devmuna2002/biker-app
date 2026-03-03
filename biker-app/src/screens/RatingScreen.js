import React, { useState } from 'react';
import { View, StyleSheet, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { Surface, Button, Avatar, IconButton, useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';

const RatingScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const theme = useTheme();
    const { bikerId, bikerName, bikerPhoto } = route.params || {};

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');

    const handleRating = async () => {
        if (rating === 0) {
            Alert.alert('Rate your ride', 'Please select a star rating.');
            return;
        }
        Alert.alert('Not enabled', 'Driver rating is not configured on this backend yet.', [
            { text: 'OK', onPress: () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainApp') },
        ]);
    };

    return (
        <View style={styles.container}>
            <Surface style={styles.card} elevation={4}>
                <View style={styles.bikerInfo}>
                    {bikerPhoto ? (
                        <Avatar.Image size={80} source={{ uri: bikerPhoto }} />
                    ) : (
                        <Avatar.Icon size={80} icon="account" style={{ backgroundColor: theme.colors.primary }} />
                    )}
                    <Text style={styles.bikerName}>{bikerName || 'Your Biker'}</Text>
                    <Text style={styles.subtitle}>How was your ride?</Text>
                </View>

                <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setRating(star)}>
                            <IconButton
                                icon={star <= rating ? "star" : "star-outline"}
                                iconColor={star <= rating ? "#FFD700" : "#BDC3C7"}
                                size={40}
                                style={{ margin: 0 }}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                <Button
                    mode="contained"
                    onPress={handleRating}
                    style={styles.submitButton}
                    contentStyle={{ height: 50 }}
                >
                    Submit Rating
                </Button>

                <Button
                    mode="text"
                    onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainApp')}
                    style={styles.skipButton}
                    textColor="#7f8c8d"
                >
                    Skip
                </Button>
            </Surface>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212', // Dark background
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
    },
    bikerInfo: {
        alignItems: 'center',
        marginBottom: 30,
    },
    bikerName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginTop: 15,
    },
    subtitle: {
        fontSize: 16,
        color: '#BDC3C7',
        marginTop: 5,
    },
    starsContainer: {
        flexDirection: 'row',
        marginBottom: 40,
    },
    submitButton: {
        width: '100%',
        borderRadius: 25,
        backgroundColor: '#2ECC71', // Green
    },
    skipButton: {
        marginTop: 10,
    }
});

export default RatingScreen;
