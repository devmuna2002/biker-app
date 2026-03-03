import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, TextInput, Alert } from 'react-native';
import { Text, IconButton, Surface, useTheme, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import SheetService from '../api/SheetService';
import { bi } from '../components/AppIcon';

const SupportScreen = ({ navigation }) => {
    const theme = useTheme();
    const [ticketMessage, setTicketMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const submitTicket = async () => {
        const msg = ticketMessage.trim();
        if (!msg) {
            Alert.alert('Required', 'Please describe your issue before submitting.');
            return;
        }
        setSubmitting(true);
        try {
            const userId = SheetService.currentUser?.id || 0;
            const res = await SheetService.submitSupportTicket({ userId, message: msg });
            if (res?.success) {
                setSubmitted(true);
                setTicketMessage('');
                Alert.alert('✅ Ticket Submitted', `Your support ticket #${res.ticketId || 'N/A'} has been received. We'll respond within 24 hours.`);
            } else {
                throw new Error(res?.message || 'Submission failed');
            }
        } catch (e) {
            Alert.alert('Error', e?.message || 'Could not submit ticket. Try again later.');
        } finally {
            setSubmitting(false);
        }
    };

    const ContactOption = ({ icon, title, subtitle, action }) => (
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <View style={styles.row}>
                <IconButton icon={bi(icon)} size={32} iconColor={theme.colors.secondary} />
                <View style={styles.content}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.secondaryText || '#7F8C8D' }]}>{subtitle}</Text>
                </View>
                <Button mode="text" onPress={action} textColor={theme.colors.primary}>Open</Button>
            </View>
        </Surface>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <IconButton
                    icon={bi('arrow-left')}
                    size={24}
                    onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainApp')}
                    iconColor={theme.colors.text}
                />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Support</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentPad}>
                <Text style={[styles.description, { color: theme.colors.secondaryText || '#7F8C8D' }]}>
                    Need help with a recent trip or account issue? Our support team is here 24/7.
                </Text>

                <ContactOption
                    icon={bi('chat-processing')}
                    title="Live Chat"
                    subtitle="Chat with a support agent now"
                    action={() => navigation.navigate('Chat', { recipientName: 'Support', recipientRole: 'support' })}
                />
                <ContactOption
                    icon={bi('email-outline')}
                    title="Email Support"
                    subtitle="support@bikerapp.com"
                    action={() => Linking.openURL('mailto:support@bikerapp.com')}
                />
                <ContactOption
                    icon={bi('phone-outline')}
                    title="Call Us"
                    subtitle="+263 77 123 4567"
                    action={() => {
                        const phone = '+263771234567';
                        SheetService.recordCall({
                            userId: SheetService.currentUser?.id || 'anonymous',
                            recipientId: 'support',
                            name: 'Support Zimbabwe',
                            phoneNumber: phone,
                            type: 'outgoing',
                            startTime: new Date()
                        });
                        Linking.openURL(`tel:${phone}`).catch(() => {
                            Alert.alert('Error', 'Could not make call');
                        });
                    }}
                />
                <ContactOption
                    icon={bi('shield-alert')}
                    title="Safety Issue"
                    description="Report a safety concern"
                    action={() => navigation.navigate('Safety')}
                />

                {/* Support Ticket Form */}
                <View style={[styles.ticketSection, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.ticketTitle, { color: theme.colors.text }]}>📋 Submit a Ticket</Text>
                    <Text style={{ color: '#7F8C8D', fontSize: 13, marginBottom: 12 }}>
                        Describe your issue and our team will get back to you by email.
                    </Text>
                    <TextInput
                        style={[styles.ticketInput, { color: theme.colors.text, borderColor: theme.colors.primary || '#A8E05F' }]}
                        placeholder="Describe your problem..."
                        placeholderTextColor="#555"
                        value={ticketMessage}
                        onChangeText={setTicketMessage}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                    />
                    <Button
                        mode="contained"
                        onPress={submitTicket}
                        loading={submitting}
                        disabled={submitting}
                        style={{ borderRadius: 12, marginTop: 12 }}
                    >
                        {submitting ? 'Submitting...' : 'Submit Ticket'}
                    </Button>
                    {submitted && (
                        <Text style={{ color: '#2ECC71', textAlign: 'center', marginTop: 10, fontWeight: 'bold' }}>
                            ✓ Ticket submitted! We'll be in touch.
                        </Text>
                    )}
                </View>

                {/* FAQ Section */}
                <Text style={[styles.faqTitle, { color: theme.colors.text }]}>Frequently Asked Questions</Text>
                {[
                    { q: 'How do I request a ride?', a: 'Open the app, enter your destination, choose a service (Biker, Send a Package, or Local Services), and tap Confirm.' },
                    {
                        q: 'Can I send packages?', a: "Yes! Use the 'Send a Package' service. You'll be matched with a nearby biker for fast, reliable delivery."
                    },
                    { q: 'How do I become a biker/driver?', a: 'Register as a Biker on sign-up. Once verified, toggle Driver Mode from the home screen.' },
                    { q: 'How is the fare calculated?', a: 'Fares are $0.40/km + base fee. You\'ll see the estimate before confirming your order.' },
                    { q: 'What if my driver doesn\'t arrive?', a: 'Contact the driver via in-app chat/call. If unresolved, submit a support ticket.' },
                ].map((faq, i) => (
                    <Surface key={i} style={[styles.faqCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                        <Text style={[styles.faqQ, { color: theme.colors.text }]}>Q: {faq.q}</Text>
                        <Text style={[styles.faqA, { color: theme.colors.secondaryText || '#7F8C8D' }]}>A: {faq.a}</Text>
                    </Surface>
                ))}

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: '#7F8C8D' }]}>BikerApp v1.0.0 • support@bikerapp.com</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    contentPad: { padding: 16, paddingBottom: 40 },
    description: { marginBottom: 20, fontSize: 15, lineHeight: 22 },
    card: { borderRadius: 14, marginBottom: 12, padding: 6 },
    row: { flexDirection: 'row', alignItems: 'center' },
    content: { flex: 1 },
    title: { fontSize: 15, fontWeight: 'bold' },
    subtitle: { fontSize: 13 },
    ticketSection: {
        borderRadius: 18,
        padding: 18,
        marginTop: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    ticketTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 6 },
    ticketInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        minHeight: 100,
        backgroundColor: 'rgba(255,255,255,0.04)',
        lineHeight: 20,
    },
    faqTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
    faqCard: { borderRadius: 14, padding: 14, marginBottom: 10 },
    faqQ: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    faqA: { fontSize: 13, lineHeight: 18 },
    footer: { alignItems: 'center', marginTop: 32 },
    footerText: { fontSize: 12 },
});

export default SupportScreen;
