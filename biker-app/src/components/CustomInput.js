import React from 'react';
import { TextInput } from 'react-native-paper';
import { StyleSheet } from 'react-native';

const CustomInput = ({ label, value, onChangeText, secureTextEntry, textColor = '#FFFFFF', ...props }) => {
    return (
        <TextInput
            label={label}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            mode="outlined"
            style={styles.input}
            outlineColor="rgba(255,255,255,0.1)"
            activeOutlineColor="#00FD3F"
            placeholderTextColor="rgba(255,255,255,0.4)"
            textColor={textColor}
            {...props}
        />
    );
};

const styles = StyleSheet.create({
    input: {
        marginVertical: 4,
        backgroundColor: 'rgba(0,0,0,0.2)',
        fontSize: 14,
    },
});

export default CustomInput;
