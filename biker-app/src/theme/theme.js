import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const darkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: '#2980B9',
        secondary: '#A8E05F',
        background: '#0A0A0A',
        surface: '#141414',
        surfaceVariant: 'rgba(30, 30, 30, 0.8)',
        text: '#FFFFFF',
        onSurface: '#FFFFFF',
        onBackground: '#FFFFFF',
        secondaryText: '#8E8E93',
        outline: '#3A3A3C',
        placeholder: '#636366',
        error: '#FF3B30',
        warning: '#FF9500',
        backdrop: 'rgba(0, 0, 0, 0.8)',
        notification: '#FF3B30',
        elevation: {
            level1: '#141414',
            level2: '#1A1A1A',
            level3: '#202020',
            level4: '#252525',
            level5: '#2A2A2A',
        }
    },
    roundness: 16,
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

