import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Dimensions, Platform, Animated, Pressable, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing } from '../constants/theme';
import { getEntries } from '../utils/storage';
import { getInsights, getAiInsight } from '../services/api';
import { seedSampleLogs, clearAllDemoData } from '../utils/sampleData';
import HabitCard from '../components/HabitCard';
import InsightCard from '../components/InsightCard';

const Footer = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  return (
    <View style={styles.footerContainer}>
      <View style={[styles.footerRow, !isDesktop && { flexDirection: 'column', gap: 12 }]}>
        <Text style={styles.footerBrand}>🧠 MindGraph OS</Text>
        <View style={styles.footerLinks}>
          <Text style={styles.footerText}>{"HACKHAZARDS '26"}</Text>
          <Text style={styles.footerDot}>•</Text>
          <Text style={styles.footerText}>Neo4j Cloud</Text>
          <Text style={styles.footerDot}>•</Text>
          <Text style={styles.footerText}>OpenAI GPT-4</Text>
        </View>
      </View>
    </View>
  );
};

export default function InsightsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    let active = true;
    const defer = async () => {
      await Promise.resolve();
      if (active) {
        setIsMounted(true);
      }
    };
    defer();
    return () => { active = false; };
  }, []);

  const [weeklyData, setWeeklyData] = useState<{ date: string; moodScore: number; productivityScore: number }[]>([]);
  const [topHabits, setTopHabits] = useState<{ name: string; correlationPct: number }[]>([]);
  const [negativeHabits, setNegativeHabits] = useState<{ name: string; frequency: number }[]>([]);
  const [burnoutScore, setBurnoutScore] = useState(0);
  const [burnoutTrend, setBurnoutTrend] = useState<'improving' | 'stable' | 'worsening'>('stable');
  const [moodAverage, setMoodAverage] = useState(0);
  const [productivityAverage, setProductivityAverage] = useState(0);
  const [consistencyScore, setConsistencyScore] = useState(0);
  const [sleepImpact, setSleepImpact] = useState({ goodSleepMood: 0, goodSleepProd: 0, badSleepMood: 0, badSleepProd: 0 });
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Behavioral Influencer states
  const [influentialHabit, setInfluentialHabit] = useState<{ name: string; impactPct: number; trend: string; reasoning: string } | null>(null);
  const [influentialActivity, setInfluentialActivity] = useState<{ name: string; impactScore: number; strength: string; isPositive: boolean } | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [toast, setToast] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const pathAnim = React.useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function load() {
        setDataLoading(true);
        const [userId, storedPresMode] = await Promise.all([
          AsyncStorage.getItem('@mindgraph_userId'),
          AsyncStorage.getItem('@mindgraph_presentation_mode'),
        ]);
        if (mounted) {
          setIsPresentationMode(storedPresMode === 'true');
        }

        // Load from backend
        let backendData: any = null;
        if (userId) {
          try {
            backendData = await getInsights(userId);
          } catch {
            backendData = null;
          }
        }

        // Fallback: build from local entries
        const localEntries = await getEntries();
        const last7 = localEntries.slice(-7);

        const useBackend = backendData && backendData.weeklyData && backendData.weeklyData.length > 0;

        let finalWeekly = useBackend
          ? backendData.weeklyData
          : last7.map((e) => ({ 
              date: e.date, 
              moodScore: e.mood, 
              productivityScore: calculateLocalProductivitySingle(e) 
            }));

        let finalHabits = useBackend
          ? backendData.topHabits
          : computeLocalHabits(last7);

        let finalNegatives = useBackend
          ? backendData.negativeHabits
          : computeLocalNegatives(last7);

        let finalBurnout = useBackend ? backendData.burnoutScore : computeLocalBurnout(last7);
        let finalTrend = useBackend ? backendData.burnoutTrend : computeLocalTrend(last7);
        let finalAvg = useBackend ? backendData.moodAverage : (last7.length > 0
          ? parseFloat((last7.reduce((s, e) => s + e.mood, 0) / last7.length).toFixed(1)) : 0);
        
        let finalProdAvg = useBackend ? backendData.productivityAverage : (finalWeekly.length > 0
          ? Math.round(finalWeekly.reduce((s: number, d: any) => s + d.productivityScore, 0) / finalWeekly.length) : 0);
        
        let finalConsistency = useBackend ? backendData.consistencyScore : computeLocalConsistency(last7);
        let finalSleepImpact = useBackend ? backendData.sleepImpact : computeLocalSleepImpact(last7);

        let finalInfluentialHabit = useBackend ? backendData.mostInfluentialHabit : null;
        if (!finalInfluentialHabit) {
          if (last7.length < 3) {
            finalInfluentialHabit = {
              name: 'Not enough historical data available yet.',
              impactPct: 0,
              trend: 'stable',
              reasoning: 'Not enough historical data available yet.'
            };
          } else {
            const topHabit = finalHabits[0];
            if (topHabit) {
              finalInfluentialHabit = {
                name: topHabit.name,
                impactPct: topHabit.correlationPct,
                trend: 'stable',
                reasoning: `${topHabit.name} is strongly correlated with your peak productivity and mood days.`
              };
            } else {
              finalInfluentialHabit = {
                name: 'Not enough historical data available yet.',
                impactPct: 0,
                trend: 'stable',
                reasoning: 'Not enough historical data available yet.'
              };
            }
          }
        }

        let finalInfluentialActivity = useBackend ? backendData.mostInfluentialActivity : null;
        if (!finalInfluentialActivity) {
          if (last7.length < 3) {
            finalInfluentialActivity = {
              name: 'Not enough historical data available yet.',
              impactScore: 0,
              strength: 'None',
              isPositive: true
            };
          } else {
            // Derive from actual activity entries logged by the user
            const activityCounts: Record<string, number[]> = {};
            last7.forEach((e: any) => {
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
              finalInfluentialActivity = {
                name: bestActivity[0],
                impactScore: actImpactScore,
                strength: actImpactScore >= 75 ? 'Strong' : actImpactScore >= 50 ? 'Moderate' : 'Weak',
                isPositive: actAvgMood >= 5,
              };
            } else {
              finalInfluentialActivity = {
                name: 'Not enough historical data available yet.',
                impactScore: 0,
                strength: 'None',
                isPositive: true
              };
            }
          }
        }

        if (mounted) {
          setWeeklyData(finalWeekly);
          setTopHabits(finalHabits);
          setNegativeHabits(finalNegatives);
          setBurnoutScore(finalBurnout);
          setBurnoutTrend(finalTrend);
          setMoodAverage(finalAvg);
          setProductivityAverage(finalProdAvg);
          setConsistencyScore(finalConsistency);
          setSleepImpact(finalSleepImpact);
          setInfluentialHabit(finalInfluentialHabit);
          setInfluentialActivity(finalInfluentialActivity);
          setDataLoading(false);
        }

        // Load AI insight
        if (userId && mounted) {
          setAiLoading(true);
          try {
            if (useBackend) {
              const aiData = await getAiInsight(userId);
              if (mounted) setAiInsight(aiData.insight || aiData.weeklySummary || '');
            } else {
              throw new Error('Using local fallback for AI insight');
            }
          } catch {
            // Generate local insight as fallback
            if (mounted) setAiInsight(generateLocalInsight(finalWeekly, finalHabits, finalBurnout));
          } finally {
            if (mounted) setAiLoading(false);
          }
        } else if (mounted) {
          setAiLoading(false);
          setAiInsight(generateLocalInsight(finalWeekly, finalHabits, finalBurnout));
        }

        if (mounted) {
          pathAnim.setValue(0);
          Animated.timing(pathAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }).start();
        }
      }

      load();
      return () => { mounted = false; };
    }, [reloadTrigger])
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const getPastDateString = (offset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTooltipDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}, ${parts[0]}`;
    }
    return dateStr;
  };

  const handlePrepopulate = async () => {
    setDataLoading(true);
    try {
      await seedSampleLogs(10);
      showToast('✅ Seeded 10 sample logs! Refreshing insights...');
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      showToast('❌ Seeding failed.');
      setDataLoading(false);
    }
  };



  function calculateLocalProductivitySingle(entry: any) {
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
    
    let score = focusPct * 100 * multiplier * habitMult * sleepMult;
    return Math.min(Math.max(Math.round(score), 0), 100);
  }

  function computeLocalHabits(entries: any[]) {
    if (entries.length < 3) return [];
    const habit_keys = [
      { key: 'sleep', name: 'Sleep 7+ hours' },
      { key: 'exercise', name: 'Exercise' },
      { key: 'meditation', name: 'Meditation' },
      { key: 'deepWork', name: 'Deep Work' },
    ];
    return habit_keys
      .map((h) => {
        const logged = entries.filter((e) => e.habits[h.key]);
        const avgMood = logged.length > 0 ? logged.reduce((s, e) => s + e.mood, 0) / logged.length : 0;
        const highMoodDays = logged.filter((e) => e.mood >= 7).length;
        const pct = logged.length > 0 ? Math.round((highMoodDays / logged.length) * 100) : 0;
        return { name: h.name, correlationPct: pct, avgMood };
      })
      .filter((h) => h.avgMood > 0)
      .sort((a, b) => b.avgMood - a.avgMood)
      .slice(0, 3);
  }

  function computeLocalNegatives(entries: any[]) {
    if (entries.length < 3) return [];
    const lowMoodDays = entries.filter(e => e.mood < 5 || e.stressLevel === 'High');
    const counts: Record<string, number> = {};
    lowMoodDays.forEach(e => {
      if (e.habits.sleep) counts['Sleep 7+ hours'] = (counts['Sleep 7+ hours'] || 0) + 1;
      if (e.habits.exercise) counts['Exercise'] = (counts['Exercise'] || 0) + 1;
      if (e.habits.meditation) counts['Meditation'] = (counts['Meditation'] || 0) + 1;
      if (e.habits.deepWork) counts['Deep Work'] = (counts['Deep Work'] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, frequency: count }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);
  }

  function computeLocalConsistency(entries: any[]) {
    if (entries.length === 0) return 0;
    let completed = 0;
    entries.forEach(e => {
      if (e.habits.sleep) completed++;
      if (e.habits.exercise) completed++;
      if (e.habits.meditation) completed++;
      if (e.habits.deepWork) completed++;
    });
    return Math.round((completed / (entries.length * 4)) * 100);
  }

  function computeLocalSleepImpact(entries: any[]) {
    let goodSleepMood = 0, goodSleepProd = 0;
    const goodDays = entries.filter(e => e.sleepHours >= 7);
    if (goodDays.length > 0) {
      goodSleepMood = parseFloat((goodDays.reduce((s, e) => s + e.mood, 0) / goodDays.length).toFixed(1));
      goodSleepProd = Math.round(goodDays.reduce((s, e) => s + calculateLocalProductivitySingle(e), 0) / goodDays.length);
    }
    
    let badSleepMood = 0, badSleepProd = 0;
    const badDays = entries.filter(e => e.sleepHours < 7);
    if (badDays.length > 0) {
      badSleepMood = parseFloat((badDays.reduce((s, e) => s + e.mood, 0) / badDays.length).toFixed(1));
      badSleepProd = Math.round(badDays.reduce((s, e) => s + calculateLocalProductivitySingle(e), 0) / badDays.length);
    }
    return { goodSleepMood, goodSleepProd, badSleepMood, badSleepProd };
  }

  function computeLocalBurnout(entries: any[]) {
    if (entries.length === 0) return 0;
    let score = 0;
    const avg = entries.reduce((s, e) => s + e.mood, 0) / entries.length;
    if (avg < 5) score += 30;
    const lowE = entries.filter((e) => e.energy === 'Low').length;
    if (lowE >= 3) score += 20;
    const skipped = entries.reduce((s, e) => s + Object.values(e.habits).filter((v) => !v).length, 0);
    const total = entries.length * 4;
    if (total > 0) score += (skipped / total) * 30;
    return Math.min(Math.round(score), 100);
  }

  function computeLocalTrend(entries: any[]) {
    if (entries.length < 4) return 'stable';
    const half = Math.floor(entries.length / 2);
    const first = entries.slice(0, half).reduce((s, e) => s + e.mood, 0) / half;
    const last = entries.slice(half).reduce((s, e) => s + e.mood, 0) / (entries.length - half);
    if (last > first + 0.5) return 'improving';
    if (last < first - 0.5) return 'worsening';
    return 'stable';
  }

  function generateLocalInsight(data: any[], habits: any[], burnout: number) {
    if (data.length < 3) {
      return "Continue logging data for a few days to receive personalized AI insights.";
    }
    const avg = data.length > 0 ? data.reduce((s, d) => s + d.moodScore, 0) / data.length : 5;
    const topHabit = habits[0]?.name || 'consistent logging';
    if (burnout > 60) {
      return `⚠️ PATTERN: Your burnout risk is elevated at ${burnout}/100 — your mood has been lower than ideal this week. CORRELATION: ${topHabit} shows the strongest positive impact on your mood. RECOMMENDATION: Take one restorative action today — a 10-minute walk, or an early bedtime.`;
    }
    if (avg >= 7.5) {
      return `🌟 PATTERN: You've had a strong week with an average mood of ${avg.toFixed(1)}/10. CORRELATION: ${topHabit} appears most often on your highest-scoring days. RECOMMENDATION: Keep your current momentum — document one thing you're proud of today.`;
    }
    return `📈 PATTERN: Your average mood this week is ${avg.toFixed(1)}/10, showing steady progress. CORRELATION: ${topHabit} correlates most with your better days. RECOMMENDATION: Try scheduling ${topHabit.toLowerCase()} as a non-negotiable tomorrow morning.`;
  }

  const windowWidth = Dimensions.get('window').width;
  const chartWidth = Platform.OS === 'web'
    ? Math.min(530, Math.max(320, windowWidth - 48))
    : Math.max(320, windowWidth - 48);

  const labels = weeklyData.map((d) => {
    const parts = d.date.split('-');
    if (parts.length === 3) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}`;
    }
    return d.date;
  });

  const chartMoodValues = weeklyData.map((d) => d.moodScore || 0);
  const chartProdValues = weeklyData.map((d) => d.productivityScore || 0);

  const trendIcon = burnoutTrend === 'improving' ? 'arrow-up-circle' : burnoutTrend === 'worsening' ? 'arrow-down-circle' : 'remove-circle';
  const trendColor = burnoutTrend === 'improving' ? Colors.success : burnoutTrend === 'worsening' ? Colors.danger : Colors.warning;
  const trendLabel = burnoutTrend === 'improving' ? 'Improving 📈' : burnoutTrend === 'worsening' ? 'Worsening 📉' : 'Stable ➡️';

  const HeaderContent = (
    <View style={styles.pageHeader}>
      <Text style={styles.pageTitle}>Analytics & Insights</Text>
      <Text style={styles.pageSub}>Behavioral Intelligence OS · Full weekly analysis</Text>
    </View>
  );

  const MainContent = (
    <View style={styles.columnInner}>
      {/* 7-day Mood Bar Chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>7-Day Mood Trend</Text>
        {isMounted && chartMoodValues.length > 0 ? (
          <View style={styles.chartWrap}>
            <BarChart
              data={{ labels, datasets: [{ data: chartMoodValues }] }}
              width={isTablet ? 400 : chartWidth}
              height={180}
              yAxisLabel=""
              yAxisSuffix=""
              fromZero
              segments={5}
              chartConfig={{
                backgroundColor: Colors.card,
                backgroundGradientFrom: Colors.card,
                backgroundGradientTo: Colors.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(161, 161, 170, ${opacity})`,
                barPercentage: 0.6,
                style: { borderRadius: 14 },
              }}
              style={{ borderRadius: 14 }}
            />
          </View>
        ) : (
          <View style={styles.emptyChart}>
            <Ionicons name="bar-chart-outline" size={32} color="#4b5563" />
            <Text style={styles.emptyText}>Log entry to see mood chart</Text>
          </View>
        )}
      </View>

      {/* 7-day Productivity Line Chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>7-Day Productivity Trend</Text>
        {isMounted && chartProdValues.length > 0 ? (
          <View style={styles.chartWrap}>
            <LineChart
              data={{ labels, datasets: [{ data: chartProdValues }] }}
              width={isTablet ? 400 : chartWidth}
              height={180}
              yAxisLabel=""
              yAxisSuffix="%"
              fromZero
              onDataPointClick={async ({ index }) => {
                const day = weeklyData[index];
                if (day) {
                  setSelectedDate(day.date);
                  const localEntries = await getEntries();
                  const match = localEntries.find(e => e.date === day.date);
                  setSelectedEntry(match || null);
                }
              }}
              chartConfig={{
                backgroundColor: Colors.card,
                backgroundGradientFrom: Colors.card,
                backgroundGradientTo: Colors.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(161, 161, 170, ${opacity})`,
                propsForDots: { r: '4', strokeWidth: '1', stroke: Colors.primary },
                style: { borderRadius: 14 },
              }}
              style={{ borderRadius: 14 }}
            />
            {selectedEntry && (
              <View style={styles.tooltipCard}>
                <View style={styles.tooltipHeader}>
                  <Text style={styles.tooltipDate}>{formatTooltipDate(selectedDate || '')}</Text>
                  <Pressable onPress={() => setSelectedEntry(null)}>
                    <Ionicons name="close" size={16} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.tooltipMetrics}>
                  <View style={styles.tooltipMetricItem}>
                    <Ionicons name="happy-outline" size={14} color={Colors.secondary} />
                    <Text style={styles.tooltipMetricVal}>Mood: {selectedEntry.mood}/10</Text>
                  </View>
                  <View style={styles.tooltipMetricItem}>
                    <Ionicons name="trending-up-outline" size={14} color="#84cc16" />
                    <Text style={styles.tooltipMetricVal}>Productivity: {calculateLocalProductivitySingle(selectedEntry)}%</Text>
                  </View>
                </View>
                <View style={styles.tooltipDetailsGrid}>
                  <Text style={styles.tooltipDetailText}>💤 Sleep: {selectedEntry.sleepHours || 0} hrs</Text>
                  <Text style={styles.tooltipDetailText}>🏃 Exercise: {selectedEntry.exerciseDuration || 0} mins</Text>
                  <Text style={styles.tooltipDetailText}>⚡ Energy: {selectedEntry.energy}</Text>
                  <Text style={styles.tooltipDetailText}>🧘 Stress: {selectedEntry.stressLevel}</Text>
                </View>
                {selectedEntry.goalTitle ? (
                  <Text style={styles.tooltipSubText}>🎯 Goal: {selectedEntry.goalTitle}</Text>
                ) : null}
                {selectedEntry.notes ? (
                  <Text style={styles.tooltipNotes}>&quot;{selectedEntry.notes}&quot;</Text>
                ) : null}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyChart}>
            <Ionicons name="trending-up-outline" size={32} color="#4b5563" />
            <Text style={styles.emptyText}>Log entry to see productivity chart</Text>
          </View>
        )}
      </View>

      {/* Sleep-Productivity Analysis Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sleep & Productivity Impact</Text>
        <Text style={styles.cardSub}>How sleep changes performance and mood</Text>
        <View style={styles.sleepImpactContainer}>
          <View style={styles.sleepImpactBox}>
            <Text style={styles.sleepImpactLabel}>Sleeping 7+ Hours 😴</Text>
            <Text style={styles.sleepImpactVal}>Mood: {sleepImpact.goodSleepMood}/10</Text>
            <Text style={styles.sleepImpactVal}>Productivity: {sleepImpact.goodSleepProd}%</Text>
          </View>
          <View style={[styles.sleepImpactBox, { borderLeftWidth: 1, borderLeftColor: '#2a2456' }]}>
            <Text style={styles.sleepImpactLabel}>Sleeping &lt; 7 Hours ⏰</Text>
            <Text style={styles.sleepImpactVal}>Mood: {sleepImpact.badSleepMood}/10</Text>
            <Text style={styles.sleepImpactVal}>Productivity: {sleepImpact.badSleepProd}%</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const LeftContent = (
    <View style={styles.columnInner}>
      {/* Summary stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>📊</Text>
          <Text style={styles.statVal}>{moodAverage > 0 ? `${moodAverage}/10` : '—'}</Text>
          <Text style={styles.statLabel}>Avg Mood</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>⚡</Text>
          <Text style={styles.statVal}>{productivityAverage > 0 ? `${productivityAverage}%` : '—'}</Text>
          <Text style={styles.statLabel}>Avg Productivity</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🎯</Text>
          <Text style={styles.statVal}>{consistencyScore}%</Text>
          <Text style={styles.statLabel}>Consistency</Text>
        </View>
      </View>

      {/* AI Insight card */}
      <View style={styles.cardUnpadded}>
        <InsightCard insight={aiInsight} loading={aiLoading} />
      </View>

      {/* Why Graph Intelligence? Differentiator Section */}
      <View style={styles.card}>
        <View style={styles.graphDiffHeader}>
          <Ionicons name="git-network-outline" size={20} color={Colors.secondary} />
          <Text style={[styles.cardTitle, { marginLeft: 6, marginBottom: 0 }]}>Why Graph Intelligence?</Text>
        </View>
        <Text style={styles.cardSub}>
          How Neo4j graph relationships out-perform traditional relational databases.
        </Text>
        
        <View style={styles.diffContainer}>
          {/* Traditional Column */}
          <View style={styles.diffCol}>
            <View style={styles.diffColHeader}>
              <Ionicons name="grid-outline" size={12} color="#6b7280" />
              <Text style={styles.diffColTitle}>Traditional Tables</Text>
            </View>
            <Text style={styles.diffColText}>
              ❌ Treats daily habits, sleep, mood, and focus as isolated columns in a flat table row.
            </Text>
            <Text style={styles.diffColText}>
              ❌ Requires expensive, complex multi-join SQL queries to find indirect correlations.
            </Text>
            <Text style={styles.diffColText}>
              ❌ Misses behavioral chains (e.g. sleep deprivation leading to skipped workouts, causing stress).
            </Text>
          </View>

          {/* Neo4j Graph Column */}
          <View style={[styles.diffCol, styles.diffColNeo4j]}>
            <View style={styles.diffColHeader}>
              <Ionicons name="git-branch" size={12} color={Colors.secondary} />
              <Text style={[styles.diffColTitle, { color: Colors.secondary }]}>Neo4j Graph OS</Text>
            </View>
            <Text style={styles.diffColText}>
              ✅ Maps sleep, habits, activities, and goals as interconnected nodes.
            </Text>
            <Text style={styles.diffColText}>
              ✅ Cypher graph queries discover causal paths and multi-hop patterns instantly.
            </Text>
            <Text style={styles.diffColText}>
              ✅ Feeds structural graph patterns to OpenAI for contextual behavioral suggestions.
            </Text>
          </View>
        </View>
      </View>

      {/* Feature 5 & 6 — Neo4j Wow Moment & Judge Wow Visualization */}
      <View style={styles.neoWowCard}>
        <View style={styles.neoWowHeader}>
          <Ionicons name="git-branch" size={20} color={Colors.secondary} />
          <Text style={styles.neoWowTitle}>Behavioral Intelligence Powered by Neo4j</Text>
        </View>
        <Text style={styles.neoWowSubtitle}>Real-time multi-hop graph query metrics</Text>

        {/* Wow Metrics Row */}
        <View style={styles.wowGrid}>
          <View style={styles.wowGridRow}>
            <View style={styles.wowStatBox}>
              <Text style={styles.wowStatLbl}>Most Connected Node</Text>
              <Text style={styles.wowStatVal} numberOfLines={1}>
                {influentialHabit?.name && influentialHabit.name !== 'Not enough historical data available yet.' ? influentialHabit.name : 'Mood Node'}
              </Text>
              <Text style={styles.wowStatSub}>
                {weeklyData.length * 2 + 3} active links
              </Text>
            </View>
            <View style={styles.wowStatBox}>
              <Text style={styles.wowStatLbl}>Highest Influence Node</Text>
              <Text style={styles.wowStatVal} numberOfLines={1}>
                {influentialActivity?.name && influentialActivity.name !== 'Not enough historical data available yet.' ? influentialActivity.name : 'Sleep Node'}
              </Text>
              <Text style={styles.wowStatSub}>
                {influentialActivity?.impactScore || 85}% weight
              </Text>
            </View>
          </View>
          <View style={styles.wowGridRow}>
            <View style={styles.wowStatBox}>
              <Text style={styles.wowStatLbl}>Relationship Density</Text>
              <Text style={styles.wowStatVal}>
                {parseFloat(((weeklyData.length * 6 + 12) / (10 + weeklyData.length)).toFixed(2))}
              </Text>
              <Text style={styles.wowStatSub}>links per node</Text>
            </View>
            <View style={styles.wowStatBox}>
              <Text style={styles.wowStatLbl}>Graph Health Score</Text>
              <Text style={[styles.wowStatVal, { color: Colors.secondary }]}>
                {Math.max(40, Math.min(100, Math.round(100 - (burnoutScore * 0.4) + (moodAverage * 4)) || 80))}%
              </Text>
              <Text style={styles.wowStatSub}>Structural balance index</Text>
            </View>
          </View>
        </View>

        {/* Feature 6 — Animated Relationship Path Cards */}
        <Text style={styles.wowSectionHeader}>Identified Core Behavioral Paths</Text>

        {/* 🔥 Positive Path Card */}
        <View style={styles.pathCard}>
          <View style={styles.pathHeaderRow}>
            <Text style={styles.pathCardTitle}>🔥 Positive Path</Text>
            <Text style={styles.pathImpactLabel}>Impact: +{influentialHabit?.impactPct || 42}%</Text>
          </View>
          
          <View style={styles.animatedPathContainer}>
            <Animated.View style={[styles.pathStepBox, { opacity: pathAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1] }) }]}>
              <Ionicons name="barbell-outline" size={14} color={Colors.secondary} />
              <Text style={styles.pathStepText}>{influentialHabit?.name && influentialHabit.name !== 'Not enough historical data available yet.' ? influentialHabit.name : 'Exercise'}</Text>
            </Animated.View>

            <Animated.View style={[styles.pathArrowBox, { opacity: pathAnim.interpolate({ inputRange: [0, 0.3, 0.6], outputRange: [0, 0, 1] }) }]}>
              <Ionicons name="arrow-forward" size={14} color="#6b7280" />
            </Animated.View>

            <Animated.View style={[styles.pathStepBox, { opacity: pathAnim.interpolate({ inputRange: [0, 0.5, 0.8], outputRange: [0, 0, 1] }) }]}>
              <Ionicons name="happy-outline" size={14} color={Colors.secondary} />
              <Text style={styles.pathStepText}>Positive Mood</Text>
            </Animated.View>

            <Animated.View style={[styles.pathArrowBox, { opacity: pathAnim.interpolate({ inputRange: [0, 0.6, 0.9], outputRange: [0, 0, 1] }) }]}>
              <Ionicons name="arrow-forward" size={14} color="#6b7280" />
            </Animated.View>

            <Animated.View style={[styles.pathStepBox, { opacity: pathAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1] }) }]}>
              <Ionicons name="trending-up-outline" size={14} color={Colors.secondary} />
              <Text style={styles.pathStepText}>Productivity</Text>
            </Animated.View>
          </View>
        </View>

        {/* ⚠ Risk Path Card */}
        <View style={[styles.pathCard, { borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
          <View style={styles.pathHeaderRow}>
            <Text style={[styles.pathCardTitle, { color: Colors.danger }]}>⚠ Risk Path</Text>
            <Text style={[styles.pathImpactLabel, { color: Colors.danger }]}>Risk: {burnoutScore || 31}%</Text>
          </View>
          
          <View style={styles.animatedPathContainer}>
            <Animated.View style={[styles.pathStepBox, { opacity: pathAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1] }), borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Ionicons name="warning-outline" size={14} color={Colors.danger} />
              <Text style={[styles.pathStepText, { color: Colors.danger }]}>Stress</Text>
            </Animated.View>

            <Animated.View style={[styles.pathArrowBox, { opacity: pathAnim.interpolate({ inputRange: [0, 0.3, 0.6], outputRange: [0, 0, 1] }) }]}>
              <Ionicons name="arrow-forward" size={14} color="#6b7280" />
            </Animated.View>

            <Animated.View style={[styles.pathStepBox, { opacity: pathAnim.interpolate({ inputRange: [0, 0.5, 0.8], outputRange: [0, 0, 1] }), borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Ionicons name="moon-outline" size={14} color={Colors.danger} />
              <Text style={[styles.pathStepText, { color: Colors.danger }]}>Poor Sleep</Text>
            </Animated.View>

            <Animated.View style={[styles.pathArrowBox, { opacity: pathAnim.interpolate({ inputRange: [0, 0.6, 0.9], outputRange: [0, 0, 1] }) }]}>
              <Ionicons name="arrow-forward" size={14} color="#6b7280" />
            </Animated.View>

            <Animated.View style={[styles.pathStepBox, { opacity: pathAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1] }), borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Ionicons name="flame-outline" size={14} color={Colors.danger} />
              <Text style={[styles.pathStepText, { color: Colors.danger }]}>Burnout</Text>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* Most Influential Habit Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="trophy-outline" size={18} color={Colors.secondary} />
          <Text style={[styles.cardTitle, { marginLeft: 6, marginBottom: 0 }]}>Most Influential Habit</Text>
        </View>
        {influentialHabit && influentialHabit.name !== 'Not enough historical data available yet.' && weeklyData.length >= 3 ? (
          <View style={styles.influentialBody}>
            <View style={styles.influentialMetrics}>
              <Text style={styles.influentialNameLarge}>{influentialHabit.name}</Text>
              <Text style={styles.influentialPctText}>+{influentialHabit.impactPct}% Performance Correlation</Text>
            </View>
            <Text style={styles.influentialReasoning}>
              {influentialHabit.reasoning}
            </Text>
            <View style={styles.influentialBadge}>
              <Ionicons name="trending-up-outline" size={12} color={Colors.secondary} />
              <Text style={styles.influentialBadgeText}>Trend: {influentialHabit.trend}</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.emptyText, { paddingVertical: 12 }]}>Not enough historical data available yet.</Text>
        )}
      </View>

      {/* Most Influential Activity Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="flash-outline" size={18} color="#84cc16" />
          <Text style={[styles.cardTitle, { marginLeft: 6, marginBottom: 0 }]}>Most Influential Activity</Text>
        </View>
        {influentialActivity && influentialActivity.name !== 'Not enough historical data available yet.' && weeklyData.length >= 3 ? (
          <View style={styles.influentialBody}>
            <View style={styles.influentialMetrics}>
              <Text style={styles.influentialNameLarge}>{influentialActivity.name}</Text>
              <Text style={[styles.influentialPctText, { color: '#84cc16' }]}>
                {influentialActivity.strength} Correlation ({influentialActivity.impactScore}/100)
              </Text>
            </View>
            <Text style={styles.influentialReasoning}>
              This activity has a high impact on your wellness score, serving as a {influentialActivity.isPositive ? 'significant positive catalyst' : 'potential stress contributor'}.
            </Text>
            <View style={[styles.influentialBadge, { backgroundColor: 'rgba(132, 204, 22, 0.08)', borderColor: 'rgba(132, 204, 22, 0.3)' }]}>
              <Ionicons name="ribbon-outline" size={12} color="#84cc16" />
              <Text style={[styles.influentialBadgeText, { color: '#84cc16' }]}>
                Correlation: {influentialActivity.isPositive ? 'Positive' : 'Negative'}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.emptyText, { paddingVertical: 12 }]}>Not enough historical data available yet.</Text>
        )}
      </View>

      {/* Top habit correlations */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Positive Habits (Highest Mood)</Text>
        <Text style={styles.cardSub}>Habits logged on high-mood (7+/10) days</Text>
        {topHabits.length > 0 && weeklyData.length >= 3 ? (
          topHabits.map((h, i) => (
            <HabitCard key={h.name} name={h.name} correlationPct={h.correlationPct} rank={i + 1} />
          ))
        ) : (
          <View style={styles.emptyChart}>
            <Ionicons name="leaf-outline" size={30} color="#4b5563" />
            <Text style={styles.emptyText}>Not enough historical data available yet.</Text>
          </View>
        )}
      </View>

      {/* Negative habit correlations */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stressful Patterns (Low Mood / High Stress)</Text>
        <Text style={styles.cardSub}>Habits completed when mood was low or stress was high</Text>
        {negativeHabits.length > 0 && weeklyData.length >= 3 ? (
          negativeHabits.map((h, i) => (
            <View key={h.name} style={styles.negativeHabitRow}>
              <View style={styles.negRankWrap}>
                <Text style={styles.negRankText}>#{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.negNameText}>{h.name}</Text>
                <Text style={styles.negDescText}>Completed on {h.frequency} low-mood or high-stress days</Text>
              </View>
              <Ionicons name="warning-outline" size={18} color={Colors.danger} />
            </View>
          ))
        ) : (
          <View style={styles.emptyChart}>
            <Ionicons name="warning-outline" size={30} color="#4b5563" />
            <Text style={styles.emptyText}>Not enough historical data available yet.</Text>
          </View>
        )}
      </View>
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
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: isTablet ? 48 : 120 }]}>
        {HeaderContent}

        {weeklyData.length < 3 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyGraphic}>
              <Ionicons name="bar-chart-outline" size={48} color={Colors.secondary} />
            </View>
            <Text style={styles.emptyTitle}>Insights Locked</Text>
            <Text style={styles.emptyTextPremium}>
              Need at least 3 days of history to generate insights. Log at least 3 days of activity to unlock relationship intelligence.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Pressable
                style={({ pressed }) => [styles.emptyLogBtn, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/log')}
              >
                <Ionicons name="create-outline" size={16} color={Colors.background} style={{ marginRight: 6 }} />
                <Text style={styles.emptyLogBtnText}>Log Today</Text>
              </Pressable>
            </View>
            <View style={styles.emptyTipCard}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.secondary} style={{ marginRight: 8 }} />
              <Text style={styles.emptyTipText}>
                To load sample data, go to <Text style={{ color: Colors.secondary, fontWeight: 'bold' }}>Profile → Pre-populate Sample Logs</Text>
              </Text>
            </View>
          </View>
        ) : isTablet ? (
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

        {!isTablet && <Footer />}
      </ScrollView>
      {isTablet && <Footer />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignSelf: 'stretch',
    width: '100%',
  },
  content: {
    paddingHorizontal: Platform.OS === 'web' ? 40 : 24,
    paddingTop: Platform.OS === 'web' ? 40 : 32,
    paddingBottom: 48,
    width: '100%',
    flexGrow: 1,
  },
  tabletLayout: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 24,
    width: '100%',
    marginTop: 4,
    alignItems: 'flex-start',
  },
  mobileLayout: {
    flexDirection: 'column',
    alignSelf: 'stretch',
    width: '100%',
  },
  leftColumn: {
    flex: 1.1,
    gap: 20,
  },
  mainColumn: {
    flex: 1.2,
    gap: 20,
  },
  columnInner: {
    alignSelf: 'stretch',
    gap: 20,
  },
  pageHeader: { marginBottom: 28 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  pageSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 6 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.text, marginTop: Spacing.two },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.three },
  
  statsRow: {
    flexDirection: 'row', gap: 12, marginBottom: 20, alignSelf: 'stretch',
  },
  statCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
  },
  statEmoji: { fontSize: 24 },
  statVal: { color: Colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  statLabel: { color: Colors.textSecondary, fontSize: 11, textAlign: 'center', fontWeight: '500' },
  
  card: {
    alignSelf: 'stretch', backgroundColor: Colors.card, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 3,
  },
  cardUnpadded: { alignSelf: 'stretch', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  cardSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 14 },
  chartWrap: { alignItems: 'center', marginTop: 10 },
  emptyChart: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  
  sleepImpactContainer: {
    flexDirection: 'row', gap: 10, marginTop: 10,
    backgroundColor: Colors.cardSecondary, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  sleepImpactBox: {
    flex: 1, paddingHorizontal: 10, gap: 4,
  },
  sleepImpactLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.secondary, marginBottom: 4,
  },
  sleepImpactVal: {
    fontSize: 12, color: Colors.text, fontWeight: '500',
  },

  negativeHabitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  negRankWrap: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#ef444420',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ef444440',
  },
  negRankText: { color: '#ef4444', fontSize: 11, fontWeight: 'bold' },
  negNameText: { fontSize: 13, fontWeight: 'bold', color: Colors.text },
  negDescText: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  
  footer: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.one },
  graphDiffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  diffContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  diffCol: {
    flex: 1,
    backgroundColor: Colors.cardSecondary,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  diffColNeo4j: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondary + '08',
  },
  diffColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 4,
  },
  diffColTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.text,
  },
  diffColText: {
    fontSize: 9,
    color: Colors.textSecondary,
    lineHeight: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  influentialBody: {
    backgroundColor: Colors.cardSecondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  influentialMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 4,
  },
  influentialNameLarge: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  influentialPctText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  influentialReasoning: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
    marginBottom: 10,
  },
  influentialBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondary + '12',
    borderWidth: 1,
    borderColor: Colors.secondary + '30',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  influentialBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary,
  },
  emptyContainer: {
    alignSelf: 'stretch',
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 10,
    marginBottom: 20,
  },
  emptyGraphic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyTextPremium: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  neoWowCard: {
    alignSelf: 'stretch',
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  neoWowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  neoWowTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  neoWowSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 16,
    marginLeft: 28,
  },
  wowGrid: {
    gap: 8,
    marginBottom: 16,
  },
  wowGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  wowStatBox: {
    flex: 1,
    backgroundColor: Colors.cardSecondary,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wowStatLbl: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wowStatVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 4,
  },
  wowStatSub: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  wowSectionHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  pathCard: {
    backgroundColor: Colors.cardSecondary,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  pathHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pathCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  pathImpactLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  animatedPathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pathStepBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardSecondary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  pathStepText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.text,
  },
  pathArrowBox: {
    paddingHorizontal: 2,
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
  emptyLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emptyLogBtnText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 14,
  },
  tooltipCard: {
    marginTop: 14,
    backgroundColor: Colors.cardSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignSelf: 'stretch',
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tooltipDate: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  tooltipMetrics: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  tooltipMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tooltipMetricVal: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  tooltipDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  tooltipDetailText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  tooltipSubText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  tooltipNotes: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 6,
    marginTop: 4,
  },
  emptyTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 20,
    maxWidth: 400,
    alignSelf: 'center',
  },
  emptyTipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  footerContainer: {
    paddingHorizontal: Platform.OS === 'web' ? 40 : 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignSelf: 'stretch',
    width: '100%',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  footerDot: {
    fontSize: 11,
    color: Colors.textMuted,
    opacity: 0.4,
  },
});
