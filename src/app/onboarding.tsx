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
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { createUser } from '../services/api';
import { Colors, Spacing } from '../constants/theme';
import { UserContext } from './_layout';

const FEATURES = [
  {
    icon: 'happy-outline' as const,
    color: '#06b6d4',
    title: 'Daily Mood Logging',
    desc: 'Track mood, energy, stress, and sleep every day with rich metrics.',
  },
  {
    icon: 'git-network-outline' as const,
    color: '#8b5cf6',
    title: 'Neo4j Behavioral Graph',
    desc: 'Your habits, goals, and activities become connected nodes in a live graph.',
  },
  {
    icon: 'trending-up-outline' as const,
    color: '#10b981',
    title: 'AI-Powered Insights',
    desc: 'OpenAI analyzes your graph to surface patterns and personalized advice.',
  },
  {
    icon: 'ribbon-outline' as const,
    color: '#f59e0b',
    title: 'Wellness Badges',
    desc: 'Earn badges as you build streaks, improve sleep, and hit your goals.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { login } = useContext(UserContext);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [focusedField, setFocusedField] = useState<'name' | 'email' | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    async function checkToast() {
      const showLogout = await AsyncStorage.getItem('@mindgraph_show_logout_toast');
      if (showLogout === 'true') {
        showToast('✅ Account deleted and cache reset successfully.');
        await AsyncStorage.removeItem('@mindgraph_show_logout_toast');
      }
    }
    checkToast();
  }, []);

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
      await AsyncStorage.setItem('@mindgraph_show_welcome_toast', 'true');
      await login(user.userId, name.trim());
    } catch (err) {
      const localId = `local_${Date.now()}`;
      await AsyncStorage.setItem('@mindgraph_show_welcome_toast', 'true');
      await login(localId, name.trim());
    } finally {
      setLoading(false);
    }
  };

  // ─── Left Hero Panel ──────────────────────────────
  const HeroPanel = (
    <View style={styles.heroPanel}>
      {/* Logo */}
      <View style={styles.logoArea}>
        <View style={styles.logoIconWrap}>
          <View style={styles.logoIconInner}>
            <Text style={styles.logoEmoji}>🧠</Text>
          </View>
        </View>
        <Text style={styles.appName}>MindGraph</Text>
        <Text style={styles.tagline}>Track your mind. Understand yourself.</Text>
      </View>

      {/* Feature list */}
      <View style={styles.featureList}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featureRow}>
            <View style={[styles.featureIconWrap, { backgroundColor: f.color + '20', borderColor: f.color + '40' }]}>
              <Ionicons name={f.icon} size={20} color={f.color} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Bottom tag */}
      <View style={styles.hackBadge}>
        <Ionicons name="trophy-outline" size={12} color="#f59e0b" style={{ marginRight: 6 }} />
        <Text style={styles.hackBadgeText}>{"HACKHAZARDS '26 · Human Experience & Productivity"}</Text>
      </View>
    </View>
  );

  // ─── Right Form Panel ─────────────────────────────
  const FormPanel = (
    <View style={styles.formPanel}>
      <Text style={styles.formTitle}>Create your profile</Text>
      <Text style={styles.formSubtitle}>Your data is stored privately in a Neo4j graph database.</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>YOUR NAME</Text>
        <View style={[styles.inputWrap, focusedField === 'name' && styles.inputWrapFocused]}>
          <Ionicons name="person-outline" size={16} color={focusedField === 'name' ? Colors.secondary : '#4b5563'} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="e.g. Sneha"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={(v) => { setName(v); setError(''); }}
            autoCapitalize="words"
            returnKeyType="next"
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>EMAIL ADDRESS</Text>
        <View style={[styles.inputWrap, focusedField === 'email' && styles.inputWrapFocused]}>
          <Ionicons name="mail-outline" size={16} color={focusedField === 'email' ? Colors.secondary : '#4b5563'} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="e.g. sneha@example.com"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleGetStarted}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} style={{ marginRight: 6 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
        onPress={handleGetStarted}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <>
            <Text style={styles.buttonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.background} style={{ marginLeft: 8 }} />
          </>
        )}
      </Pressable>

      <Text style={styles.privacyNote}>
        🔒 No passwords. Your profile is stored locally and optionally synced to Neo4j.
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      {toast ? (
        <View style={[styles.toast, { backgroundColor: toast.startsWith('❌') ? Colors.danger : Colors.success }]}>
          <Ionicons
            name={toast.startsWith('❌') ? 'close-circle' : 'checkmark-circle'}
            size={18} color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.container, isTablet && styles.containerTablet]}
        keyboardShouldPersistTaps="handled"
      >
        {isTablet ? (
          // Desktop: true split-screen
          <View style={styles.splitLayout}>
            <View style={styles.splitLeft}>{HeroPanel}</View>
            <View style={styles.splitRight}>{FormPanel}</View>
          </View>
        ) : (
          // Mobile: stacked
          <View style={styles.mobileLayout}>
            {/* Mobile compact header */}
            <View style={styles.mobileHeader}>
              <View style={styles.logoIconWrapSm}>
                <Text style={styles.logoEmoji}>🧠</Text>
              </View>
              <Text style={styles.appName}>MindGraph</Text>
              <Text style={styles.tagline}>Track your mind. Understand yourself.</Text>
            </View>
            {FormPanel}
            {/* Mobile feature pills */}
            <View style={styles.pillRow}>
              {['Mood Tracking', 'Habit Insights', 'AI Coaching', 'Neo4j Graph'].map((f) => (
                <View key={f} style={styles.pill}>
                  <Text style={styles.pillText}>{f}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.disclaimer}>{"Built for HACKHAZARDS '26 · Theme: Human Experience & Productivity"}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  container: {
    flexGrow: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  containerTablet: {
    minHeight: '100%',
  },

  // ── Desktop Split Layout ──
  splitLayout: {
    flex: 1,
    flexDirection: 'row',
    minHeight: '100%',
  },
  splitLeft: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    padding: 48,
    justifyContent: 'center',
  },
  splitRight: {
    flex: 1,
    padding: 48,
    justifyContent: 'center',
    maxWidth: 560,
  },

  // ── Mobile Layout ──
  mobileLayout: {
    flexDirection: 'column',
    padding: 24,
    gap: 0,
  },
  mobileHeader: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 24,
  },
  logoIconWrapSm: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '20',
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  // ── Hero Panel (left) ──
  heroPanel: {
    gap: 0,
  },
  logoArea: {
    marginBottom: 48,
  },
  logoIconWrap: {
    marginBottom: 20,
  },
  logoIconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + '20',
    borderWidth: 2,
    borderColor: Colors.primary + '50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  logoEmoji: { fontSize: 36 },
  appName: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },

  featureList: {
    gap: 20,
    marginBottom: 48,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  featureText: { flex: 1 },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
  },

  hackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b12',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f59e0b30',
    alignSelf: 'flex-start',
  },
  hackBadgeText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
  },

  // ── Form Panel (right) ──
  formPanel: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 28,
    lineHeight: 20,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    transition: 'border-color 0.2s',
  } as any,
  inputWrapFocused: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.cardSecondary,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    outlineStyle: 'none',
  } as any,

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '12',
    borderWidth: 1,
    borderColor: Colors.danger + '40',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },

  button: {
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 16,
  },
  buttonPressed: { opacity: 0.87 },
  buttonDisabled: { opacity: 0.6, shadowOpacity: 0 },
  buttonText: {
    color: Colors.background,
    fontWeight: '800',
    fontSize: 17,
  },
  privacyNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Mobile pills & footer
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 16,
  },
  pill: {
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
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
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13, flex: 1 },
});
