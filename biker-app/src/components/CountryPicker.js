import React, { useState } from 'react';
import { View, StyleSheet, Modal, FlatList, TouchableOpacity, SearchBar } from 'react-native';
import { Text, Surface, IconButton, Searchbar, useTheme } from 'react-native-paper';
import { countries } from '../data/countries';
import { bi } from './AppIcon';

const CountryPicker = ({ visible, onDismiss, onSelect }) => {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCountries = countries.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.callingCode.includes(searchQuery)
    );

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onDismiss}
        >
            <View style={styles.modalOverlay}>
                <Surface style={[styles.modalContent, { backgroundColor: '#121212' }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Select Country</Text>
                        <IconButton icon={bi('close')} iconColor="#FFF" onPress={onDismiss} />
                    </View>

                    <Searchbar
                        placeholder="Search country or code..."
                        onChangeText={setSearchQuery}
                        value={searchQuery}
                        style={styles.searchBar}
                        inputStyle={{ color: '#FFF' }}
                        placeholderTextColor="#888"
                        iconColor="#00FD3F"
                    />

                    <FlatList
                        data={filteredCountries}
                        keyExtractor={(item) => item.code}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.item}
                                onPress={() => {
                                    onSelect(item);
                                    onDismiss();
                                }}
                            >
                                <View style={styles.itemRow}>
                                    <Text style={styles.countryName}>{item.name}</Text>
                                    <Text style={styles.callingCode}>{item.callingCode}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                </Surface>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '80%',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    searchBar: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginBottom: 20,
        borderRadius: 12,
    },
    item: {
        paddingVertical: 16,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    countryName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
    },
    callingCode: {
        color: '#00FD3F',
        fontSize: 16,
        fontWeight: 'bold',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
});

export default CountryPicker;
