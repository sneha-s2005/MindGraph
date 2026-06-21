import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUser } from '../services/api';
import { Colors, Spacing } from '../constants/theme';
import { UserContext } from './_layout';

export default function OnboardingScreen() {
  const router = useRouter();
  const { login } = useContext(UserContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGetStarted = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and email.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await createUser(name.trim(), email.trim().toLowerCase());
      await login(user.userId, name.trim());
    } catch (err) {
      // Backend unavailable — create a local-only userId so the app still works
      const localId = `local_${Date.now()}`;
      await login(localId, name.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>🧠</Text>
          </View>
          <Text style={styles.appName}>MindGraph</Text>
          <Text style={styles.tagline}>Track your mind. Understand yourself.</Text>
        </View>

        {/* Feature pills */}
        <View style={styles.pillRow}>
          {['Mood Tracking', 'Habit Insights', 'AI Coaching', 'Neo4j Graph'].map((f) => (
            <View key={f} style={styles.pill}>
              <Text style={styles.pillText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create your profile</Text>
          <Text style={styles.cardSubtitle}>Your data is stored privately in a graph database.</Text>

          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sneha"
            placeholderTextColor="#6b7280"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. sneha@example.com"
            placeholderTextColor="#6b7280"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleGetStarted}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
            onPress={handleGetStarted}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1a1a2e" />
            ) : (
              <Text style={styles.buttonText}>Get Started →</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          Built for HACKHAZARDS {'\'26'} · Theme: Human Experience & Productivity
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    padding: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7c3aed20',
    borderWidth: 2,
    borderColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  logoEmoji: {
    fontSize: 38,
  },
  appName: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  pill: {
    backgroundColor: '#7c3aed15',
    borderWidth: 1,
    borderColor: '#7c3aed40',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: {
    color: '#8b5cf6',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#1f1a3a',
    borderRadius: 20,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2a2456',
    marginBottom: Spacing.three,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: Spacing.three,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#252147',
    borderWidth: 1,
    borderColor: '#2a2456',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 15,
    marginBottom: Spacing.two,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: Spacing.two,
  },
  button: {
    backgroundColor: '#14b8a6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#1a1a2e',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disclaimer: {
    fontSize: 11,
    color: '#4b5563',
    textAlign: 'center',
  },
});
