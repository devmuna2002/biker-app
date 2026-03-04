import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, BackHandler, Alert, Animated as RNAnimated } from 'react-native';
import { Text, Surface, Button, Avatar, IconButton, useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { bi } from '../components/AppIcon';
import SheetService from '../api/SheetService';
import AppSecurity from '../utils/AppSecurity';
import Animated, { FadeInDown, FadeInUp, BounceIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const TAGS = [
    { label: '🏍️ Smooth Ride', value: 'smooth_ride' },
    { label: '⚡ Fast', value: 'fast' },
    { label: '😊 Friendly', value: 'friendly' },
    { label: '🧭 Good Route', value: 'good_route' },
    { label: '📦 Careful', value: 'careful' },
    { label: '💬 Great Chat', value: 'great_chat' },
];

const NEGATIVE_TAGS = [
    { label: '🐢 Too Slow', value: 'too_slow' },
    { label: '😤 Rude', value: 'rude' },
    { label: '🚫 Bad Route', value: 'bad_route' },
    { label: '⚠️ Unsafe', value: 'unsafe' },
];

const RatingScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const theme = useTheme();
    const { bikerId, bikerName, bikerPhoto, orderId } = route.params || {};

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const scaleAnim = useRef(new RNAnimated.Value(1)).current;
    const tipAmount = useRef(0);

    // Block hardware back button — rating is mandatory
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!submitted) {
                Alert.alert(
                    'Rating Required',
                    'Please rate your driver before continuing. Your feedback helps keep the community safe.',
                    [{ text: 'OK' }]
                );
                return true; // prevents back
            }
            return false;
        });
        return () => sub.remove();
    }, [submitted]);

    const animateStar = () => {
        RNAnimated.sequence([
            RNAnimated.timing(scaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
            RNAnimated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
    };

    const toggleTag = (tag) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const getRatingLabel = () => {
        switch (rating) {
            case 1: return 'Terrible 😞';
            case 2: return 'Poor 😕';
            case 3: return 'Okay 😐';
            case 4: return 'Great 😊';
            case 5: return 'Amazing! 🤩';
            default: return 'Tap to rate';
        }
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Rating Required', 'Please select a star rating to continue.');
            return;
        }

        setLoading(true);
        try {
            const userId = SheetService.getUserId();
            await SheetService.submitRating({
                userId,
                orderId,
                bikerId,
                rating,
                comment: comment.trim(),
                tags: selectedTags,
                tipCents: tipAmount.current,
            });

            setSubmitted(true);
            // Clear pending rating flag
            await AppSecurity.clearPendingRating();

            // Auto-navigate after short delay
            setTimeout(() => {
                const userRole = SheetService.currentUser?.role;
                if (userRole === 'biker') {
                    if (navigation.canGoBack()) navigation.goBack();
                    else navigation.replace('BikerApp');
                } else {
                    if (navigation.canGoBack()) navigation.goBack();
                    else navigation.replace('MainApp');
                }
            }, 2000);
        } catch (e) {
            Alert.alert('Error', 'Could not submit rating. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Animated.View entering={BounceIn.duration(600)}>
                    <IconButton icon={bi('check-circle')} size={80} iconColor="#2ECC71" />
                </Animated.View>
                <Animated.Text entering={FadeInUp.delay(300)} style={styles.thankYouTitle}>
                    Thank You! 🎉
                </Animated.Text>
                <Animated.Text entering={FadeInUp.delay(500)} style={styles.thankYouSub}>
                    Your feedback makes bikerApp better for everyone.
                </Animated.Text>
            </View>
        );
    }

    const tags = rating >= 4 ? TAGS : rating >= 1 ? NEGATIVE_TAGS : [];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerLabel}>RATE YOUR RIDE</Text>
                <View style={styles.headerLine} />
            </View>

            <View style={styles.scrollContent}>
                {/* Driver Info */}
                <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.bikerSection}>
                    {bikerPhoto ? (
                        <Avatar.Image size={80} source={{ uri: bikerPhoto }} />
                    ) : (
                        <Avatar.Icon size={80} icon={bi('account')} style={{ backgroundColor: theme.colors.primary }} />
                    )}
                    <Text style={styles.bikerName}>{bikerName || 'Your Biker'}</Text>
                    <Text style={styles.subtitle}>How was your experience?</Text>
                </Animated.View>

                {/* Star Rating */}
                <Animated.View entering={FadeInDown.delay(200).duration(600)}>
                    <RNAnimated.View style={[styles.starsContainer, { transform: [{ scale: scaleAnim }] }]}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                                key={star}
                                onPress={() => {
                                    setRating(star);
                                    animateStar();
                                }}
                                activeOpacity={0.7}
                            >
                                <IconButton
                                    icon={bi(star <= rating ? 'star' : 'star-outline')}
                                    iconColor={star <= rating ? '#FFD700' : '#444'}
                                    size={44}
                                    style={{ margin: 0 }}
                                />
                            </TouchableOpacity>
                        ))}
                    </RNAnimated.View>
                    <Text style={styles.ratingLabel}>{getRatingLabel()}</Text>
                </Animated.View>

                {/* Quick Tags */}
                {tags.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.tagsContainer}>
                        {tags.map((tag) => (
                            <TouchableOpacity
                                key={tag.value}
                                onPress={() => toggleTag(tag.value)}
                                style={[
                                    styles.tag,
                                    selectedTags.includes(tag.value) && styles.tagActive,
                                ]}
                            >
                                <Text style={[
                                    styles.tagText,
                                    selectedTags.includes(tag.value) && styles.tagTextActive,
                                ]}>
                                    {tag.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </Animated.View>
                )}

                {/* Comment */}
                <Animated.View entering={FadeInDown.delay(400).duration(500)}>
                    <TextInput
                        style={styles.commentInput}
                        placeholder="Add a comment (optional)..."
                        placeholderTextColor="#555"
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        maxLength={200}
                    />
                    <Text style={styles.charCount}>{comment.length}/200</Text>
                </Animated.View>

                {/* Submit */}
                <Animated.View entering={FadeInUp.delay(500).duration(600)}>
                    <Button
                        mode="contained"
                        onPress={handleSubmit}
                        loading={loading}
                        disabled={loading || rating === 0}
                        style={[styles.submitButton, rating === 0 && styles.submitDisabled]}
                        contentStyle={{ height: 54 }}
                        labelStyle={{ fontSize: 16, fontWeight: 'bold', color: '#000' }}
                    >
                        Submit Rating
                    </Button>
                    <Text style={styles.mandatoryNotice}>
                        ⚠️ Rating is required to continue using the app
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
    header: {
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 8,
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: '#555',
        letterSpacing: 3,
    },
    headerLine: {
        width: 40,
        height: 3,
        backgroundColor: '#00FD3F',
        borderRadius: 2,
        marginTop: 8,
    },
    scrollContent: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    bikerSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    bikerName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginTop: 12,
    },
    subtitle: {
        fontSize: 15,
        color: '#888',
        marginTop: 4,
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 8,
    },
    ratingLabel: {
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        color: '#FFD700',
        marginBottom: 20,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 20,
    },
    tag: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    tagActive: {
        backgroundColor: '#00FD3F',
        borderColor: '#00FD3F',
    },
    tagText: {
        color: '#999',
        fontSize: 13,
    },
    tagTextActive: {
        color: '#000',
        fontWeight: '600',
    },
    commentInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        color: '#FFF',
        fontSize: 14,
        minHeight: 80,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#222',
    },
    charCount: {
        textAlign: 'right',
        color: '#444',
        fontSize: 11,
        marginTop: 4,
        marginBottom: 20,
    },
    submitButton: {
        borderRadius: 16,
        backgroundColor: '#00FD3F',
    },
    submitDisabled: {
        backgroundColor: '#333',
        opacity: 0.5,
    },
    mandatoryNotice: {
        textAlign: 'center',
        color: '#666',
        fontSize: 11,
        marginTop: 12,
    },
    thankYouTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFF',
        marginTop: 16,
    },
    thankYouSub: {
        fontSize: 15,
        color: '#888',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});

export default RatingScreen;
