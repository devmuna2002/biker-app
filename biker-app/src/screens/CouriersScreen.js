import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, Surface, useTheme, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bi } from '../components/AppIcon';

const CouriersScreen = ({ navigation }) => {
    const theme = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#000000' }]}>
            <View style={styles.header}>
                <IconButton icon={bi('arrow-left')} size={24} onPress={() => navigation.goBack()} iconColor="#FFF" />
                <Text style={[styles.headerTitle, { color: '#FFF' }]}>Market</Text>
                <View style={{ width: 48 }} />
            </View>

            <View style={styles.list}>
                <Surface style={[styles.card, { backgroundColor: '#121212' }]} elevation={2}>
                    <Text style={[styles.name, { color: '#FFF' }]}>Courier Deliveries</Text>
                    <Text style={[styles.eta, { color: 'rgba(255,255,255,0.6)' }]}>Courier is a service type, not a provider list. Use the Home screen to choose Courier, pick a destination, get a fare estimate, and confirm.</Text>
                    <Button
                        mode="contained"
                        style={{ marginTop: 14, borderRadius: 14 }}
                        buttonColor="#3277FF"
                        textColor="#000"
                        onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
                    >
                        Go To Home
                    </Button>
                </Surface>
            </View>
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
    list: {
        padding: 16,
    },
    card: {
        borderRadius: 12,
        marginBottom: 12,
        padding: 16,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    eta: {
        fontSize: 14,
    },
});

export default CouriersScreen;
