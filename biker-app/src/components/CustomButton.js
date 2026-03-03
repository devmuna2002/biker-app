import React from 'react';
import { Button } from 'react-native-paper';
import { StyleSheet } from 'react-native';

const CustomButton = ({ title, onPress, mode = 'contained', style, labelStyle, ...props }) => {
    return (
        <Button
            mode={mode}
            onPress={onPress}
            style={[styles.button, style]}
            contentStyle={styles.content}
            labelStyle={[styles.label, labelStyle]}
            uppercase={false}
            {...props}
        >
            {title}
        </Button>
    );
};

const styles = StyleSheet.create({
    button: {
        marginVertical: 12,
        borderRadius: 16,
        elevation: 0,
    },
    content: {
        height: 56,
    },
    label: {
        fontSize: 16,
        letterSpacing: 1.2,
    },
});

export default CustomButton;
