import React, { useState, useCallback, useContext } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  ActivityIndicator, Platform, Alert, TextInput,
  useWindowDimensions
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../constants/theme';
import { getEntries, clearAllEntries, saveEntry } from '../utils/storage';
import { logMood, resetUserData } from '../services/api';
import { seedSampleLogs, clearAllDemoData } from '../utils/sampleData';
import { UserContext } from './_layout';

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useContext(UserContext);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
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

  // Sample log picker state
  const [showSamplePicker, setShowSamplePicker] = useState(false);
  const [sampleCount, setSampleCount] = useState(10);

  // Inline confirm dialog states (replaces window.confirm and Alert which are unreliable on web)
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

  const getPastDateString = (offset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePrepopulate = async (count: number) => {
    setShowSamplePicker(false);
    setResyncing(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await seedSampleLogs(count);
      showToast(`✅ Seeded ${count} sample log${count > 1 ? 's' : ''}! Refresh other pages to see data.`);
      await loadProfile();
    } catch (err) {
      console.error(err);
      showToast('❌ Seeding failed.');
    } finally {
      setResyncing(false);
    }
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

  // Clear ALL cache, delete account and log out to onboarding
  const handleClearCache = async () => {
    setShowLogoutConfirm(true);
  };

  const performLogout = async () => {
    setShowLogoutConfirm(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (userId && !userId.startsWith('local_')) {
      try { await resetUserData(userId); } catch {}
    }
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@mindgraph_show_logout_toast', 'true');
    await logout();
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

  const handleClearDemoData = () => {
    setShowClearConfirm(true);
  };

  const performClearDemoData = async () => {
    setShowClearConfirm(false);
    setResyncing(true);
    try {
      await AsyncStorage.removeItem('@mindgraph_entries_v2');
      await AsyncStorage.removeItem('@mindgraph_badge_unlocks');
      // Also attempt Neo4j cleanup (best-effort)
      if (userId && !userId.startsWith('local_')) {
        try { await resetUserData(userId); } catch {}
      }
      showToast('✅ All demo & test data deleted!');
      await loadProfile();
    } catch (err) {
      console.error('Clear failed:', err);
      showToast('❌ Clear operation failed.');
    } finally {
      setResyncing(false);
    }
  };

  // Determine Badge eligibility
  const badges = [
    { title: 'Neo4j Pioneer', desc: 'Saved profile on Neo4j Graph Cloud', icon: 'cloud-done', unlocked: !!badgeUnlocks.pioneer, date: badgeUnlocks.pioneer },
    { title: 'Consistency King', desc: 'Logged 7 consecutive days', icon: 'trophy', unlocked: !!badgeUnlocks.consistency, date: badgeUnlocks.consistency },
    { title: 'Sleep Champion', desc: 'Maintain avg sleep >= 7.5 hours over last 7 days', icon: 'moon', unlocked: !!badgeUnlocks.sleep, date: badgeUnlocks.sleep },
    { title: 'Habit Hero', desc: 'Complete habits for 10 days', icon: 'ribbon', unlocked: !!badgeUnlocks.habit, date: badgeUnlocks.habit },
  ];

  const HeaderContent = (
    <View style={styles.profileHeader}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
        </View>
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
            <Ionicons name="create-outline" size={18} color={Colors.secondary} />
          </Pressable>
        </View>
      )}
      <Text style={styles.userIdText}>ID: {isPresentationMode ? '[Hidden in Presentation Mode]' : (userId || 'Local Offline Mode')}</Text>
    </View>
  );

  const MainContent = (
    <View style={styles.columnInner}>
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
    </View>
  );

  const LeftContent = (
    <View style={styles.columnInner}>
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

        {/* Pre-populate Sample Logs */}
        <Pressable
          style={styles.settingsRow}
          disabled={resyncing}
          onPress={() => setShowSamplePicker(true)}
        >
          <Ionicons name="construct-outline" size={20} color={Colors.secondary} />
          <View style={styles.settingsText}>
            <Text style={styles.settingsTitle}>Pre-populate Sample Logs</Text>
            <Text style={styles.settingsDesc}>Choose how many sample entries to load (3–20).</Text>
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
        <Pressable style={[styles.settingsRow, { borderBottomWidth: 0 }]} onPress={handleClearDemoData} disabled={resyncing}>
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          <View style={styles.settingsText}>
            <Text style={[styles.settingsTitle, { color: Colors.danger }]}>Clear Demo & Test Data</Text>
            <Text style={styles.settingsDesc}>Deletes all logged entries & graph data. Keeps your account.</Text>
          </View>
          {resyncing ? (
            <ActivityIndicator color={Colors.danger} size="small" />
          ) : (
            <Ionicons name="chevron-forward" size={16} color="#6b7280" />
          )}
        </Pressable>
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
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {HeaderContent}

        {isTablet ? (
          <View style={styles.tabletLayout}>
            <View style={styles.leftColumn}>{MainContent}</View>
            <View style={styles.mainColumn}>{LeftContent}</View>
          </View>
        ) : (
          <View style={styles.mobileLayout}>
            {MainContent}
            {LeftContent}
          </View>
        )}

        <Text style={styles.footer}>MindGraph Behavioral OS · Version 2.0.0</Text>
      </ScrollView>

    {/* ── INLINE OVERLAY: Sample Count Picker ── */}
    {showSamplePicker && (
      <View style={styles.overlayBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>How many sample logs?</Text>
          <Text style={styles.modalSubtitle}>Select 3 to 20 entries to pre-populate</Text>
          <View style={styles.countGrid}>
            {Array.from({ length: 18 }, (_, i) => i + 3).map((n) => (
              <Pressable
                key={n}
                style={[styles.countBtn, sampleCount === n && styles.countBtnActive]}
                onPress={() => setSampleCount(n)}
              >
                <Text style={[styles.countBtnText, sampleCount === n && styles.countBtnTextActive]}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.pickerNoteContainer}>
            <Ionicons name="warning-outline" size={14} color="#fb923c" style={{ marginRight: 6 }} />
            <Text style={styles.pickerNoteText}>
              Options 1 and 2 are omitted because Insights and Graph view require at least 3 logs of history to function properly.
            </Text>
          </View>
          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancelBtn} onPress={() => setShowSamplePicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.modalConfirmBtn} onPress={() => handlePrepopulate(sampleCount)}>
              <Ionicons name="construct-outline" size={16} color="#1a1a2e" style={{ marginRight: 6 }} />
              <Text style={styles.modalConfirmText}>Load {sampleCount} Log{sampleCount > 1 ? 's' : ''}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    )}

    {/* ── INLINE OVERLAY: Clear Demo Data Confirm ── */}
    {showClearConfirm && (
      <View style={styles.overlayBackdrop}>
        <View style={styles.modalCard}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="trash-outline" size={36} color={Colors.danger} />
          </View>
          <Text style={styles.modalTitle}>Delete Demo & Test Data?</Text>
          <Text style={[styles.modalSubtitle, { marginBottom: 24 }]}>
            This will delete ALL your logged entries and Neo4j graph data. Your account name and settings are kept.
          </Text>
          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancelBtn} onPress={() => setShowClearConfirm(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalConfirmBtn, { backgroundColor: Colors.danger }]}
              onPress={performClearDemoData}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={[styles.modalConfirmText, { color: '#fff' }]}>Delete Data</Text>
            </Pressable>
          </View>
        </View>
      </View>
    )}

    {/* ── INLINE OVERLAY: Reset Cache / Logout Confirm ── */}
    {showLogoutConfirm && (
      <View style={styles.overlayBackdrop}>
        <View style={styles.modalCard}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="warning-outline" size={36} color="#fb923c" />
          </View>
          <Text style={styles.modalTitle}>Delete Account?</Text>
          <Text style={[styles.modalSubtitle, { marginBottom: 24 }]}>
            This permanently deletes your account, all logs, and profile data. You will be taken back to onboarding. This cannot be undone.
          </Text>
          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancelBtn} onPress={() => setShowLogoutConfirm(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalConfirmBtn, { backgroundColor: '#fb923c' }]}
              onPress={performLogout}
            >
              <Ionicons name="log-out-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={[styles.modalConfirmText, { color: '#fff' }]}>Delete Account</Text>
            </Pressable>
          </View>
        </View>
      </View>
    )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    alignItems: 'center',
    maxWidth: Platform.OS === 'web' ? 1100 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  tabletLayout: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 24,
    width: '100%',
    marginTop: 8,
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
  profileHeader: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 32,
    paddingBottom: 24,
    alignSelf: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#221e42',
  },
  avatarWrap: {
    marginBottom: 14,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 3,
    borderColor: Colors.secondary + '55',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#0a0820' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: { fontSize: 24, fontWeight: '800', color: Colors.text },
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
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13, flex: 1 },

  statsCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    backgroundColor: '#13102a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#221e42',
    paddingVertical: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statVal: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#221e42',
    alignSelf: 'center',
  },

  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  
  badgeGrid: {
    alignSelf: 'stretch',
    gap: 12,
    marginBottom: 24,
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13102a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#221e42',
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeLocked: {
    borderColor: '#1a1735',
    opacity: 0.55,
  },
  badgeIconBg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeTitle: { fontSize: 14, fontWeight: '700', color: Colors.secondary },
  badgeDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  
  settingsCard: {
    alignSelf: 'stretch',
    backgroundColor: '#13102a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#221e42',
    paddingHorizontal: 20,
    marginBottom: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1a38',
  },
  settingsText: {
    flex: 1,
    marginLeft: 14,
  },
  settingsTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  settingsDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  
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
    // Sample picker modal
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9, 7, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(9, 7, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  modalCard: {
    backgroundColor: '#16122d',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#372f60',
    padding: 24,
    width: Platform.OS === 'web' ? 420 : '90%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  countGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 20,
  },
  countBtn: {
    width: 44,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0c0a18',
    borderWidth: 1,
    borderColor: '#2a2456',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBtnActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  countBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  countBtnTextActive: {
    color: '#090714',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#372f60',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  modalConfirmText: {
    color: '#090714',
    fontWeight: 'bold',
    fontSize: 13,
  },
  pickerNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 146, 60, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.25)',
    padding: 12,
    marginBottom: 24,
  },
  pickerNoteText: {
    color: '#fb923c',
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
    fontWeight: '600',
  },
});
