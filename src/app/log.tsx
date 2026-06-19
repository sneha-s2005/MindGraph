import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, ScrollView,
  Pressable, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
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

export default function LogScreen() {
  const router = useRouter();
  const [mood, setMood] = useState(7);
  const [energy, setEnergy] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [sleep, setSleep] = useState(false);
  const [exercise, setExercise] = useState(false);
  const [meditation, setMeditation] = useState(false);
  const [deepWork, setDeepWork] = useState(false);
  const [notes, setNotes] = useState('');

  // New Upgraded Fields
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

  useEffect(() => {
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
        // prefill expanded properties
        setSleepHours(String(today.sleepHours ?? '7.0'));
        setExerciseDuration(String(today.exerciseDuration ?? '0'));
        setStudyHours(String(today.studyHours ?? '0'));
        setWorkHours(String(today.workHours ?? '0'));
        setSocialInteraction(today.socialInteraction || '');
        setStressLevel(today.stressLevel || 'Medium');
        setGoalTitle(today.goalTitle || '');
        setActivityName(today.activityName || '');
      }
    }
    prefill();
  }, []);

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
        date: today,
        mood,
        energy,
        sleepHours: parseFloat(sleepHours) || 0,
        exerciseDuration: parseFloat(exerciseDuration) || 0,
        studyHours: parseFloat(studyHours) || 0,
        workHours: parseFloat(workHours) || 0,
        socialInteraction: socialInteraction.trim(),
        stressLevel,
        goalTitle: goalTitle.trim(),
        activityName: activityName.trim(),
        habits,
        notes: notes.trim(),
      };

      // 1. Save locally first (always works)
      await saveEntry(payload);

      // 2. Sync to backend (best-effort)
      if (userId) {
        try {
          await logMood({
            userId,
            userName,
            score: mood,
            energyLevel: energy,
            sleepHours: parseFloat(sleepHours) || 0,
            exerciseDuration: parseFloat(exerciseDuration) || 0,
            studyHours: parseFloat(studyHours) || 0,
            workHours: parseFloat(workHours) || 0,
            socialInteraction: socialInteraction.trim(),
            stressLevel,
            goalTitle: goalTitle.trim(),
            activityName: activityName.trim(),
            notes: notes.trim(),
            habits,
          });
        } catch {
          // Backend offline — local save is sufficient
        }
      }

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('✅ Entry saved to database!');
      setTimeout(() => router.push('/'), 1200);
    } catch (err) {
      showToast('❌ Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>How is your day going?</Text>
        <Text style={styles.headerSub}>Log your metrics to power the behavioral graph.</Text>

        {toast ? (
          <View style={[styles.toast, { backgroundColor: toast.startsWith('✅') ? Colors.success : Colors.danger }]}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        {/* SECTION 1: Mood & Energy */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>Mood Score</Text>
            <Text style={styles.moodDisplay}>
              {MOOD_EMOJIS[mood]} {mood}/10 — {MOOD_LABELS[mood]}
            </Text>
          </View>
          <View style={styles.sliderRow}>
            <View style={styles.sliderTrack} />
            <View style={styles.dotsRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => {
                const selected = step === mood;
                return (
                  <Pressable
                    key={step}
                    style={[styles.dot, { backgroundColor: selected ? Colors.secondary : '#2a2456' }]}
                    onPress={() => {
                      setMood(step);
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                    }}
                  >
                    <Text style={[styles.dotText, selected && styles.dotTextSelected]}>{step}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* SECTION 2: Energy & Stress */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Energy Level</Text>
          <View style={styles.selectionRow}>
            {(['Low', 'Medium', 'High'] as const).map((level) => {
              const active = energy === level;
              const activeBg = level === 'Low' ? '#ef4444' : level === 'High' ? Colors.secondary : Colors.primary;
              return (
                <Pressable
                  key={level}
                  style={[styles.selectorBtn, active && { backgroundColor: activeBg, borderColor: activeBg }]}
                  onPress={() => setEnergy(level)}
                >
                  <Text style={[styles.selectorText, active && styles.selectorTextActive]}>{level}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.cardLabel, { marginTop: Spacing.two }]}>Stress Level</Text>
          <View style={styles.selectionRow}>
            {(['Low', 'Medium', 'High'] as const).map((level) => {
              const active = stressLevel === level;
              const activeBg = level === 'High' ? '#ef4444' : level === 'Low' ? '#10b981' : '#f59e0b';
              return (
                <Pressable
                  key={level}
                  style={[styles.selectorBtn, active && { backgroundColor: activeBg, borderColor: activeBg }]}
                  onPress={() => setStressLevel(level)}
                >
                  <Text style={[styles.selectorText, active && styles.selectorTextActive]}>{level}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* SECTION 3: Wellness Durations */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Wellness Durations</Text>
          
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Sleep (Hours)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={sleepHours}
                onChangeText={setSleepHours}
                placeholder="e.g. 7.5"
                placeholderTextColor="#6b7280"
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Exercise (Mins)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={exerciseDuration}
                onChangeText={setExerciseDuration}
                placeholder="e.g. 30"
                placeholderTextColor="#6b7280"
              />
            </View>
          </View>

          <View style={[styles.inputRow, { marginTop: Spacing.two }]}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Study (Hours)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={studyHours}
                onChangeText={setStudyHours}
                placeholder="e.g. 2.0"
                placeholderTextColor="#6b7280"
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Work (Hours)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={workHours}
                onChangeText={setWorkHours}
                placeholder="e.g. 6.0"
                placeholderTextColor="#6b7280"
              />
            </View>
          </View>
        </View>

        {/* SECTION 4: Context & Activities */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Context & Relationships</Text>
          
          <Text style={styles.inputLabel}>Social Interaction (Person Name)</Text>
          <TextInput
            style={styles.fullInput}
            value={socialInteraction}
            onChangeText={setSocialInteraction}
            placeholder="Who did you interact with today?"
            placeholderTextColor="#6b7280"
          />

          <Text style={[styles.inputLabel, { marginTop: Spacing.two }]}>Today's Target Goal</Text>
          <TextInput
            style={styles.fullInput}
            value={goalTitle}
            onChangeText={setGoalTitle}
            placeholder="e.g. Finish hackathon layout"
            placeholderTextColor="#6b7280"
          />

          <Text style={[styles.inputLabel, { marginTop: Spacing.two }]}>Daily Activity Description</Text>
          <TextInput
            style={styles.fullInput}
            value={activityName}
            onChangeText={setActivityName}
            placeholder="e.g. Gym Workout, Coding, Cycling"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* SECTION 5: Habits Grid */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Habit Checklist</Text>
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
                onPress={() => {
                  h.set(!h.val);
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                }}
              >
                <Ionicons
                  name={h.icon as any}
                  size={20}
                  color={h.val ? Colors.secondary : Colors.textSecondary}
                />
                <View style={styles.habitTextWrap}>
                  <Text style={[styles.habitTitle, h.val && { color: Colors.secondary }]}>{h.title}</Text>
                  <Text style={styles.habitDesc}>{h.desc}</Text>
                </View>
                {h.val && <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />}
              </Pressable>
            ))}
          </View>
        </View>

        {/* SECTION 6: Journal Notes */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Journal Notes <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Reflections, wins, challenges, thoughts..."
            placeholderTextColor="#4b5563"
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <Pressable
          disabled={submitting}
          style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#1a1a2e" size="small" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={18} color="#1a1a2e" />
          )}
          <Text style={styles.submitText}>
            {submitting ? 'Connecting and Syncing...' : "Save Entry to Behavioral Graph"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: {
    padding: Spacing.three,
    maxWidth: Platform.OS === 'web' ? 580 : '100%',
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 40,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.text, marginTop: Spacing.two },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.three },
  toast: {
    borderRadius: 12, padding: 12, marginBottom: Spacing.two,
    flexDirection: 'row', alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },
  card: {
    backgroundColor: '#1f1a3a', borderRadius: 16, padding: Spacing.three,
    borderWidth: 1, borderColor: '#2a2456', marginBottom: Spacing.three,
  },
  cardHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  cardLabel: {
    fontSize: 10, fontWeight: 'bold', color: Colors.secondary,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  optional: { fontWeight: 'normal', textTransform: 'none', color: '#4b5563' },
  moodDisplay: { fontSize: 14, fontWeight: '700', color: Colors.secondary },
  sliderRow: { position: 'relative', paddingVertical: 6 },
  sliderTrack: {
    position: 'absolute', left: 0, right: 0, height: 4,
    backgroundColor: '#2a2456', borderRadius: 2, top: '50%',
  },
  dotsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  dotText: { fontSize: 10, fontWeight: 'bold', color: '#6b7280' },
  dotTextSelected: { color: '#1a1a2e' },
  
  selectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10,
  },
  selectorBtn: {
    flex: 1, height: 38, borderRadius: 10, borderWidth: 1,
    borderColor: '#3e3870', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#231e42',
  },
  selectorText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  selectorTextActive: { color: '#1a1a2e', fontWeight: 'bold' },

  inputRow: {
    flexDirection: 'row', gap: 16, marginTop: 10,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12, color: Colors.textSecondary, marginBottom: 6, fontWeight: '500',
  },
  textInput: {
    height: 40, backgroundColor: '#2a2456', borderRadius: 10,
    borderWidth: 1, borderColor: '#3e3870', paddingHorizontal: 12,
    color: '#fff', fontSize: 14,
  },
  fullInput: {
    height: 40, backgroundColor: '#2a2456', borderRadius: 10,
    borderWidth: 1, borderColor: '#3e3870', paddingHorizontal: 12,
    color: '#fff', fontSize: 14, marginTop: 6,
  },
  
  habitsGrid: {
    gap: 10, marginTop: 10,
  },
  habitCard: {
    backgroundColor: '#231e42', borderRadius: 12, borderWidth: 1,
    borderColor: '#3e3870', padding: 12, flexDirection: 'row',
    alignItems: 'center', gap: 12,
  },
  habitCardActive: {
    borderColor: Colors.secondary, backgroundColor: '#2d1e54',
  },
  habitTextWrap: { flex: 1 },
  habitTitle: { fontSize: 13, fontWeight: 'bold', color: Colors.text },
  habitDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  
  notesInput: {
    backgroundColor: '#2a2456', borderRadius: 10, borderWidth: 1,
    borderColor: '#3e3870', padding: 12, color: '#fff',
    fontSize: 14, minHeight: 80, marginTop: 10,
  },
  
  submitBtn: {
    backgroundColor: Colors.secondary, borderRadius: 14,
    height: 48, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 8, marginTop: Spacing.two,
  },
  submitBtnPressed: { opacity: 0.8 },
  submitBtnDisabled: { backgroundColor: '#4b5563', opacity: 0.5 },
  submitText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 15 },
});
