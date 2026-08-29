import { useEffect } from 'react';
import { Link, Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, type ColorValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '../../src/theme';

/** Ikonet hopper en anelse, når fanen bliver valgt. */
function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  size: number;
  focused: boolean;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, { damping: 12, stiffness: 260 });
  }, [focused, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Ionicons name={name} size={size} color={color as string} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 20 },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 62,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'I dag',
          tabBarIcon: (p) => <TabIcon name="today-outline" {...p} />,
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
                <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="weight"
        options={{
          title: 'Vægt',
          tabBarIcon: (p) => <TabIcon name="trending-down-outline" {...p} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Træning',
          tabBarIcon: (p) => <TabIcon name="barbell-outline" {...p} />,
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Mad',
          tabBarIcon: (p) => <TabIcon name="restaurant-outline" {...p} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: (p) => <TabIcon name="chatbubbles-outline" {...p} />,
        }}
      />
    </Tabs>
  );
}
