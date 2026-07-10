import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, LogBox, Platform, StyleSheet, useWindowDimensions, Text, Pressable } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { createContext } from 'react';
import { Colors } from '../constants/theme';

export const UserContext = createContext<{
  userId: string | null;
  userName: string;
  login: (id: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  userId: null,
  userName: '',
  login: async () => {},
  logout: async () => {},
});

// Suppress known third-party library styling/event warnings on Web (e.g. react-native-chart-kit SVG handlers)
LogBox.ignoreLogs([
  'Unknown event handler property `onPressIn`',
  'Unknown event handler property `onPressOut`',
  'Unknown event handler property `onPressIn`',
  'Unknown event handler property `onPressOut`',
  'Unknown event handler property `Unknown event handler property`',
]);

if (Platform.OS === 'web') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const fullMessage = args.map(a => String(a)).join(' ');
    if (
      fullMessage.includes('onPressIn') ||
      fullMessage.includes('onPressOut') ||
      fullMessage.includes('Unknown event handler property')
    ) {
      return;
    }
    originalError(...args);
  };
}

function TabLayoutContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const showSidebar = isTablet && pathname !== '/onboarding';

  const navItems = [
    { name: 'Home', path: '/', icon: 'home', iconOutline: 'home-outline' },
    { name: 'Log', path: '/log', icon: 'add-circle', iconOutline: 'add-circle-outline' },
    { name: 'Insights', path: '/insights', icon: 'bar-chart', iconOutline: 'bar-chart-outline' },
    { name: 'Graph', path: '/graph', icon: 'share-social', iconOutline: 'share-social-outline' },
    { name: 'Profile', path: '/profile', icon: 'person', iconOutline: 'person-outline' },
  ];

  useEffect(() => {
    async function checkUser() {
      try {
        if (Platform.OS === 'web') {
          // Reset session on new tab/window open to ensure onboarding is shown first
          if (!sessionStorage.getItem('@mindgraph_session_active')) {
            await AsyncStorage.removeItem('@mindgraph_userId');
            await AsyncStorage.removeItem('@mindgraph_userName');
            sessionStorage.setItem('@mindgraph_session_active', 'true');
          }
        }
        const storedId = await AsyncStorage.getItem('@mindgraph_userId');
        const storedName = await AsyncStorage.getItem('@mindgraph_userName');
        setUserId(storedId);
        setUserName(storedName || '');
      } catch (e) {
        console.error('AsyncStorage error:', e);
      } finally {
        setIsLoading(false);
      }
    }
    checkUser();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!userId && pathname !== '/onboarding') {
        router.replace('/onboarding');
      } else if (userId && pathname === '/onboarding') {
        router.replace('/');
      }
    }
  }, [userId, isLoading, pathname]);

  const login = async (newUserId: string, newName: string) => {
    await AsyncStorage.setItem('@mindgraph_userId', newUserId);
    await AsyncStorage.setItem('@mindgraph_userName', newName);
    setUserId(newUserId);
    setUserName(newName);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('@mindgraph_userId');
    await AsyncStorage.removeItem('@mindgraph_userName');
    setUserId(null);
    setUserName('');
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator color={Colors.secondary} size="large" />
      </View>
    );
  }

  return (
    <UserContext.Provider value={{ userId, userName, login, logout }}>
      <View style={{ flex: 1, flexDirection: showSidebar ? 'row' : 'column', backgroundColor: Colors.background }}>
        <StatusBar style="light" />
        
        {showSidebar && (
          <View style={styles.sidebar}>
            <View>
              {/* Logo area */}
              <View style={styles.logoContainer}>
                <View style={styles.logoIcon}>
                  <Text style={styles.logoEmoji}>🧠</Text>
                </View>
                <Text style={styles.logoText}>MindGraph</Text>
              </View>

              {/* Menu items */}
              <View style={styles.menuContainer}>
                {navItems.map((item) => {
                  const isActive = pathname === item.path || (item.path === '/' && pathname === '/index');
                  return (
                    <Pressable
                      key={item.name}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                        router.push(item.path as any);
                      }}
                      style={({ pressed }) => [
                        styles.sidebarItem,
                        isActive && styles.sidebarItemActive,
                        pressed && { opacity: 0.85 }
                      ]}
                    >
                      {isActive && <View style={styles.activeIndicator} />}
                      <Ionicons
                        name={(isActive ? item.icon : item.iconOutline) as any}
                        size={20}
                        color={isActive ? Colors.secondary : '#8b8b9e'}
                        style={styles.sidebarIcon}
                      />
                      <Text style={[
                        styles.sidebarText,
                        isActive && styles.sidebarTextActive
                      ]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Profile block */}
            {userName ? (
              <View style={styles.profileContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.profileTextContainer}>
                  <Text style={styles.profileName} numberOfLines={1}>{userName}</Text>
                  <Text style={styles.profileStatus} numberOfLines={1}>Active Profile</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        <View style={{ flex: 1, position: 'relative' }}>
          <Tabs
            screenOptions={{
              headerShown: Platform.OS === 'web' ? false : !isTablet,
              tabBarActiveTintColor: Colors.secondary,
              tabBarInactiveTintColor: '#6b7280',
              tabBarStyle: {
                backgroundColor: Colors.card,
                borderTopColor: Colors.border,
                borderTopWidth: 1,
                height: isTablet ? 0 : 72 + insets.bottom,
                display: isTablet ? 'none' : 'flex',
                paddingBottom: insets.bottom > 0 ? insets.bottom + 6 : 8,
                paddingTop: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              },
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
                marginBottom: 2,
              },
              headerStyle: {
                backgroundColor: Colors.background,
                borderBottomColor: Colors.border,
                borderBottomWidth: 1,
              },
              headerTitleStyle: {
                color: Colors.text,
                fontWeight: 'bold',
                fontSize: 18,
              },
              headerTitleAlign: 'center',
              headerShadowVisible: false,
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: 'MindGraph',
                tabBarLabel: 'Home',
                tabBarIcon: ({ color, focused }) => (
                  <Ionicons size={22} name={focused ? 'home' : 'home-outline'} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="log"
              options={{
                title: 'Log Entry',
                tabBarLabel: 'Log',
                tabBarIcon: ({ color, focused }) => (
                  <Ionicons size={22} name={focused ? 'add-circle' : 'add-circle-outline'} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="insights"
              options={{
                title: 'Insights',
                tabBarLabel: 'Insights',
                tabBarIcon: ({ color, focused }) => (
                  <Ionicons size={22} name={focused ? 'bar-chart' : 'bar-chart-outline'} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="graph"
              options={{
                title: 'Behavioral Graph',
                tabBarLabel: 'Graph',
                tabBarIcon: ({ color, focused }) => (
                  <Ionicons size={22} name={focused ? 'share-social' : 'share-social-outline'} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: 'My Profile',
                tabBarLabel: 'Profile',
                tabBarIcon: ({ color, focused }) => (
                  <Ionicons size={22} name={focused ? 'person' : 'person-outline'} color={color} />
                ),
              }}
            />
            {/* Hide onboarding from tab bar */}
            <Tabs.Screen
              name="onboarding"
              options={{
                href: null,
                tabBarStyle: { display: 'none' },
                headerShown: false,
              }}
            />
          </Tabs>
        </View>
      </View>
    </UserContext.Provider>
  );
}

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <TabLayoutContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: Colors.card,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 32,
    gap: 12,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  logoEmoji: {
    fontSize: 18,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  menuContainer: {
    gap: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    position: 'relative',
    height: 48,
  },
  sidebarItemActive: {
    backgroundColor: Colors.secondary + '14',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.secondary,
  },
  sidebarIcon: {
    marginRight: 14,
  },
  sidebarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8b8b9e',
  },
  sidebarTextActive: {
    color: Colors.secondary,
    fontWeight: '700',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.background,
  },
  profileTextContainer: {
    flex: 1,
  },
  profileName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  profileStatus: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
});
