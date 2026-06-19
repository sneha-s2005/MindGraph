import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HabitCardProps {
  name: string;
  correlationPct?: number;
  rank?: number;
}

const HABIT_ICONS = {
  'Sleep 7+ hours': 'bed-outline',
  'Exercise': 'barbell-outline',
  'Meditation': 'leaf-outline',
  'Deep Work': 'code-working-outline',
};

/**
 * HabitCard — displays a habit name with its mood correlation percentage.
 * @param {string} name - Habit name
 * @param {number} correlationPct - 0-100 correlation score
 * @param {number} rank - 1, 2, or 3 (rank badge)
 */
export default function HabitCard({ name, correlationPct = 0, rank = 1 }: HabitCardProps) {
  const iconName = (HABIT_ICONS as Record<string, string>)[name] || 'star-outline';
  const pct = Math.min(100, Math.max(0, Math.round(correlationPct)));
  const barWidth = `${pct}%`;

  const rankColors = ['#14b8a6', '#7c3aed', '#8b5cf6'];
  const rankColor = rankColors[(rank - 1) % rankColors.length];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.rankBadge, { backgroundColor: rankColor + '20', borderColor: rankColor }]}>
          <Text style={[styles.rankText, { color: rankColor }]}>#{rank}</Text>
        </View>
        <Ionicons name={iconName as any} size={20} color={rankColor} />
        <Text style={styles.habitName} numberOfLines={1}>{name}</Text>
        <Text style={[styles.pctText, { color: rankColor }]}>{pct}%</Text>
      </View>
      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: rankColor }]} />
      </View>
      <Text style={styles.caption}>mood correlation on logged days</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1f1a3a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2456',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  habitName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  pctText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  barTrack: {
    height: 6,
    backgroundColor: '#2a2456',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  caption: {
    fontSize: 10,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
