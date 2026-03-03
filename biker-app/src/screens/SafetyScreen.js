import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Linking, TextInput, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, IconButton, Surface, useTheme, Button, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import SheetService from '../api/SheetService';
import { bi } from '../components/AppIcon';
import * as Location from 'expo-location';

const SafetyScreen = ({ navigation }) => {
    const theme = useTheme();
    const [contacts, setContacts] = useState([]);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [addingContact, setAddingContact] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [sosLoading, setSosLoading] = useState(false);
    const [tips, setTips] = useState([]);
    const [tipsLoading, setTipsLoading] = useState(false);
    const userId = SheetService.currentUser?.id || 0;

    useEffect(() => {
        loadContacts();
        loadTips();
    }, []);

    const loadContacts = async () => {
        try {
            const res = await SheetService.getTrustedContacts(userId);
            setContacts(res?.data || res || []);
        } catch {
            setContacts([]);
        }
    };

    const loadTips = async () => {
        setTipsLoading(true);
        try {
            const res = await SheetService.getSafetyTips();
            setTips(res?.tips || res?.data?.tips || DEFAULT_TIPS);
        } catch {
            setTips(DEFAULT_TIPS);
        } finally {
            setTipsLoading(false);
        }
    };

    const addContact = async () => {
        if (!newName.trim() || !newPhone.trim()) {
            Alert.alert('Required', 'Please enter both name and phone number.');
            return;
        }
        setAddingContact(true);
        try {
            await SheetService.addTrustedContact({ userId, name: newName.trim(), phone: newPhone.trim() });
            setNewName('');
            setNewPhone('');
            setShowAddForm(false);
            await loadContacts();
        } catch (e) {
            Alert.alert('Error', e?.message || 'Failed to add contact.');
        } finally {
            setAddingContact(false);
        }
    };

    const removeContact = async (contactId) => {
        Alert.alert('Remove Contact', 'Remove this trusted contact?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: async () => {
                    try {
                        await SheetService.removeTrustedContact(contactId);
                        await loadContacts();
                    } catch (e) {
                        Alert.alert('Error', e?.message || 'Failed to remove contact.');
                    }
                },
            },
        ]);
    };

    const triggerSOS = async () => {
        Alert.alert(
            '🚨 SOS Alert',
            'This will notify your trusted contacts and emergency services with your current location. Confirm?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'SEND SOS 🚨',
                    style: 'destructive',
                    onPress: async () => {
                        setSosLoading(true);
                        try {
                            const { status } = await Location.requestForegroundPermissionsAsync();
                            let loc = null;
                            if (status === 'granted') {
                                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                                loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                            }

                            const res = await SheetService.triggerSOS({ userId, location: loc });
                            const phone = '999'; // Emergency number — make configurable
                            Linking.openURL(`tel:${phone}`).catch(() => { });

                            Alert.alert(
                                '✅ SOS Sent',
                                res?.message || `Trusted contacts notified. Dialing emergency services.`
                            );
                        } catch (e) {
                            Alert.alert('SOS Error', e?.message || 'Could not send SOS. Please call emergency services manually.');
                        } finally {
                            setSosLoading(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <IconButton icon={bi('arrow-left')} size={24} onPress={() => navigation.goBack()} iconColor={theme.colors.text} />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Safety Tools</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* SOS Button */}
                <TouchableOpacity style={styles.sosButton} onPress={triggerSOS} activeOpacity={0.8} disabled={sosLoading}>
                    <View style={styles.sosInner}>
                        {sosLoading ? (
                            <ActivityIndicator size="large" color="#FFF" />
                        ) : (
                            <>
                                <IconButton icon={bi('alarm-light')} size={48} iconColor="#FFF" style={{ margin: 0 }} />
                                <Text style={styles.sosLabel}>SOS</Text>
                                <Text style={styles.sosSub}>Tap to alert trusted contacts + emergency services</Text>
                            </>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Trusted Contacts */}
                <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
                    <View style={styles.cardHeader}>
                        <IconButton icon={bi('account-group')} size={22} iconColor="#3498DB" style={{ margin: 0 }} />
                        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Trusted Contacts</Text>
                        <IconButton
                            icon={bi(showAddForm ? 'close' : 'plus')}
                            size={20}
                            iconColor={theme.colors.secondary}
                            onPress={() => setShowAddForm(v => !v)}
                        />
                    </View>

                    {showAddForm && (
                        <View style={styles.addForm}>
                            <TextInput
                                style={[styles.addInput, { color: theme.colors.text, borderColor: theme.colors.outline }]}
                                placeholder="Full name"
                                placeholderTextColor="#555"
                                value={newName}
                                onChangeText={setNewName}
                            />
                            <TextInput
                                style={[styles.addInput, { color: theme.colors.text, borderColor: theme.colors.outline }]}
                                placeholder="Phone number (e.g. +263...)"
                                placeholderTextColor="#555"
                                value={newPhone}
                                onChangeText={setNewPhone}
                                keyboardType="phone-pad"
                            />
                            <Button
                                mode="contained"
                                onPress={addContact}
                                loading={addingContact}
                                disabled={addingContact}
                                buttonColor="#3498DB"
                                style={{ borderRadius: 12, marginTop: 4 }}
                            >
                                Add Contact
                            </Button>
                        </View>
                    )}

                    <Divider style={{ backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 8 }} />

                    {contacts.length === 0 ? (
                        <Text style={styles.emptyText}>No trusted contacts added yet. Add someone you trust.</Text>
                    ) : (
                        contacts.map((c, i) => (
                            <View key={c.id || i} style={styles.contactRow}>
                                <View style={styles.contactAvatar}>
                                    <Text style={styles.contactAvatarText}>{(c.name || '?')[0].toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[styles.contactName, { color: theme.colors.text }]}>{c.name}</Text>
                                    <Text style={styles.contactPhone}>{c.phone}</Text>
                                </View>
                                <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                                    <IconButton icon={bi('phone')} size={20} iconColor="#2ECC71" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => removeContact(c.id)}>
                                    <IconButton icon={bi('delete-outline')} size={20} iconColor="#E74C3C" />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </Surface>

                {/* Report & Support Links */}
                <View style={styles.quickLinks}>
                    <TouchableOpacity
                        style={[styles.quickLink, { backgroundColor: theme.colors.surface }]}
                        onPress={() => navigation.navigate('Support')}
                    >
                        <IconButton icon={bi('shield-alert')} size={24} iconColor="#E74C3C" style={{ margin: 0 }} />
                        <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>Report Incident</Text>
                        <IconButton icon={bi('chevron-right')} size={18} iconColor="#555" style={{ margin: 0 }} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.quickLink, { backgroundColor: theme.colors.surface }]}
                        onPress={() => Linking.openURL('tel:999')}
                    >
                        <IconButton icon={bi('phone-alert')} size={24} iconColor="#E74C3C" style={{ margin: 0 }} />
                        <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>Emergency: 999</Text>
                        <IconButton icon={bi('chevron-right')} size={18} iconColor="#555" style={{ margin: 0 }} />
                    </TouchableOpacity>
                </View>

                {/* Safety Tips */}
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Safety Tips</Text>
                {tipsLoading ? (
                    <ActivityIndicator color={theme.colors.secondary} style={{ marginVertical: 16 }} />
                ) : (
                    tips.map((tip, i) => (
                        <Surface key={tip.id || i} style={[styles.tipCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                            <IconButton icon={bi(tip.icon || 'alert-circle')} size={22} iconColor={theme.colors.secondary} style={{ margin: 0 }} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.tipTitle, { color: theme.colors.text }]}>{tip.title}</Text>
                                <Text style={styles.tipBody}>{tip.body}</Text>
                            </View>
                        </Surface>
                    ))
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const DEFAULT_TIPS = [
    { id: 1, icon: 'shield-check', title: 'Verify Your Driver', body: 'Always check that the biker\'s name, photo, and plate match what is shown in the app.' },
    { id: 2, icon: 'map-marker-radius', title: 'Share Your Trip', body: 'Send your live trip tracking to a trusted contact before you ride.' },
    { id: 3, icon: 'helmet', title: 'Wear a Helmet', body: 'Always wear the helmet provided by the driver.' },
    { id: 4, icon: 'account-group', title: 'Trusted Contacts', body: 'Add trusted contacts so we can notify them automatically on SOS.' },
    { id: 5, icon: 'phone-alert', title: 'Use In-App Chat', body: 'Use in-app chat/call instead of sharing personal phone numbers.' },
];

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingBottom: 8,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 16, paddingBottom: 60 },
    sosButton: {
        backgroundColor: '#C0392B',
        borderRadius: 24,
        marginBottom: 20,
        elevation: 10,
        shadowColor: '#E74C3C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    sosInner: {
        alignItems: 'center',
        paddingVertical: 28,
        paddingHorizontal: 20,
    },
    sosLabel: {
        color: '#FFF',
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: 8,
        marginTop: 4,
    },
    sosSub: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 6,
    },
    card: {
        borderRadius: 18,
        padding: 14,
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: 'bold', marginLeft: 6 },
    addForm: { paddingVertical: 10, gap: 10 },
    addInput: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
    },
    emptyText: { color: '#7F8C8D', fontSize: 13, paddingVertical: 8, paddingHorizontal: 4, textAlign: 'center' },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    contactAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#2C3E50',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contactAvatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
    contactName: { fontSize: 15, fontWeight: 'bold' },
    contactPhone: { fontSize: 12, color: '#7F8C8D' },
    quickLinks: { marginBottom: 20, gap: 10 },
    quickLink: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        elevation: 2,
    },
    quickLinkText: { flex: 1, fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
    },
    tipTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 3 },
    tipBody: { fontSize: 12, color: '#7F8C8D', lineHeight: 18 },
});

export default SafetyScreen;
