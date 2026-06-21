import { Platform } from 'react-native';

export const Colors = {
  background: '#090714', // Ultra deep space indigo
  primary: '#8b5cf6', // Vibrant modern purple
  secondary: '#06b6d4', // Neon Cyan
  card: '#16122d', // Rich deep slate indigo for cards
  cardSecondary: '#201a3d', // Sleek contrasting card background
  text: '#ffffff',
  textSecondary: '#a1a1aa', // Clean gray subtext
  textMuted: '#71717a',
  border: '#272145', // Violet border
  success: '#10b981', // Vivid success emerald
  danger: '#f43f5e', // Vibrant rose danger
  warning: '#fb923c', // Warm orange warning
  sliderMinimum: '#8b5cf6',
  sliderMaximum: '#272145',
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
