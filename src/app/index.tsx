import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Platform, Alert, Animated, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../constants/theme';
import { getEntries, formatDateString, MoodEntry } from '../utils/storage';
import { getInsights } from '../services/api';
import MoodGauge from '../components/MoodGauge';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

function getMoodEmoji(mood: number) {
  if (mood <= 2) return '😞';
  if (mood <= 4) return '😐';
  if (mood <= 6) return '🙂';
  if (mood <= 8) return '😊';
  return '🤩';
}

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [todayEntry, setTodayEntry] = useState<MoodEntry | null>(null);
  const [burnoutScore, setBurnoutScore] = useState(0);
  const [moodAverage, setMoodAverage] = useState(0);
  const [productivityAverage, setProductivityAverage] = useState(0);
  const [streak, setStreak] = useState(0);
  const [burnoutTrend, setBurnoutTrend] = useState<'improving' | 'stable' | 'worsening'>('stable');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [hasEntries, setHasEntries] = useState<boolean | null>(null);
  const [entriesLength, setEntriesLength] = useState(0);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // Behavioral Intelligence states
  const [biScore, setBiScore] = useState(0);
  const [biGrade, setBiGrade] = useState('—');
  const [forecast, setForecast] = useState<{ score: number; confidence: number; factors: string[]; reasoning: string } | null>(null);
  const [influentialHabit, setInfluentialHabit] = useState<{ name: string; impactPct: number; trend: string; reasoning: string } | null>(null);
  const [influentialActivity, setInfluentialActivity] = useState<{ name: string; impactScore: number; strength: string; isPositive: boolean } | null>(null);
  const [paths, setPaths] = useState<{ strongestPositive: { path: string; score: number }; strongestNegative: { path: string; score: number } } | null>(null);

  // Animation values
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [glowAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Pulse animation: loops scale between 1 and 1.05
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    );

    // Glow animation: loops value between 0 and 1
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    );

    pulse.start();
    glow.start();

    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [pulseAnim, glowAnim]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function load() {
        const [storedName, storedId, storedPresMode] = await Promise.all([
          AsyncStorage.getItem('@mindgraph_userName'),
          AsyncStorage.getItem('@mindgraph_userId'),
          AsyncStorage.getItem('@mindgraph_presentation_mode'),
        ]);
        if (!mounted) return;
        setUserName(storedName || '');
        setIsPresentationMode(storedPresMode === 'true');
        const uid = storedId || '';
        setUserId(uid);

        // Check for welcome toast
        const showWelcome = await AsyncStorage.getItem('@mindgraph_show_welcome_toast');
        if (showWelcome === 'true') {
          showToast('✅ Profile created successfully! Welcome to MindGraph.');
          await AsyncStorage.removeItem('@mindgraph_show_welcome_toast');
        }

        // Load local mood entries
        const entries = await getEntries();
        if (!mounted) return;
        setHasEntries(entries.length > 0);
        setEntriesLength(entries.length);

        const todayStr = formatDateString(new Date());
        setTodayEntry(entries.find((e) => e.date === todayStr) || null);

        // Calculate streak
        let s = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let check = new Date(today);
        if (!entries.some((e) => e.date === formatDateString(today))) {
          check.setDate(check.getDate() - 1);
        }
        while (entries.some((e) => e.date === formatDateString(check))) {
          s++;
          check.setDate(check.getDate() - 1);
        }
        if (mounted) setStreak(s);

        // Fetch backend insights
        if (uid) {
          setLoadingInsights(true);
          try {
            const data = await getInsights(uid);
            if (mounted) {
              const useBackend = data && data.weeklyData && data.weeklyData.length > 0;
              if (useBackend) {
                setBurnoutScore(data.burnoutScore || 0);
                setMoodAverage(data.moodAverage || 0);
                setBurnoutTrend(data.burnoutTrend || 'stable');
                setProductivityAverage(data.productivityAverage || 0);

                if (data.behavioralIntelligence) {
                  setBiScore(data.behavioralIntelligence.score);
                  setBiGrade(data.behavioralIntelligence.grade);
                }
                if (data.productivityForecast) {
                  setForecast(data.productivityForecast);
                }
                if (data.mostInfluentialHabit) {
                  setInfluentialHabit(data.mostInfluentialHabit);
                }
                if (data.mostInfluentialActivity) {
                  setInfluentialActivity(data.mostInfluentialActivity);
                }
                if (data.relationships) {
                  setPaths(data.relationships);
                }
              } else {
                calculateLocalMetrics();
              }
            }
          } catch {
            calculateLocalMetrics();
          } finally {
            if (mounted) setLoadingInsights(false);
          }
        } else {
          calculateLocalMetrics();
        }

        function calculateLocalMetrics() {
          if (mounted) {
            if (entries.length > 0) {
              const last7 = entries.slice(-7);
              const avg = last7.reduce((a, e) => a + e.mood, 0) / last7.length;
              setMoodAverage(parseFloat(avg.toFixed(1)));
              
              // Calculate burnout score
              let localBurnout = 0;
              if (avg < 5) localBurnout += 30;
              
              // Declining trend
              if (last7.length >= 4) {
                const half = Math.floor(last7.length / 2);
                const firstHalfAvg = last7.slice(0, half).reduce((a, e) => a + e.mood, 0) / half;
                const secondHalfAvg = last7.slice(half).reduce((a, e) => a + e.mood, 0) / (last7.length - half);
                if (secondHalfAvg < firstHalfAvg - 0.5) {
                  localBurnout += 20;
                  setBurnoutTrend('worsening');
                } else if (secondHalfAvg > firstHalfAvg + 0.5) {
                  setBurnoutTrend('improving');
                } else {
                  setBurnoutTrend('stable');
                }
              } else {
                setBurnoutTrend('stable');
              }
              
              // Habit skip rate
              const totalPossible = last7.length * 4;
              const completed = last7.reduce((acc, e) => {
                return acc + Object.values(e.habits).filter(Boolean).length;
              }, 0);
              const skipRate = totalPossible > 0 ? (totalPossible - completed) / totalPossible : 0;
              localBurnout += skipRate * 30;

              // Low energy days
              const lowCount = last7.filter((e) => e.energy === 'Low').length;
              if (lowCount >= 3) localBurnout += 20;
              
              setBurnoutScore(Math.min(Math.round(localBurnout), 100));

              // Calculate Productivity Average locally
              let localProductivity = 0;
              last7.forEach((entry) => {
                const totalFocusHours = parseFloat(String(entry.workHours || 0)) + parseFloat(String(entry.studyHours || 0));
                const focusPct = Math.min(totalFocusHours / 8, 1);
                let multiplier = 1;
                if (entry.energy === 'Low') multiplier -= 0.2;
                if (entry.stressLevel === 'High') multiplier -= 0.2;
                const completedCount = Object.values(entry.habits).filter(Boolean).length;
                const habitMult = 0.5 + (completedCount / 4) * 0.5;
                let sleepMult = 1;
                if (entry.sleepHours < 6) sleepMult = 0.7;
                else if (entry.sleepHours < 7) sleepMult = 0.9;
                localProductivity += focusPct * 100 * multiplier * habitMult * sleepMult;
              });
              const prodAverage = Math.round(localProductivity / last7.length);
              setProductivityAverage(prodAverage);

              const calculatedBiScore = Math.max(40, Math.min(100, Math.round(
                (avg * 10) * 0.2 +
                75 * 0.2 +
                (100 - skipRate * 100) * 0.2 +
                prodAverage * 0.2 +
                (100 - localBurnout) * 0.2
              )));

              const isInsufficient = entries.length < 3;

              if (isInsufficient) {
                setBiScore(0);
                setBiGrade('—');
                setForecast({
                  score: 0,
                  confidence: 0,
                  factors: [],
                  reasoning: 'More data is required before predictions can be generated.'
                });
                setInfluentialHabit({
                  name: 'Not enough historical data available yet.',
                  impactPct: 0,
                  trend: 'stable',
                  reasoning: 'Not enough historical data available yet.'
                });
                setInfluentialActivity({
                  name: 'Not enough historical data available yet.',
                  impactScore: 0,
                  strength: 'None',
                  isPositive: true
                });
                setPaths({
                  strongestPositive: { path: 'Not enough historical data available yet.', score: 0 },
                  strongestNegative: { path: 'Not enough historical data available yet.', score: 0 }
                });
              } else {
                setBiScore(calculatedBiScore);
                let grade = 'D';
                if (calculatedBiScore >= 90) grade = 'A+';
                else if (calculatedBiScore >= 80) grade = 'A';
                else if (calculatedBiScore >= 70) grade = 'B';
                else if (calculatedBiScore >= 60) grade = 'C';
                setBiGrade(grade);

                // Build top habit names from real data
                const topHabitNames: Record<string, string> = { sleep: 'Consistent Sleep', exercise: 'Exercise', meditation: 'Meditation', deepWork: 'Deep Work' };

                // Confidence is proportional to how many days we have (capped at 92%)
                const dataConfidence = Math.min(92, Math.round(40 + (last7.length / 7) * 52));

                // Find top habits from actual completions
                const habitCompletions: Record<string, number> = { sleep: 0, exercise: 0, meditation: 0, deepWork: 0 };
                last7.forEach((e) => {
                  Object.keys(e.habits).forEach((h) => {
                    if (e.habits[h as keyof typeof e.habits]) {
                      habitCompletions[h] = (habitCompletions[h] || 0) + 1;
                    }
                  });
                });
                const topHabitKey = Object.keys(habitCompletions).sort((a, b) => habitCompletions[b] - habitCompletions[a])[0] || 'deepWork';
                const secondHabitKey = Object.keys(habitCompletions)
                  .filter((k) => k !== topHabitKey)
                  .sort((a, b) => habitCompletions[b] - habitCompletions[a])[0] || 'exercise';

                // Forecast factors come from actual top completed habits
                const forecastFactors = [
                  topHabitNames[topHabitKey] || 'Deep Work',
                  topHabitNames[secondHabitKey] || 'Exercise',
                ].filter((f) => habitCompletions[topHabitKey] > 0 || habitCompletions[secondHabitKey] > 0);

                setForecast({
                  score: Math.min(95, prodAverage + 5),
                  confidence: dataConfidence,
                  factors: forecastFactors.length > 0 ? forecastFactors : ['Consistent logging'],
                  reasoning: `Based on your last ${last7.length} day${last7.length !== 1 ? 's' : ''}, ${topHabitNames[topHabitKey] || 'consistent habits'} is your strongest wellness driver.`
                });

                setInfluentialHabit({
                  name: topHabitNames[topHabitKey] || 'Deep Work',
                  impactPct: 25 + Math.round((habitCompletions[topHabitKey] / last7.length) * 20),
                  trend: 'stable',
                  reasoning: `${topHabitNames[topHabitKey] || 'Deep Work'} completions are highly correlated with your peak daily wellness.`
                });

                // Top activity from real entries
                const activityCounts: Record<string, number[]> = {};
                last7.forEach((e) => {
                  if (e.activityName && e.activityName.trim()) {
                    const act = e.activityName.trim();
                    if (!activityCounts[act]) activityCounts[act] = [];
                    activityCounts[act].push(e.mood);
                  }
                });
                const activityEntries = Object.entries(activityCounts);
                if (activityEntries.length > 0) {
                  const bestActivity = activityEntries.sort((a, b) => {
                    const avgA = a[1].reduce((s, v) => s + v, 0) / a[1].length;
                    const avgB = b[1].reduce((s, v) => s + v, 0) / b[1].length;
                    return avgB - avgA;
                  })[0];
                  const actAvgMood = bestActivity[1].reduce((s, v) => s + v, 0) / bestActivity[1].length;
                  const actImpactScore = Math.min(100, Math.round(actAvgMood * 10));
                  setInfluentialActivity({
                    name: bestActivity[0],
                    impactScore: actImpactScore,
                    strength: actImpactScore >= 75 ? 'Strong' : actImpactScore >= 50 ? 'Moderate' : 'Weak',
                    isPositive: actAvgMood >= 5,
                  });
                } else {
                  setInfluentialActivity(null);
                }

                setPaths({
                  strongestPositive: { path: `${topHabitNames[topHabitKey] || 'Deep Work'} ➔ Mood ➔ Productivity`, score: Math.round(calculatedBiScore * 0.9) },
                  strongestNegative: { path: 'Stress ➔ Sleep Deprivation ➔ Burnout', score: Math.round(localBurnout) }
                });
              }
            } else {
              setMoodAverage(0);
              setBurnoutScore(0);
              setBurnoutTrend('stable');
              setProductivityAverage(0);
              setBiScore(0);
              setBiGrade('—');
              setForecast({
                score: 0,
                confidence: 0,
                factors: [],
                reasoning: 'More data is required before predictions can be generated.'
              });
              setInfluentialHabit({
                name: 'Not enough historical data available yet.',
                impactPct: 0,
                trend: 'stable',
                reasoning: 'Not enough historical data available yet.'
              });
              setInfluentialActivity({
                name: 'Not enough historical data available yet.',
                impactScore: 0,
                strength: 'None',
                isPositive: true
              });
              setPaths({
                strongestPositive: { path: 'Not enough historical data available yet.', score: 0 },
                strongestNegative: { path: 'Not enough historical data available yet.', score: 0 }
              });
            }
          }
        }
      }

      load();
      return () => { mounted = false; };
    }, [])
  );

  const handleQuickLog = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/log');
  };

  const handleShowPathDetails = (type: 'catalyst' | 'risk') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (type === 'catalyst') {
      const title = '🌟 Strongest Catalyst Path';
      const msg = `Consistent Sleep ➔ Mood ➔ Productivity\n\nThis Neo4j relationship path shows that consistent sleep (7+ hours) stabilizes your emotional state (Mood), which directly acts as a catalyst to boost your daily focus output (Productivity) by +${paths?.strongestPositive.score || 69} points.\n\nRecommendation:\nMaintain a fixed bedtime to protect this high-productivity loop!`;
      if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${msg}`);
      } else {
        Alert.alert(title, msg, [{ text: 'Got it' }]);
      }
    } else {
      const title = '⚠️ Critical Risk Path';
      const msg = `Stress ➔ Sleep Deprivation ➔ Burnout\n\nThis warning path indicates that elevated daily stress levels interfere with your sleep quality, leading to sleep deprivation. A cumulative sleep deficit is the strongest leading indicator for mental burnout (Risk: ${paths?.strongestNegative.score || 9}%).\n\nRecommendation:\nIncorporate 10 minutes of evening meditation or reading to disengage from work stress before bedtime.`;
      if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${msg}`);
      } else {
        Alert.alert(title, msg, [{ text: 'Got it', style: 'cancel' }]);
      }
    }
  };

  const trendIcon = burnoutTrend === 'improving' ? 'trending-down' : burnoutTrend === 'worsening' ? 'trending-up' : 'remove';
  const trendColor = burnoutTrend === 'improving' ? Colors.success : burnoutTrend === 'worsening' ? Colors.danger : Colors.warning;

  const getDiscoverySentence = () => {
    if (entriesLength < 3) {
      return "Continue logging to unlock behavioral intelligence.";
    }
    const topHabitName = influentialHabit?.name || '';
    const impactPct = influentialHabit?.impactPct || 28;
    if (topHabitName.toLowerCase().includes('sleep')) {
      return `Consistent sleep reduced your burnout risk by ${Math.max(20, Math.min(60, impactPct + 6))}%.`;
    }
    if (topHabitName.toLowerCase().includes('deep work') || topHabitName.toLowerCase().includes('productivity')) {
      return `Your strongest productivity driver is Deep Work.`;
    }
    if (topHabitName) {
      return `MindGraph discovered that ${topHabitName} improves your productivity by ${impactPct}%.`;
    }
    return "Your behavioral patterns are forming. Continue logging to unlock insights.";
  };

  const HeaderContent = (
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.name}>{userName} 👋</Text>
      </View>
      <View style={styles.streakBadge}>
        <Ionicons name="flame" size={16} color={Colors.warning} />
        <Text style={styles.streakText}>{streak} day{streak !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );

  const MainContent = (
    <View style={styles.columnInner}>
      {/* Today's mood card */}
      <Text style={styles.sectionTitle}>{"Today's Status"}</Text>
      {todayEntry ? (
        <View style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Text style={styles.todayEmoji}>{getMoodEmoji(todayEntry.mood)}</Text>
            <View style={styles.todayDetails}>
              <Text style={styles.todayMood}>Mood Score: {todayEntry.mood}/10</Text>
              <Text style={styles.todayEnergy}>
                Energy: <Text style={{ color: Colors.secondary, fontWeight: '700' }}>{todayEntry.energy}</Text>
                {'  '}·{'  '}
                Stress: <Text style={{ color: todayEntry.stressLevel === 'High' ? Colors.danger : todayEntry.stressLevel === 'Medium' ? Colors.warning : Colors.success, fontWeight: '700' }}>{todayEntry.stressLevel || 'Medium'}</Text>
              </Text>
            </View>
          </View>

          {/* New Metrics row */}
          <View style={styles.todayStatsGrid}>
            <View style={styles.todayStatItem}>
              <Ionicons name="moon-outline" size={13} color="#9ca3af" />
              <Text style={styles.todayStatText}>{todayEntry.sleepHours || 7}h Sleep</Text>
            </View>
            <View style={styles.todayStatItem}>
              <Ionicons name="barbell-outline" size={13} color="#9ca3af" />
              <Text style={styles.todayStatText}>{todayEntry.exerciseDuration || 0}m Exercise</Text>
            </View>
            <View style={styles.todayStatItem}>
              <Ionicons name="book-outline" size={13} color="#9ca3af" />
              <Text style={styles.todayStatText}>{todayEntry.studyHours || 0}h Study</Text>
            </View>
            <View style={styles.todayStatItem}>
              <Ionicons name="briefcase-outline" size={13} color="#9ca3af" />
              <Text style={styles.todayStatText}>{todayEntry.workHours || 0}h Work</Text>
            </View>
          </View>

          {/* Social and Goal links */}
          {todayEntry.socialInteraction || todayEntry.goalTitle || todayEntry.activityName ? (
            <View style={styles.badgesRow}>
              {todayEntry.goalTitle ? (
                <View style={[styles.badge, { backgroundColor: '#06b6d415', borderColor: '#06b6d440' }]}>
                  <Ionicons name="flag-outline" size={11} color="#06b6d4" />
                  <Text style={[styles.badgeText, { color: '#06b6d4' }]}>Goal: {todayEntry.goalTitle}</Text>
                </View>
              ) : null}
              {todayEntry.socialInteraction ? (
                <View style={[styles.badge, { backgroundColor: '#ec489915', borderColor: '#ec489940' }]}>
                  <Ionicons name="people-outline" size={11} color="#ec4899" />
                  <Text style={[styles.badgeText, { color: '#ec4899' }]}>Met: {todayEntry.socialInteraction}</Text>
                </View>
              ) : null}
              {todayEntry.activityName ? (
                <View style={[styles.badge, { backgroundColor: '#f43f5e15', borderColor: '#f43f5e40' }]}>
                  <Ionicons name="flash-outline" size={11} color="#f43f5e" />
                  <Text style={[styles.badgeText, { color: '#f43f5e' }]}>Activity: {todayEntry.activityName}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.habitsBadgeRow}>
            {[
              { key: 'sleep', label: 'Sleep', val: todayEntry.habits.sleep },
              { key: 'exercise', label: 'Exercise', val: todayEntry.habits.exercise },
              { key: 'meditation', label: 'Meditate', val: todayEntry.habits.meditation },
              { key: 'deepWork', label: 'Deep Work', val: todayEntry.habits.deepWork },
            ].map((h) => (
              <View key={h.key} style={[styles.habitBadge, h.val ? styles.habitActive : styles.habitInactive]}>
                <Text style={[styles.habitBadgeTextInner, { color: h.val ? '#1a1a2e' : '#9ca3af' }]}>{h.label}</Text>
              </View>
            ))}
          </View>
          
          {todayEntry.notes ? (
            <Text style={styles.todayNotes}>{'"'}{todayEntry.notes}{'"'}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="moon-outline" size={32} color="#4b5563" />
          <Text style={styles.emptyTitle}>No entry yet today</Text>
          <Text style={styles.emptyText}>A 30-second daily log builds powerful insight over time.</Text>
        </View>
      )}

      {/* Quick Log button */}
      <Pressable
        style={({ pressed }) => [styles.logButton, pressed && styles.logButtonPressed]}
        onPress={handleQuickLog}
      >
        <Ionicons name="add-circle-outline" size={20} color="#1a1a2e" />
        <Text style={styles.logButtonText}>
          {todayEntry ? "Update Today's Log" : "Log Today's Mood"}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#1a1a2e" />
      </Pressable>

      {/* Stats 2x2 Grid */}
      {hasEntries !== false && (
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="analytics-outline" size={20} color={Colors.secondary} />
              <Text style={styles.statVal}>{moodAverage > 0 ? `${moodAverage}/10` : '—'}</Text>
              <Text style={styles.statLabel}>7-Day Mood</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="sparkles-outline" size={20} color="#84cc16" />
              <Text style={styles.statVal}>{productivityAverage > 0 ? `${productivityAverage}%` : '—'}</Text>
              <Text style={styles.statLabel}>Productivity</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="flame-outline" size={20} color={Colors.warning} />
              <Text style={styles.statVal}>{streak} Day{streak !== 1 ? 's' : ''}</Text>
              <Text style={styles.statLabel}>Active Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="shield-checkmark-outline" size={20} color={burnoutScore > 70 ? Colors.danger : burnoutScore > 40 ? Colors.warning : Colors.success} />
              <Text style={styles.statVal}>{burnoutScore}/100</Text>
              <Text style={styles.statLabel}>Burnout Risk</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const LeftContent = hasEntries === false ? (
    <View style={styles.emptyCardContainer}>
      <View style={styles.emptyCardGraphic}>
        <Ionicons name="compass-outline" size={48} color={Colors.secondary} />
      </View>
      <Text style={styles.emptyCardTitle}>Begin Your Journey</Text>
      <Text style={styles.emptyCardText}>
        Log your first day to begin your wellness journey and unlock Neo4j correlation intelligence.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.emptyLogBtn, pressed && { opacity: 0.85 }]}
        onPress={handleQuickLog}
      >
        <Ionicons name="create-outline" size={16} color="#1a1a2e" style={{ marginRight: 6 }} />
        <Text style={styles.emptyLogBtnText}>{"Log Today's Mood"}</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.columnInner}>
      {/* AI Behavioral Discovery Card */}
      <View style={styles.discoveryCard}>
        <View style={styles.discoveryHeader}>
          <Ionicons name="sparkles" size={14} color={Colors.secondary} />
          <Text style={styles.discoveryTag}>AI BEHAVIORAL DISCOVERY</Text>
        </View>
        <Text style={styles.discoveryText}>
          {getDiscoverySentence()}
        </Text>
      </View>

      {/* Behavioral Intelligence OS Dashboard */}
      <View style={styles.dashboardContainer}>
        <Text style={styles.dashboardTitle}>Behavioral Intelligence OS</Text>
        
        <View style={styles.dashboardRow}>
          {/* BIS Circular Gauge Card */}
          <View style={styles.bisCard}>
            <Animated.View style={[
              styles.gradeCircle,
              {
                transform: [{ scale: pulseAnim }],
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1],
                }),
              }
            ]}>
              <Text style={styles.gradeText}>{biGrade}</Text>
              <Text style={styles.bisValText}>{biScore > 0 ? `${biScore}%` : '—%'}</Text>
            </Animated.View>
            <Text style={styles.bisLabel}>Intelligence Score (BIS)</Text>
            <Text style={styles.bisSub}>Composite performance index</Text>
          </View>

          {/* Tomorrow's Productivity Forecast */}
          <View style={styles.forecastCard}>
            <View style={styles.forecastHeader}>
              <Ionicons name="sparkles" size={14} color={Colors.secondary} />
              <Text style={styles.forecastTitle}>Productivity Forecast</Text>
            </View>
            <Text style={styles.forecastScore}>{forecast && forecast.score > 0 ? `${forecast.score}%` : '—%'}</Text>
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Confidence:</Text>
              <View style={styles.confidenceBarBg}>
                <View style={[styles.confidenceBarFill, { width: `${forecast ? forecast.confidence : 0}%` }]} />
              </View>
              <Text style={styles.confidenceVal}>{forecast && forecast.confidence > 0 ? `${forecast.confidence}%` : '—%'}</Text>
            </View>
            <Text style={styles.forecastReasoning} numberOfLines={3} ellipsizeMode="tail">
              {forecast ? forecast.reasoning : 'Log more entries to unlock forecast insights.'}
            </Text>
          </View>
        </View>

        {/* Behavioral Influencer Chips */}
        <View style={styles.influencersRow}>
          <View style={styles.influencerChip}>
            <Ionicons name="trophy-outline" size={12} color={Colors.secondary} />
            <Text style={styles.influencerText}>
              Top Habit: <Text style={styles.influencerName}>{influentialHabit && influentialHabit.name !== 'Not enough historical data available yet.' ? influentialHabit.name : '—'}</Text>
            </Text>
          </View>
          <View style={styles.influencerChip}>
            <Ionicons name="flash-outline" size={12} color="#84cc16" />
            <Text style={styles.influencerText}>
              Top Activity: <Text style={styles.influencerName}>{influentialActivity && influentialActivity.name !== 'Not enough historical data available yet.' ? influentialActivity.name : '—'}</Text>
            </Text>
          </View>
        </View>

        {/* Discovery Paths (Strongest Positive / Strongest Negative) */}
        <View style={styles.pathsCard}>
          <Text style={styles.pathsHeaderTitle}>Neo4j Relationship Path Discovery</Text>
          
          <Pressable
            onPress={() => handleShowPathDetails('catalyst')}
            style={({ pressed }) => [
              styles.pathItem,
              pressed && { opacity: 0.75 }
            ]}
          >
            <View style={styles.pathLabelRow}>
              <View style={styles.pathIndicatorGreen} />
              <Text style={styles.pathLabel}>Strongest Catalyst Path</Text>
              <Text style={styles.pathScoreGreen}>{paths && paths.strongestPositive.score > 0 ? `+${paths.strongestPositive.score} pts` : '—'}</Text>
            </View>
            <View style={styles.pathTextContainer}>
              <Text style={styles.pathText}>{paths && paths.strongestPositive.score > 0 ? paths.strongestPositive.path : '—'}</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => handleShowPathDetails('risk')}
            style={({ pressed }) => [
              styles.pathItem,
              pressed && { opacity: 0.75 }
            ]}
          >
            <View style={styles.pathLabelRow}>
              <View style={styles.pathIndicatorRed} />
              <Text style={styles.pathLabel}>Critical Risk Path</Text>
              <Text style={styles.pathScoreRed}>{paths && paths.strongestNegative.score > 0 ? `${paths.strongestNegative.score}% Risk` : '—'}</Text>
            </View>
            <View style={styles.pathTextContainer}>
              <Text style={styles.pathText}>{paths && paths.strongestNegative.score > 0 ? paths.strongestNegative.path : '—'}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Burnout Gauge */}
      <Animated.View style={[
        styles.gaugeCard,
        {
          borderColor: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['#2a2456', '#5b4ea8']
          })
        }
      ]}>
        <MoodGauge score={burnoutScore} />
        <View style={styles.trendRow}>
          <Ionicons name={trendIcon as any} size={14} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]}>
            {burnoutTrend.charAt(0).toUpperCase() + burnoutTrend.slice(1)} trend
          </Text>
        </View>
        <Text style={styles.gaugeCaption}>
          Early Warning Engine · Dynamic Burnout Index
        </Text>
      </Animated.View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {toast ? (
        <View style={[styles.toast, { backgroundColor: toast.startsWith('❌') ? Colors.danger : Colors.success }]}>
          <Ionicons
            name={toast.startsWith('❌') ? 'close-circle' : 'checkmark-circle'}
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {HeaderContent}

        {isTablet ? (
          <View style={styles.tabletLayout}>
            <View style={styles.leftColumn}>{LeftContent}</View>
            <View style={styles.mainColumn}>{MainContent}</View>
          </View>
        ) : (
          <View style={styles.mobileLayout}>
            {MainContent}
            {LeftContent}
          </View>
        )}

        {!isPresentationMode && <Text style={styles.footer}>{"HACKHAZARDS '26 · Neo4j + OpenAI · Expo"}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.three,
    alignItems: 'center',
    maxWidth: Platform.OS === 'web' ? 960 : '100%',
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 40,
  },
  tabletLayout: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.four,
    width: '100%',
    marginTop: Spacing.two,
  },
  mobileLayout: {
    flexDirection: 'column',
    alignSelf: 'stretch',
    width: '100%',
  },
  leftColumn: {
    flex: 1.1,
    gap: Spacing.three,
  },
  mainColumn: {
    flex: 1.2,
    gap: Spacing.three,
  },
  columnInner: {
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  header: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  greeting: { fontSize: 14, color: Colors.textSecondary },
  name: { fontSize: 26, fontWeight: 'bold', color: Colors.text },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f59e0b15',
    borderWidth: 1,
    borderColor: '#f59e0b40',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  streakText: { color: Colors.warning, fontWeight: '700', fontSize: 13 },
  gaugeCard: {
    alignSelf: 'stretch',
    backgroundColor: '#1f1a3a',
    borderRadius: 20,
    padding: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2456',
    marginBottom: Spacing.three,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trendText: { fontSize: 12, fontWeight: '600' },
  gaugeCaption: { fontSize: 11, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  
  statsGrid: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1f1a3a',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2456',
    gap: 4,
  },
  statVal: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  statLabel: { color: Colors.textSecondary, fontSize: 10, textAlign: 'center' },
  
  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.two,
  },
  todayCard: {
    alignSelf: 'stretch',
    backgroundColor: '#1f1a3a',
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2a2456',
    marginBottom: Spacing.three,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  todayEmoji: { fontSize: 44 },
  todayDetails: { flex: 1 },
  todayMood: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  todayEnergy: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  
  todayStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#231e42',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2456',
  },
  todayStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayStatText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600',
  },

  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  habitsBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  habitBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  habitActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  habitInactive: { backgroundColor: 'transparent', borderColor: '#2a2456' },
  habitBadgeTextInner: { fontSize: 11, fontWeight: '600' },
  
  todayNotes: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: '#2a2456',
    paddingTop: 10,
    marginTop: 4,
  },
  emptyCard: {
    alignSelf: 'stretch',
    backgroundColor: '#1f1a3a',
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2456',
    marginBottom: Spacing.three,
    gap: 8,
  },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  emptyText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  
  logButton: {
    alignSelf: 'stretch',
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logButtonText: { flex: 1, color: '#1a1a2e', fontWeight: 'bold', fontSize: 15, marginLeft: 8 },
  logButtonPressed: { opacity: 0.85 },
  footer: { fontSize: 10, color: '#374151', textAlign: 'center' },
  dashboardContainer: {
    alignSelf: 'stretch',
    backgroundColor: '#16122d',
    borderRadius: 24,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#251e4a',
    marginBottom: Spacing.three,
  },
  dashboardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.three,
  },
  dashboardRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  bisCard: {
    flex: 1.1,
    backgroundColor: '#1f1a3a',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2456',
  },
  gradeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
    marginBottom: 8,
  },
  gradeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  bisValText: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  bisLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
  },
  bisSub: {
    fontSize: 8,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  forecastCard: {
    flex: 1.2,
    backgroundColor: '#1f1a3a',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2456',
    justifyContent: 'space-between',
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  forecastTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  forecastScore: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.text,
    marginVertical: 4,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  confidenceLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
  },
  confidenceBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#2a2456',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
  },
  confidenceVal: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  forecastReasoning: {
    fontSize: 9,
    color: Colors.textSecondary,
    lineHeight: 12,
  },
  influencersRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  influencerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#201a42',
    borderWidth: 1,
    borderColor: '#2e265c',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  influencerText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  influencerName: {
    fontWeight: 'bold',
    color: Colors.text,
  },
  pathsCard: {
    backgroundColor: '#1e193e',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2e265c',
  },
  pathsHeaderTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginBottom: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pathItem: {
    backgroundColor: 'rgba(26, 21, 58, 0.6)',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2e265c',
  },
  pathLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pathIndicatorGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  pathIndicatorRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  pathLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    flex: 1,
  },
  pathScoreGreen: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#10b981',
  },
  pathScoreRed: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  pathTextContainer: {
    backgroundColor: '#16122d',
    borderRadius: 6,
    padding: 6,
  },
  pathText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: Colors.text,
  },
  discoveryCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(20, 184, 166, 0.25)',
    marginBottom: 16,
  },
  discoveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  discoveryTag: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.secondary,
    letterSpacing: 1,
  },
  discoveryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
  },
  emptyCardContainer: {
    alignSelf: 'stretch',
    backgroundColor: '#1f1a3a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2456',
    marginBottom: 20,
  },
  emptyCardGraphic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#252047',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a346e',
  },
  emptyCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyCardText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  emptyLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emptyLogBtnText: {
    color: '#1a1a2e',
    fontWeight: 'bold',
    fontSize: 14,
  },
  toast: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 99999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  toastText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
});
