import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

const BrandMark = ({
  size = 120,
  subtitle,
  showWordmark = true,
  subtitleColor,
  logoColor,
}) => {
  const theme = useTheme();
  const subtitleFg = subtitleColor || theme.colors.secondaryText;

  return (
    <View style={styles.container}>
      {/* Logo Image */}
      <View style={[styles.mark, { width: size, height: size }]}>
        <Image
          source={require('../../assets/logo.png')}
          style={[styles.logo, logoColor ? { tintColor: logoColor } : null]}
          resizeMode="contain"
        />
      </View>

      {showWordmark && subtitle && (
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Text style={[styles.subtitle, { color: subtitleFg }]}>{subtitle}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
  },
});

export default BrandMark;
