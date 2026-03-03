import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, Surface, useTheme, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const CouriersScreen = ({ navigation }) => {
    const theme = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} iconColor={theme.colors.text} />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Couriers</Text>
                <View style={{ width: 48 }} />
            </View>

            <View style={styles.list}>
                <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
                    <Text style={[styles.name, { color: theme.colors.text }]}>Courier Deliveries</Text>
                    <Text style={[styles.eta, { color: theme.colors.secondaryText }]}>Courier is a service type, not a provider list. Use the Home screen to choose Courier, pick a destination, get a fare estimate, and confirm.</Text>
                    <Button
                        mode="contained"
                        style={{ marginTop: 14, borderRadius: 12 }}
                        buttonColor={theme.colors.primary}
                        onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainApp')}
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
