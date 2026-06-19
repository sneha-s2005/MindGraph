import { Platform } from 'react-native';

export const Colors = {
  background: '#1a1a2e',
  primary: '#7c3aed', // Purple
  secondary: '#14b8a6', // Teal
  card: '#1f1a3a', // Lighter dark purple for card background
  cardSecondary: '#252147', // Slightly lighter/different card background
  text: '#ffffff',
  textSecondary: '#9ca3af', // Gray subtext
  textMuted: '#6b7280',
  border: '#2a2456',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  sliderMinimum: '#7c3aed',
  sliderMaximum: '#2a2456',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    rounded: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
