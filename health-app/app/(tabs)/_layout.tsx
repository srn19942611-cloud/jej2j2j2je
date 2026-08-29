import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vægt',
          tabBarIcon: ({ color, size }) => <Ionicons name="scale-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="graph"
        options={{
          title: 'Udvikling',
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-down-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="goal"
        options={{
          title: 'Mål',
          tabBarIcon: ({ color, size }) => <Ionicons name="flag-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
