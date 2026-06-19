import React, { useState, useCallback, useContext } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  ActivityIndicator, Platform, Alert, TextInput
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../constants/theme';
import { getEntries, clearAllEntries } from '../utils/storage';
import { logMood, resetUserData } from '../services/api';
import { UserContext } from './_layout';

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useContext(UserContext);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [entriesCount, setEntriesCount] = useState(0);
  const [avgMood, setAvgMood] = useState(0);
  const [avgSleep, setAvgSleep] = useState(0);
  const [resyncing, setResyncing] = useState(false);
  const [toast, setToast] = useState('');
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [badgeUnlocks, setBadgeUnlocks] = useState<Record<string, string>>({});

  // Editing username state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const loadProfile = async () => {
    const [name, id, presMode, storedUnlocksRaw] = await Promise.all([
      AsyncStorage.getItem('@mindgraph_userName'),
      AsyncStorage.getItem('@mindgraph_userId'),
      AsyncStorage.getItem('@mindgraph_presentation_mode'),
      AsyncStorage.getItem('@mindgraph_badge_unlocks'),
    ]);
    const entries = await getEntries();

    setUserName(name || '');
    setEditName(name || '');
    setUserId(id || '');
    setEntriesCount(entries.length);
    setIsPresentationMode(presMode === 'true');

    let currentAvgMood = 0;
    let currentAvgSleep = 0;
    if (entries.length > 0) {
      currentAvgMood = entries.reduce((s, e) => s + e.mood, 0) / entries.length;
      currentAvgSleep = entries.reduce((s, e) => s + (e.sleepHours || 7), 0) / entries.length;
      setAvgMood(parseFloat(currentAvgMood.toFixed(1)));
      setAvgSleep(parseFloat(currentAvgSleep.toFixed(1)));
    } else {
      setAvgMood(0);
      setAvgSleep(0);
    }

    // Determine Badge unlocks
    // 1. Neo4j Pioneer
    const pioneerUnlocked = !!id && !id.startsWith('local_');
    const pioneerUnlockDate = pioneerUnlocked ? (entries[0]?.date || new Date().toISOString().split('T')[0]) : '';

    // 2. Consistency King: 7 consecutive logs
    let maxStreak = 0;
    let currentStreak = 0;
    let streakEndDate = '';
    for (let i = 0; i < entries.length; i++) {
      if (i === 0) {
        currentStreak = 1;
      } else {
        const prev = new Date(entries[i-1].date + 'T12:00:00');
        const curr = new Date(entries[i].date + 'T12:00:00');
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else if (diffDays > 1) {
          currentStreak = 1;
        }
      }
      if (currentStreak >= maxStreak) {
        maxStreak = currentStreak;
        if (currentStreak >= 7) {
          streakEndDate = entries[i].date;
        }
      }
    }
    const consistencyKingUnlocked = maxStreak >= 7;

    // 3. Sleep Champion: Avg sleep > 7.5 over last 7 entries
    const sleepEntries = entries.slice(-7);
    const avgSleepVal = sleepEntries.length >= 7 ? sleepEntries.reduce((s, e) => s + (e.sleepHours || 0), 0) / sleepEntries.length : 0;
    const sleepUnlocked = sleepEntries.length >= 7 && avgSleepVal > 7.5;
    const sleepUnlockDate = sleepUnlocked ? sleepEntries[sleepEntries.length - 1].date : '';

    // 4. Habit Hero: Complete habits on 10 separate days
    const habitDays = entries.filter(e => e.habits && Object.values(e.habits).some(Boolean));
    const habitHeroUnlocked = habitDays.length >= 10;
    const habitHeroUnlockDate = habitHeroUnlocked ? habitDays[9].date : '';

    const unlocks = storedUnlocksRaw ? JSON.parse(storedUnlocksRaw) : {};
    let unlocksChanged = false;

    const updateUnlock = (key: string, isUnlocked: boolean, dateStr: string) => {
      if (isUnlocked && !unlocks[key]) {
        unlocks[key] = dateStr || new Date().toISOString().split('T')[0];
        unlocksChanged = true;
      } else if (!isUnlocked && unlocks[key]) {
        delete unlocks[key];
        unlocksChanged = true;
      }
    };

    updateUnlock('pioneer', pioneerUnlocked, pioneerUnlockDate);
    updateUnlock('consistency', consistencyKingUnlocked, streakEndDate);
    updateUnlock('sleep', sleepUnlocked, sleepUnlockDate);
    updateUnlock('habit', habitHeroUnlocked, habitHeroUnlockDate);

    if (unlocksChanged) {
      await AsyncStorage.setItem('@mindgraph_badge_unlocks', JSON.stringify(unlocks));
    }
    setBadgeUnlocks(unlocks);
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // Re-sync all local storage entries to Neo4j database
  const handleResync = async () => {
    setResyncing(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const entries = await getEntries();
      if (entries.length === 0) {
        showToast('ℹ️ No entries to sync.');
        setResyncing(false);
        return;
      }

      let syncCount = 0;
      for (const e of entries) {
        try {
          await logMood({
            userId,
            userName,
            score: e.mood,
            energyLevel: e.energy,
            sleepHours: e.sleepHours || 7,
            exerciseDuration: e.exerciseDuration || 0,
            studyHours: e.studyHours || 0,
            workHours: e.workHours || 0,
            socialInteraction: e.socialInteraction || '',
            stressLevel: e.stressLevel || 'Medium',
            goalTitle: e.goalTitle || '',
            activityName: e.activityName || '',
            notes: e.notes || '',
            habits: e.habits,
          });
          syncCount++;
        } catch {
          // Keep trying for other entries
        }
      }
      showToast(`✅ Synced ${syncCount}/${entries.length} logs to Neo4j!`);
    } catch {
      showToast('❌ Sync operation failed.');
    } finally {
      setResyncing(false);
    }
  };

  // Clear cache and log out
  const handleClearCache = async () => {
    const performClear = async () => {
      await clearAllEntries();
      await logout();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };

    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to reset MindGraph? All local data and profile settings will be deleted.');
      if (confirm) performClear();
    } else {
      Alert.alert(
        'Reset App?',
        'This will erase all your logged days and log you out. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset Everything', style: 'destructive', onPress: performClear },
        ]
      );
    }
  };

  const handleUpdateName = async () => {
    if (!editName.trim()) return;
    await AsyncStorage.setItem('@mindgraph_userName', editName.trim());
    setUserName(editName.trim());
    setIsEditingName(false);
    showToast('✅ Profile name updated!');
  };

  const handleTogglePresentationMode = async () => {
    const nextVal = !isPresentationMode;
    await AsyncStorage.setItem('@mindgraph_presentation_mode', String(nextVal));
    setIsPresentationMode(nextVal);
    showToast(`✅ Presentation Mode: ${nextVal ? 'ENABLED' : 'DISABLED'}`);
  };

  const handleClearDemoData = async () => {
    const performClear = async () => {
      setResyncing(true);
      try {
        if (userId && !userId.startsWith('local_')) {
          try {
            await resetUserData(userId);
          } catch (apiErr) {
            console.warn('Failed to delete user nodes from Neo4j server:', apiErr);
          }
        }
        await Promise.all([
          AsyncStorage.removeItem('@mindgraph_entries_v2'),
          AsyncStorage.removeItem('@mindgraph_userId'),
          AsyncStorage.removeItem('@mindgraph_userName'),
          AsyncStorage.removeItem('@mindgraph_badge_unlocks'),
          AsyncStorage.removeItem('@mindgraph_presentation_mode'),
        ]);
        await logout();
        showToast('✅ Demo data cleared. Redirecting...');
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      } catch (err) {
        showToast('❌ Clear operation failed.');
      } finally {
        setResyncing(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirm = window.confirm('Clear all demo data? This deletes all local and remote Neo4j nodes, logs, and resets onboarding.');
      if (confirm) performClear();
    } else {
      Alert.alert(
        'Clear Demo & Test Data?',
        'This completely purges your local device logs, wipes your Neo4j node cluster, and resets the onboarding state. This is intended for final hackathon demo runs.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Purge Demo Data', style: 'destructive', onPress: performClear },
        ]
      );
    }
  };

  // Determine Badge eligibility
  const badges = [
    { title: 'Neo4j Pioneer', desc: 'Saved profile on Neo4j Graph Cloud', icon: 'cloud-done', unlocked: !!badgeUnlocks.pioneer, date: badgeUnlocks.pioneer },
    { title: 'Consistency King', desc: 'Logged 7 consecutive days', icon: 'trophy', unlocked: !!badgeUnlocks.consistency, date: badgeUnlocks.consistency },
    { title: 'Sleep Champion', desc: 'Maintain avg sleep >= 7.5 hours over last 7 days', icon: 'moon', unlocked: !!badgeUnlocks.sleep, date: badgeUnlocks.sleep },
    { title: 'Habit Hero', desc: 'Complete habits for 10 days', icon: 'ribbon', unlocked: !!badgeUnlocks.habit, date: badgeUnlocks.habit },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
        </View>

        {isEditingName ? (
          <View style={styles.editNameRow}>
            <TextInput
              style={styles.nameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor="#6b7280"
              autoFocus
            />
            <Pressable style={styles.saveBtn} onPress={handleUpdateName}>
              <Ionicons name="checkmark" size={18} color="#1a1a2e" />
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setIsEditingName(false)}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{userName}</Text>
            <Pressable style={styles.editIcon} onPress={() => setIsEditingName(true)}>
              <Ionicons name="create-outline" size={16} color={Colors.secondary} />
            </Pressable>
          </View>
        )}
        <Text style={styles.userIdText}>ID: {isPresentationMode ? '[Hidden in Presentation Mode]' : (userId || 'Local Offline Mode')}</Text>
      </View>

      {toast ? (
        <View style={[styles.toast, { backgroundColor: toast.startsWith('❌') ? Colors.danger : Colors.success }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* STATS ROW */}
      <View style={styles.statsCard}>
        <View style={styles.statCol}>
          <Text style={styles.statVal}>{entriesCount}</Text>
          <Text style={styles.statLabel}>Total Logs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statVal}>{avgMood > 0 ? `${avgMood}/10` : '—'}</Text>
          <Text style={styles.statLabel}>Avg Mood</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statVal}>{avgSleep > 0 ? `${avgSleep}h` : '—'}</Text>
          <Text style={styles.statLabel}>Avg Sleep</Text>
        </View>
      </View>

      {/* ACHIEVEMENTS/BADGES BOARD */}
      <Text style={styles.sectionTitle}>Wellness Badges</Text>
      <View style={styles.badgeGrid}>
        {badges.map((b) => (
          <View key={b.title} style={[styles.badgeCard, !b.unlocked && styles.badgeLocked]}>
            <View style={[styles.badgeIconBg, { backgroundColor: b.unlocked ? '#7c3aed20' : '#1f1a3a' }]}>
              <Ionicons
                name={b.icon as any}
                size={22}
                color={b.unlocked ? Colors.secondary : '#4b5563'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.badgeTitle, !b.unlocked && { color: '#6b7280' }]}>{b.title}</Text>
              <Text style={styles.badgeDesc}>{b.desc}</Text>
              {b.unlocked && b.date ? (
                <Text style={styles.badgeUnlockDate}>Unlocked On: {b.date}</Text>
              ) : null}
            </View>
            {!b.unlocked && <Ionicons name="lock-closed-outline" size={14} color="#4b5563" />}
          </View>
        ))}
      </View>

      {/* SETTINGS CARD */}
      <Text style={styles.sectionTitle}>Data Control & Settings</Text>
      <View style={styles.settingsCard}>
        {/* Re-sync */}
        <Pressable
          style={styles.settingsRow}
          disabled={resyncing}
          onPress={handleResync}
        >
          <Ionicons name="sync-outline" size={20} color={Colors.secondary} />
          <View style={styles.settingsText}>
            <Text style={styles.settingsTitle}>Cloud Database Re-sync</Text>
            <Text style={styles.settingsDesc}>Force uploads all local storage logs to Neo4j.</Text>
          </View>
          {resyncing ? (
            <ActivityIndicator color={Colors.secondary} size="small" />
          ) : (
            <Ionicons name="chevron-forward" size={16} color="#6b7280" />
          )}
        </Pressable>

        {/* Presentation Mode Toggle */}
        <View style={styles.settingsRow}>
          <Ionicons name="desktop-outline" size={20} color={Colors.secondary} />
          <View style={styles.settingsText}>
            <Text style={styles.settingsTitle}>Presentation Mode</Text>
            <Text style={styles.settingsDesc}>Hide debug metadata and maximize visual polish for judges.</Text>
          </View>
          <Pressable
            style={[styles.toggleBtn, isPresentationMode && styles.toggleBtnActive]}
            onPress={handleTogglePresentationMode}
          >
            <View style={[styles.toggleCircle, isPresentationMode && styles.toggleCircleActive]} />
          </Pressable>
        </View>

        {/* Clear cache */}
        <Pressable style={styles.settingsRow} onPress={handleClearCache}>
          <Ionicons name="log-out-outline" size={20} color="#fb923c" />
          <View style={styles.settingsText}>
            <Text style={[styles.settingsTitle, { color: '#fb923c' }]}>Reset Cache & Log out</Text>
            <Text style={styles.settingsDesc}>Deletes all logs locally and logs out of user profile.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
        </Pressable>

        {/* Clear Demo/Test Data */}
        <Pressable style={[styles.settingsRow, { borderBottomWidth: 0 }]} onPress={handleClearDemoData}>
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          <View style={styles.settingsText}>
            <Text style={[styles.settingsTitle, { color: Colors.danger }]}>Clear Demo & Test Data</Text>
            <Text style={styles.settingsDesc}>Resets all Neo4j nodes, logs, caches, and onboarding state.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
        </Pressable>
      </View>

      <Text style={styles.footer}>MindGraph Behavioral OS · Version 2.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.three,
    alignItems: 'center',
    maxWidth: Platform.OS === 'web' ? 580 : '100%',
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  editIcon: { padding: 4 },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
  },
  nameInput: {
    height: 36,
    backgroundColor: '#2a2456',
    borderWidth: 1,
    borderColor: Colors.secondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 15,
    width: 150,
  },
  saveBtn: {
    width: 32,
    height: 32,
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#4b5563',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userIdText: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  
  toast: {
    borderRadius: 12, padding: 12, marginBottom: Spacing.two,
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13, flex: 1 },

  statsCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    backgroundColor: '#1f1a3a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2456',
    paddingVertical: Spacing.three,
    marginBottom: Spacing.four,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#2a2456',
    alignSelf: 'center',
  },

  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.two,
  },
  
  badgeGrid: {
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: Spacing.four,
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1a3a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2456',
    padding: 12,
    gap: 12,
  },
  badgeLocked: {
    borderColor: '#221b44',
    opacity: 0.6,
  },
  badgeIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeTitle: { fontSize: 13, fontWeight: 'bold', color: Colors.secondary },
  badgeDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  
  settingsCard: {
    alignSelf: 'stretch',
    backgroundColor: '#1f1a3a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2456',
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2456',
  },
  settingsText: {
    flex: 1,
    marginLeft: 12,
  },
  settingsTitle: { fontSize: 13, fontWeight: 'bold', color: Colors.text },
  settingsDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  
  footer: { fontSize: 10, color: '#374151', textAlign: 'center', marginTop: Spacing.two },
  badgeUnlockDate: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginTop: 4,
  },
  toggleBtn: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2a2456',
    padding: 2,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.secondary,
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
});
