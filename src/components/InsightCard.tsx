import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InsightCardProps {
  insight?: string;
  loading?: boolean;
}

/**
 * InsightCard — displays the AI-generated wellness insight.
 * @param {string} insight - The insight text
 * @param {boolean} loading - Show shimmer skeleton if true
 */
export default function InsightCard({ insight, loading = false }: InsightCardProps) {
  const [shimmerAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        ])
      ).start();
    } else {
      shimmerAnim.setValue(0);
    }
  }, [loading]);

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={16} color="#14b8a6" />
        </View>
        <Text style={styles.title}>AI Mind Insight</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>GPT-3.5</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.shimmerContainer}>
          {[1, 0.8, 0.6].map((opacity, i) => (
            <Animated.View
              key={i}
              style={[styles.shimmerLine, { width: `${100 - i * 15}%`, opacity: shimmerOpacity }]}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.insightText}>{insight || 'Loading your personalized insight...'}</Text>
      )}

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={12} color="#6b7280" />
        <Text style={styles.footerText}>Generated from your last 7 days of wellness data</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#252147',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#14b8a640',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#14b8a615',
    borderWidth: 1,
    borderColor: '#14b8a640',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: '#14b8a6',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badge: {
    backgroundColor: '#7c3aed20',
    borderWidth: 1,
    borderColor: '#7c3aed40',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#8b5cf6',
    fontSize: 10,
    fontWeight: 'bold',
  },
  insightText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  shimmerContainer: {
    gap: 8,
    marginBottom: 12,
  },
  shimmerLine: {
    height: 14,
    backgroundColor: '#2a2456',
    borderRadius: 7,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    color: '#6b7280',
    fontSize: 10,
  },
});
