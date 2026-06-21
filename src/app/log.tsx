import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TextInput, ScrollView,
  Pressable, Platform, KeyboardAvoidingView, ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../constants/theme';
import { getEntries, saveEntry, formatDateString } from '../utils/storage';
import { logMood } from '../services/api';

const MOOD_EMOJIS: Record<number, string> = {
  1: '😞', 2: '😞', 3: '😐', 4: '😐',
  5: '🙂', 6: '🙂', 7: '😊', 8: '😊',
  9: '🤩', 10: '🤩',
};

const MOOD_LABELS: Record<number, string> = {
  1: 'Very Low', 2: 'Low', 3: 'Okay-ish', 4: 'Below Average',
  5: 'Average', 6: 'Decent', 7: 'Good', 8: 'Great',
  9: 'Excellent', 10: 'Amazing!',
};

const MOOD_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#fb923c', 4: '#fbbf24',
  5: '#eab308', 6: '#a3e635', 7: '#22c55e', 8: '#14b8a6',
  9: '#06b6d4', 10: '#8b5cf6',
};

export default function LogScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [mood, setMood] = useState(7);
  const [energy, setEnergy] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [sleep, setSleep] = useState(false);
  const [exercise, setExercise] = useState(false);
  const [meditation, setMeditation] = useState(false);
  const [deepWork, setDeepWork] = useState(false);
  const [notes, setNotes] = useState('');

  const [sleepHours, setSleepHours] = useState('7.0');
  const [exerciseDuration, setExerciseDuration] = useState('0');
  const [studyHours, setStudyHours] = useState('0');
  const [workHours, setWorkHours] = useState('0');
  const [socialInteraction, setSocialInteraction] = useState('');
  const [stressLevel, setStressLevel] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [goalTitle, setGoalTitle] = useState('');
  const [activityName, setActivityName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function prefill() {
        const entries = await getEntries();
        const today = entries.find((e) => e.date === formatDateString(new Date()));
        if (today) {
          setMood(today.mood);
          setEnergy(today.energy);
          setSleep(today.habits.sleep);
          setExercise(today.habits.exercise);
          setMeditation(today.habits.meditation);
          setDeepWork(today.habits.deepWork);
          setNotes(today.notes);
          setSleepHours(String(today.sleepHours ?? '7.0'));
          setExerciseDuration(String(today.exerciseDuration ?? '0'));
          setStudyHours(String(today.studyHours ?? '0'));
          setWorkHours(String(today.workHours ?? '0'));
          setSocialInteraction(today.socialInteraction || '');
          setStressLevel(today.stressLevel || 'Medium');
          setGoalTitle(today.goalTitle || '');
          setActivityName(today.activityName || '');
        } else {
          setMood(7); setEnergy('Medium'); setSleep(false); setExercise(false);
          setMeditation(false); setDeepWork(false); setNotes('');
          setSleepHours('7.0'); setExerciseDuration('0'); setStudyHours('0'); setWorkHours('0');
          setSocialInteraction(''); setStressLevel('Medium'); setGoalTitle(''); setActivityName('');
        }
      }
      prefill();
    }, [])
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const userId = (await AsyncStorage.getItem('@mindgraph_userId')) || '';
      const userName = (await AsyncStorage.getItem('@mindgraph_userName')) || 'Friend';
      const today = formatDateString(new Date());
      const habits = { sleep, exercise, meditation, deepWork };
      const payload = {
        date: today, mood, energy,
        sleepHours: parseFloat(sleepHours) || 0,
        exerciseDuration: parseFloat(exerciseDuration) || 0,
        studyHours: parseFloat(studyHours) || 0,
        workHours: parseFloat(workHours) || 0,
        socialInteraction: socialInteraction.trim(),
        stressLevel, goalTitle: goalTitle.trim(),
        activityName: activityName.trim(), habits, notes: notes.trim(),
      };
      await saveEntry(payload);
      if (userId) {
        try {
          await logMood({ userId, userName, score: mood, energyLevel: energy,
            sleepHours: parseFloat(sleepHours) || 0, exerciseDuration: parseFloat(exerciseDuration) || 0,
            studyHours: parseFloat(studyHours) || 0, workHours: parseFloat(workHours) || 0,
            socialInteraction: socialInteraction.trim(), stressLevel, goalTitle: goalTitle.trim(),
            activityName: activityName.trim(), notes: notes.trim(), habits,
          });
        } catch {}
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSavedSuccess(true);
      showToast('✅ Entry saved to behavioral graph!');
      setTimeout(() => router.push('/'), 2200);
    } catch (err) {
      showToast('❌ Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const moodColor = MOOD_COLORS[mood] || Colors.secondary;

  // ─── LEFT COLUMN ────────────────────────────────────────────
  const LeftContent = (
    <View style={styles.col}>

      {/* Mood Picker */}
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardLabelBadge}>
            <Ionicons name="happy-outline" size={12} color={Colors.secondary} />
            <Text style={styles.cardLabelText}>Mood Score</Text>
          </View>
          <View style={[styles.moodBadge, { backgroundColor: moodColor + '22', borderColor: moodColor + '55' }]}>
            <Text style={[styles.moodBadgeText, { color: moodColor }]}>
              {MOOD_EMOJIS[mood]} {mood}/10 — {MOOD_LABELS[mood]}
            </Text>
          </View>
        </View>

        <View style={styles.dotsRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => {
            const selected = step === mood;
            const dotColor = MOOD_COLORS[step];
            return (
              <Pressable
                key={step}
                style={[styles.dot, {
                  backgroundColor: selected ? dotColor : '#1e1a38',
                  borderColor: selected ? dotColor : '#2e2855',
                  transform: [{ scale: selected ? 1.18 : 1 }],
                }]}
                onPress={() => { setMood(step); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
              >
                <Text style={[styles.dotText, selected && { color: '#fff', fontWeight: '800' }]}>{step}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Energy & Stress */}
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardLabelBadge}>
            <Ionicons name="flash-outline" size={12} color={Colors.secondary} />
            <Text style={styles.cardLabelText}>Energy Level</Text>
          </View>
        </View>
        <View style={styles.selectionRow}>
          {(['Low', 'Medium', 'High'] as const).map((level) => {
            const active = energy === level;
            const colors = { Low: '#ef4444', Medium: Colors.primary, High: Colors.secondary };
            return (
              <Pressable
                key={level}
                style={[styles.selectorBtn, active && { backgroundColor: colors[level], borderColor: colors[level] }]}
                onPress={() => setEnergy(level)}
              >
                <Text style={[styles.selectorText, active && styles.selectorTextActive]}>{level}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.cardTopRow, { marginTop: 20 }]}>
          <View style={styles.cardLabelBadge}>
            <Ionicons name="pulse-outline" size={12} color="#fb923c" />
            <Text style={[styles.cardLabelText, { color: '#fb923c' }]}>Stress Level</Text>
          </View>
        </View>
        <View style={styles.selectionRow}>
          {(['Low', 'Medium', 'High'] as const).map((level) => {
            const active = stressLevel === level;
            const colors = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };
            return (
              <Pressable
                key={level}
                style={[styles.selectorBtn, active && { backgroundColor: colors[level], borderColor: colors[level] }]}
                onPress={() => setStressLevel(level)}
              >
                <Text style={[styles.selectorText, active && styles.selectorTextActive]}>{level}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Journal */}
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardLabelBadge}>
            <Ionicons name="journal-outline" size={12} color={Colors.secondary} />
            <Text style={styles.cardLabelText}>Journal Notes</Text>
          </View>
          <Text style={styles.optionalTag}>optional</Text>
        </View>
        <TextInput
          style={styles.notesInput}
          placeholder="Reflections, wins, challenges, thoughts..."
          placeholderTextColor="#3d3760"
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />
      </View>

      {/* Submit */}
      {savedSuccess ? (
        <View style={styles.successBanner}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Entry Saved!</Text>
            <Text style={styles.successSub}>Taking you to your home dashboard...</Text>
          </View>
        </View>
      ) : (
        <Pressable
          disabled={submitting}
          style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#1a1a2e" size="small" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={20} color="#0a0820" />
          )}
          <Text style={styles.submitText}>
            {submitting ? 'Saving to Behavioral Graph...' : 'Save Entry to Behavioral Graph'}
          </Text>
        </Pressable>
      )}
    </View>
  );

  // ─── RIGHT COLUMN ────────────────────────────────────────────
  const RightContent = (
    <View style={styles.col}>

      {/* Wellness Durations */}
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardLabelBadge}>
            <Ionicons name="timer-outline" size={12} color={Colors.secondary} />
            <Text style={styles.cardLabelText}>Wellness Durations</Text>
          </View>
        </View>
        <View style={styles.inputGrid}>
          {[
            { label: 'Sleep', unit: 'hrs', value: sleepHours, set: setSleepHours, icon: 'moon-outline', placeholder: '7.5' },
            { label: 'Exercise', unit: 'min', value: exerciseDuration, set: setExerciseDuration, icon: 'barbell-outline', placeholder: '30' },
            { label: 'Study', unit: 'hrs', value: studyHours, set: setStudyHours, icon: 'book-outline', placeholder: '2.0' },
            { label: 'Work', unit: 'hrs', value: workHours, set: setWorkHours, icon: 'briefcase-outline', placeholder: '6.0' },
          ].map((f) => (
            <View key={f.label} style={styles.inputItem}>
              <View style={styles.inputItemHeader}>
                <Ionicons name={f.icon as any} size={13} color={Colors.textSecondary} />
                <Text style={styles.inputItemLabel}>{f.label} <Text style={styles.inputUnit}>({f.unit})</Text></Text>
              </View>
              <TextInput
                style={styles.inputField}
                keyboardType="numeric"
                value={f.value}
                onChangeText={f.set}
                placeholder={f.placeholder}
                placeholderTextColor="#3d3760"
              />
            </View>
          ))}
        </View>
      </View>

      {/* Context & Activities */}
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardLabelBadge}>
            <Ionicons name="people-outline" size={12} color={Colors.secondary} />
            <Text style={styles.cardLabelText}>Context & Relationships</Text>
          </View>
        </View>
        {[
          { label: 'Social Interaction', placeholder: 'Who did you interact with today?', value: socialInteraction, set: setSocialInteraction, icon: 'person-add-outline' },
          { label: "Today's Target Goal", placeholder: 'e.g. Finish hackathon layout', value: goalTitle, set: setGoalTitle, icon: 'flag-outline' },
          { label: 'Daily Activity', placeholder: 'e.g. Gym Workout, Coding, Cycling', value: activityName, set: setActivityName, icon: 'flash-outline' },
        ].map((f) => (
          <View key={f.label} style={styles.fullInputItem}>
            <View style={styles.inputItemHeader}>
              <Ionicons name={f.icon as any} size={13} color={Colors.textSecondary} />
              <Text style={styles.inputItemLabel}>{f.label}</Text>
            </View>
            <TextInput
              style={styles.inputField}
              value={f.value}
              onChangeText={f.set}
              placeholder={f.placeholder}
              placeholderTextColor="#3d3760"
            />
          </View>
        ))}
      </View>

      {/* Habit Checklist */}
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardLabelBadge}>
            <Ionicons name="checkmark-done-outline" size={12} color={Colors.secondary} />
            <Text style={styles.cardLabelText}>Habit Checklist</Text>
          </View>
        </View>
        <View style={styles.habitsGrid}>
          {[
            { key: 'sleep', val: sleep, set: setSleep, icon: 'bed-outline', title: 'Slept 7+ hours', desc: 'Sufficient rest' },
            { key: 'exercise', val: exercise, set: setExercise, icon: 'barbell-outline', title: 'Exercised today', desc: 'Active body movement' },
            { key: 'meditation', val: meditation, set: setMeditation, icon: 'leaf-outline', title: 'Meditated', desc: 'Mindfulness session' },
            { key: 'deepWork', val: deepWork, set: setDeepWork, icon: 'code-working-outline', title: 'Did deep work', desc: 'Focused output block' },
          ].map((h) => (
            <Pressable
              key={h.key}
              style={[styles.habitCard, h.val && styles.habitCardActive]}
              onPress={() => { h.set(!h.val); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
            >
              <View style={[styles.habitIconWrap, h.val && { backgroundColor: Colors.secondary + '22' }]}>
                <Ionicons name={h.icon as any} size={18} color={h.val ? Colors.secondary : Colors.textSecondary} />
              </View>
              <View style={styles.habitTextWrap}>
                <Text style={[styles.habitTitle, h.val && { color: Colors.secondary }]}>{h.title}</Text>
                <Text style={styles.habitDesc}>{h.desc}</Text>
              </View>
              <View style={[styles.habitCheck, h.val && styles.habitCheckActive]}>
                {h.val && <Ionicons name="checkmark" size={14} color="#0a0820" />}
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      {toast ? (
        <View style={[styles.toast, { backgroundColor: toast.startsWith('❌') ? Colors.danger : Colors.success }]}>
          <Ionicons name={toast.startsWith('❌') ? 'close-circle' : 'checkmark-circle'} size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>How is your day going?</Text>
          <Text style={styles.pageSub}>Log your metrics to power the behavioral graph.</Text>
        </View>

        {isTablet ? (
          <View style={styles.tabletLayout}>
            <View style={styles.leftColumn}>{LeftContent}</View>
            <View style={styles.rightColumn}>{RightContent}</View>
          </View>
        ) : (
          <View style={styles.mobileLayout}>
            {LeftContent}
            {RightContent}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    maxWidth: Platform.OS === 'web' ? 1100 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  pageHeader: { marginBottom: 28 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  pageSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 6 },

  tabletLayout: { flexDirection: 'row', gap: 24, width: '100%', alignItems: 'flex-start' },
  mobileLayout: { flexDirection: 'column', gap: 0 },
  leftColumn: { flex: 1.1 },
  rightColumn: { flex: 1 },
  col: { gap: 20 },

  toast: {
    position: 'absolute', top: 24, left: 24, right: 24,
    borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center',
    zIndex: 99999, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 10,
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13, flex: 1 },

  card: {
    backgroundColor: '#13102a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#221e42',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  cardLabelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.secondary + '18',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.secondary + '35',
  },
  cardLabelText: { fontSize: 11, fontWeight: '700', color: Colors.secondary, textTransform: 'uppercase', letterSpacing: 0.7 },
  optionalTag: { fontSize: 11, color: '#4b5563', fontStyle: 'italic' },

  moodBadge: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1,
  },
  moodBadgeText: { fontSize: 13, fontWeight: '700' },

  dotsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  dot: {
    flex: 1, aspectRatio: 1, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, maxWidth: 40, maxHeight: 40,
  },
  dotText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },

  selectionRow: { flexDirection: 'row', gap: 10 },
  selectorBtn: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5,
    borderColor: '#2e2855', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0e0b20',
  },
  selectorText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  selectorTextActive: { color: '#0a0820', fontWeight: '800' },

  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  inputItem: { width: '47%' },
  fullInputItem: { marginBottom: 14 },
  inputItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  inputItemLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  inputUnit: { color: '#4b5563', fontWeight: '400' },
  inputField: {
    height: 44, backgroundColor: '#0e0b20', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#2e2855', paddingHorizontal: 14,
    color: '#fff', fontSize: 15,
  },

  habitsGrid: { gap: 10 },
  habitCard: {
    backgroundColor: '#0e0b20', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#2e2855', paddingVertical: 14, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  habitCardActive: { borderColor: Colors.secondary + '70', backgroundColor: '#0d1e2a' },
  habitIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#1a1640', justifyContent: 'center', alignItems: 'center',
  },
  habitTextWrap: { flex: 1 },
  habitTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  habitDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  habitCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#2e2855',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1a1640',
  },
  habitCheckActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },

  notesInput: {
    backgroundColor: '#0e0b20', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#2e2855', padding: 14, color: '#fff',
    fontSize: 14, minHeight: 100,
  },

  submitBtn: {
    backgroundColor: Colors.secondary, borderRadius: 16,
    height: 56, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 10,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  submitBtnPressed: { opacity: 0.85 },
  submitBtnDisabled: { backgroundColor: '#4b5563', opacity: 0.5, shadowOpacity: 0 },
  submitText: { color: '#0a0820', fontWeight: '800', fontSize: 16 },
  successBanner: {
    backgroundColor: '#065f46',
    borderRadius: 16, paddingVertical: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: '#10b981',
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  successIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center',
  },
  successTitle: { color: '#fff', fontWeight: '800', fontSize: 17 },
  successSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 },
});
