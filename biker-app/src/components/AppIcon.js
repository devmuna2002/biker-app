/**
 * AppIcon – Bootstrap-style icon system using Ionicons (bundled with Expo).
 *
 * Usage:
 *   import { bi } from '../components/AppIcon';
 *
 *   // As a react-native-paper icon prop (IconButton, Avatar.Icon, Button, etc.):
 *   <IconButton icon={bi('motorbike')} />
 *
 *   // Standalone:
 *   import AppIcon from '../components/AppIcon';
 *   <AppIcon name="motorbike" size={24} color="#FFF" />
 */

import React from 'react';
import { Ionicons } from '@expo/vector-icons';

// Map logical icon names → Ionicons glyph names.
// Keeps every call-site readable; only this file knows the glyph set.
const ICON_MAP = {
    // ─── Transport & Delivery ──────────────────────────
    'motorbike': 'bicycle',
    'motorbike-outline': 'bicycle-outline',
    'package-variant-closed': 'cube',
    'package-variant': 'cube-outline',
    'cube': 'cube',
    'cube-outline': 'cube-outline',
    'car': 'car-sport',
    'car-outline': 'car-sport-outline',
    'bus': 'bus',
    'airplane': 'airplane',
    'navigate': 'navigate',
    'navigate-outline': 'navigate-outline',
    'speedometer': 'speedometer',
    'flag-checkered': 'flag',
    'alarm-light': 'alert-circle',

    // ─── UI / Navigation ──────────────────────────────
    'menu': 'menu',
    'close': 'close',
    'close-circle': 'close-circle',
    'arrow-left': 'arrow-back',
    'arrow-right': 'arrow-forward',
    'arrow-back': 'arrow-back',
    'chevron-right': 'chevron-forward',
    'chevron-left': 'chevron-back',
    'chevron-down': 'chevron-down',
    'chevron-up': 'chevron-up',
    'arrow-expand-all': 'expand',
    'dots-vertical': 'ellipsis-vertical',
    'plus': 'add',
    'plus-circle': 'add-circle',
    'minus': 'remove',
    'arrow-top-left': 'return-up-back',
    'pencil': 'pencil',

    // ─── Dashboard & Home ─────────────────────────────
    'view-dashboard': 'grid',
    'grid': 'grid',
    'home': 'home',
    'home-outline': 'home-outline',
    'radar': 'radio',
    'radio': 'radio',
    'pulse': 'pulse',

    // ─── People & Account ─────────────────────────────
    'account': 'person',
    'account-outline': 'person-outline',
    'account-circle': 'person-circle',
    'account-group': 'people',
    'logout': 'log-out',

    // ─── Communication ────────────────────────────────
    'phone': 'call',
    'phone-outline': 'call-outline',
    'phone-hangup': 'call',
    'phone-in-talk': 'call',
    'phone-alert': 'call',
    'chat': 'chatbubble-ellipses',
    'chat-outline': 'chatbubble-ellipses-outline',
    'chat-processing': 'chatbubble-ellipses',
    'message': 'chatbubble',
    'message-outline': 'chatbubble-outline',
    'email-outline': 'mail-outline',
    'send': 'send',
    'send-outline': 'send-outline',

    // ─── Notifications & Alerts ───────────────────────
    'bell': 'notifications',
    'bell-outline': 'notifications-outline',
    'bell-ring': 'notifications',
    'alert': 'alert-circle',
    'alert-circle': 'alert-circle',
    'information': 'information-circle',
    'information-outline': 'information-circle-outline',

    // ─── Status & Actions ────────────────────────────
    'check': 'checkmark',
    'check-circle': 'checkmark-circle',
    'check-circle-outline': 'checkmark-circle-outline',
    'checkmark-done': 'checkmark-done',
    'lock': 'lock-closed',
    'lock-alert': 'lock-closed',
    'lock-open': 'lock-open',
    'lock-closed': 'lock-closed',
    'shield': 'shield-checkmark',
    'shield-check': 'shield-checkmark',
    'shield-alert': 'shield',
    'shield-check-outline': 'shield-checkmark-outline',

    // ─── Media ────────────────────────────────────────
    'camera': 'camera',
    'camera-outline': 'camera-outline',
    'camera-plus': 'camera',
    'image': 'image',
    'image-outline': 'image-outline',
    'image-plus': 'images',
    'images': 'images',
    'microphone': 'mic',
    'mic': 'mic',
    'mic-outline': 'mic-outline',
    'play': 'play',
    'play-outline': 'play-outline',
    'stop': 'stop',
    'stop-circle': 'stop-circle',
    'volume-high': 'volume-high',

    // ─── Map & Location ──────────────────────────────
    'map-marker': 'location',
    'map-marker-outline': 'location-outline',
    'map-marker-radius': 'locate',
    'map-marker-plus': 'location',
    'location': 'location',
    'location-outline': 'location-outline',
    'compass': 'compass',
    'compass-outline': 'compass-outline',
    'navigation-variant': 'navigate',
    'earth': 'earth',
    'globe': 'globe',
    'map-search-outline': 'search',

    // ─── Finance & Payments ───────────────────────────
    'credit-card': 'card',
    'card': 'card',
    'card-outline': 'card-outline',
    'wallet': 'wallet',
    'wallet-outline': 'wallet-outline',
    'cash': 'cash',
    'cash-outline': 'cash-outline',
    'receipt': 'receipt',

    // ─── Time & History ───────────────────────────────
    'history': 'time',
    'time': 'time',
    'time-outline': 'time-outline',
    'clock': 'time',
    'calendar': 'calendar',
    'calendar-outline': 'calendar-outline',
    'timer': 'timer',
    'calendar-week': 'calendar',
    'calendar-month': 'calendar',

    // ─── Settings & Preferences ───────────────────────
    'settings': 'settings',
    'settings-outline': 'settings-outline',
    'cog': 'settings',
    'tune': 'options',
    'weather-night': 'moon',
    'moon': 'moon',
    'sunny': 'sunny',
    'cog-outline': 'settings-outline',

    // ─── Misc ─────────────────────────────────────────
    'star': 'star',
    'star-outline': 'star-outline',
    'heart': 'heart',
    'heart-outline': 'heart-outline',
    'gift': 'gift',
    'gift-outline': 'gift-outline',
    'eye': 'eye',
    'eye-outline': 'eye-outline',
    'eye-off': 'eye-off',
    'eye-off-outline': 'eye-off-outline',
    'cloud-sync': 'cloud',
    'cloud': 'cloud',
    'cloud-outline': 'cloud-outline',
    'search': 'search',
    'magnify': 'search',
    'filter': 'filter',
    'trash': 'trash',
    'trash-outline': 'trash-outline',
    'delete': 'trash',
    'delete-sweep': 'trash',
    'delete-outline': 'trash-outline',
    'refresh': 'refresh',
    'reload': 'reload',
    'copy': 'copy',
    'share': 'share-social',
    'share-outline': 'share-social-outline',
    'download': 'download',
    'upload': 'cloud-upload',
    'link': 'link',
    'open-in-new': 'open',
    'qr-code': 'qr-code',
    'barcode': 'barcode',
    'flash': 'flash',
    'flashlight': 'flashlight',
    'power': 'power',
    'log-out': 'log-out',
    'log-in': 'log-in',
    'help': 'help',
    'flag': 'flag',
    'bank': 'card',
    'atm': 'cash',
    'bed': 'bed',
    'tree': 'leaf',
    'leaf': 'leaf',
    'dumbbell': 'fitness',
    'fitness': 'fitness',
    'gas-station': 'fuel',
    'parking': 'car',
    'road-variant': 'road',
    'office-building': 'business',
    'cake-variant': 'gift',
    'alpha-p-circle': 'logo-paypal',
    'google': 'logo-google',
    'apple': 'logo-apple',
    'facebook': 'logo-facebook',
    'instagram': 'logo-instagram',

    // ─── Store / Commerce ─────────────────────────────
    'store': 'storefront',
    'storefront': 'storefront',
    'storefront-outline': 'storefront-outline',
    'cart': 'cart',
    'cart-outline': 'cart-outline',
    'bag': 'bag',
    'pricetag': 'pricetag',
    'shopping': 'cart',
    'shop': 'storefront',
    'market': 'storefront',

    // ─── Medical / Services ───────────────────────────
    'medical-bag': 'medkit',
    'medkit': 'medkit',
    'medical': 'medkit',
    'hospital': 'medical',
    'pharmacy': 'medical',
    'health': 'medical',

    // ─── Food & Drink ────────────────────────────────
    'silverware-fork-knife': 'restaurant',
    'restaurant': 'restaurant',
    'restaurant-outline': 'restaurant-outline',
    'glass-cocktail': 'wine',
    'wine': 'wine',
    'cafe': 'cafe',
    'beer': 'beer',
    'pizza': 'pizza',
    'food': 'restaurant',
    'cafe': 'cafe',

    // ─── Buildings ────────────────────────────────────
    'church': 'business',
    'school': 'school',
    'school-outline': 'school-outline',
    'business': 'business',

    // ─── Personal Care ───────────────────────────────
    'content-cut': 'cut',
    'cut': 'cut',
    'tshirt-crew': 'shirt',
    'shirt': 'shirt',

    // ─── Arrows (for accessibility) ──────────────────
    'arrow-up': 'arrow-up',
    'arrow-down': 'arrow-down',
    'road': 'navigate-outline',
    'store': 'storefront',
    'home': 'home',
    'office': 'business',
};

/**
 * Resolve a logical icon name to an Ionicons glyph name.
 * Falls back to the literal name if not in the map.
 */
const resolve = (name) => ICON_MAP[name] || name || 'help-circle';

/**
 * Standalone icon component.
 * @param {{ name: string, size?: number, color?: string, style?: object }} props
 */
const AppIcon = ({ name, size = 24, color = '#FFFFFF', style }) => (
    <Ionicons name={resolve(name)} size={size} color={color} style={style} />
);

/**
 *  Helper that returns a react-native-paper compatible icon render function.
 *  Use with <IconButton icon={bi('motorbike')} /> or <Avatar.Icon icon={bi('account')} />
 */
export const bi = (name) => ({ size, color }) => (
    <Ionicons name={resolve(name)} size={size} color={color} />
);

export default AppIcon;
