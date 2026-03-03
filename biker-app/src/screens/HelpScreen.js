import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, IconButton, Surface, useTheme, List } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const HelpScreen = ({ navigation }) => {
    const theme = useTheme();

    const FAQItem = ({ question, answer }) => (
        <List.Accordion
            title={question}
            titleStyle={{ color: theme.colors.text, fontWeight: 'bold' }}
            style={{ backgroundColor: theme.colors.surface, marginBottom: 1 }}
            theme={{ colors: { primary: theme.colors.primary } }}>
            <View style={{ padding: 16, backgroundColor: '#1A1A1A' }}>
                <Text style={{ color: theme.colors.secondaryText }}>{answer}</Text>
            </View>
        </List.Accordion>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} iconColor={theme.colors.text} />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Help Center</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Frequently Asked Questions</Text>

                <FAQItem
                    question="How do I book a ride?"
                    answer="Open Home, choose a service (Biker / Send a Package / Local Services), pick a destination, review the fare estimate, and confirm. The system will assign an available driver."
                />
                <FAQItem
                    question="Can I schedule a ride for later?"
                    answer="Currently, we only support on-demand rides. Scheduled rides will be coming in a future update."
                />
                <FAQItem
                    question="How do I contact my biker?"
                    answer="In-app messaging/calling is not enabled in this build. Use Support if you need help with an active order."
                />
                <FAQItem
                    question="What payment methods are accepted?"
                    answer="This build supports wallet payments. Card/cash provider integrations can be added on top of the backend payment module."
                />
            </ScrollView>
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
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        marginTop: 10,
    },
});

export default HelpScreen;
