import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const darkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: '#3277FF', // Vibrant Blue
        secondary: '#5AC8FA', // Light Blue (iOS Style)
        background: '#000000', // Pure black for OLED
        surface: '#121212', // Subtle surface
        surfaceVariant: '#1C1C1E', // Apple-style surface variant
        text: '#FFFFFF',
        onSurface: '#FFFFFF',
        onBackground: '#FFFFFF',
        secondaryText: '#8E8E93',
        outline: '#2C2C2E', // Subtle dividers
        placeholder: '#48484A',
        error: '#FF453A',
        warning: '#FF9F0A',
        backdrop: 'rgba(0, 0, 0, 0.9)',
        notification: '#FF453A',
        elevation: {
            level1: '#121212',
            level2: '#1C1C1E',
            level3: '#2C2C2E',
            level4: '#3A3A3C',
            level5: '#48484A',
        }
    },
    roundness: 24, // Modern high-radius corners
};

export const lightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: '#2980B9',
        secondary: '#2ECC71',
        background: '#F8F9FA',
        surface: '#FFFFFF',
        surfaceVariant: 'rgba(255, 255, 255, 0.9)',
        text: '#1C1C1E',
        onSurface: '#1C1C1E',
        onBackground: '#1C1C1E',
        secondaryText: '#8E8E93',
        outline: '#D1D1D6',
        placeholder: '#C7C7CC',
        error: '#FF3B30',
        warning: '#FF9500',
        backdrop: 'rgba(0, 0, 0, 0.5)',
        notification: '#FF3B30',
        elevation: {
            level1: '#FFFFFF',
            level2: '#F2F2F7',
            level3: '#E5E5EA',
            level4: '#D1D1D6',
            level5: '#C7C7CC',
        }
    },
    roundness: 16,
};

// Keep default theme for legacy components if any
export const theme = darkTheme;

