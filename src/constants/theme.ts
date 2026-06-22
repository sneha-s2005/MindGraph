import { Platform } from 'react-native';

export const Colors = {
  background: '#09090b', // Deep Obsidian/Zinc 950
  primary: '#6366f1', // Elegant Royal Indigo
  secondary: '#10b981', // Sophisticated Emerald Green
  card: '#18181b', // Sleek matte charcoal / Zinc 900
  cardSecondary: '#27272a', // Matte charcoal contrast / Zinc 800
  text: '#f4f4f5', // Clean off-white / Zinc 100
  textSecondary: '#a1a1aa', // Zinc 400 subtext
  textMuted: '#71717a', // Zinc 500 caption text
  border: '#27272a', // Zinc 800 subtle borders
  success: '#10b981', // Emerald success
  danger: '#ef4444', // Vibrant danger red
  warning: '#f59e0b', // Warm amber warning
  sliderMinimum: '#6366f1',
  sliderMaximum: '#27272a',
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
