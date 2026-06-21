import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, LogBox, Platform } from 'react-native';
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

  useEffect(() => {
    async function checkUser() {
      try {
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
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <StatusBar style="light" />
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: Colors.secondary,
            tabBarInactiveTintColor: '#6b7280',
            tabBarStyle: {
              backgroundColor: '#1f1a3a',
              borderTopColor: '#2a2456',
              borderTopWidth: 1,
              height: 60 + insets.bottom,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
              paddingTop: 6,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
            headerStyle: {
              backgroundColor: Colors.background,
              borderBottomColor: '#2a2456',
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
