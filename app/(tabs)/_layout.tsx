// @ts-nocheck
/* eslint-disable react/react-in-jsx-scope, import/no-unresolved -- Ionicons resolves at runtime via the Expo SDK */
// app/(tabs)/_layout.tsx  –  SARVAYUH tab layout
// Custom tab bar: Home / Records / Ask AI (floating center FAB with pulse) / Alarm / Profile.
// MedCard stays as a route but is hidden from the bar (reachable from Home).
import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n/context';
import { useTheme } from '@/lib/theme';

const BAR_H = 64;     // visible bar
const FAB = 68;       // floating button size
const RISE = 30;      // how far the button sticks out above the bar

/* Tabs: matched by route name, shown in this exact order */
const TABS = [
  { match: /^(index|home)/i, labelKey: 'tabs.home', icon: 'home' },
  { match: /record/i, labelKey: 'tabs.records', icon: 'document-text' },
  { match: /^(ai|ask|chat|assist|bot|sparkle)/i, labelKey: 'tabs.ai', icon: 'sparkles', center: true },
  { match: /alarm|medicine|medication|reminder|clock/i, labelKey: 'tabs.alarm', icon: 'alarm' },
  { match: /profile|account/i, labelKey: 'tabs.profile', icon: 'person' },
  // old MedCard screen: kept as a route, but no longer shown in the bar
  { match: /med.?card/i, labelKey: 'tabs.medcard', icon: 'id-card', hidden: true },
];

/* One normal tab */
function TabItem({ cfg, label, focused, onPress, onLongPress, styles, colors }) {
  const [a] = useState(() => new Animated.Value(focused ? 1 : 0));

  useEffect(() => {
    Animated.spring(a, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 7, tension: 120 }).start();
  }, [focused, a]);

  const pill = {
    opacity: a,
    transform: [{ scaleX: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
  };
  const lift = { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View style={lift}>
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.pill, pill]} />
          <Ionicons name={focused ? cfg.icon : `${cfg.icon}-outline`} size={23} color={focused ? colors.teal : colors.mute} />
        </View>
      </Animated.View>
      <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/* Floating center button */
function CenterFab({ cfg, label, focused, onPress, styles, colors }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const pulseS = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const pulseO = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View pointerEvents="box-none" style={styles.fabLayer}>
      <Animated.View pointerEvents="none" style={[styles.pulse, { opacity: pulseO, transform: [{ scale: pulseS }] }]} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.fab, focused && { backgroundColor: colors.teal }, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Ionicons name="sparkles" size={28} color={colors.onBrand} />
      </Pressable>
    </View>
  );
}

/* The bar */
function AppTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const bottom = Math.max(insets.bottom, 8);

  const items = state.routes
    .map((route, i) => {
      const opts = descriptors[route.key]?.options || {};
      const cfg = TABS.find((t) => t.match.test(route.name)) ||
        { labelKey: null, icon: 'ellipse' };
      const label = cfg.labelKey ? t(cfg.labelKey) : (opts.title || route.name);
      return { route, i, cfg, opts, label };
    })
    .filter((x) => x.opts.href !== null && !x.cfg.hidden)
    .sort((a, b) => {
      const ia = TABS.indexOf(a.cfg); const ib = TABS.indexOf(b.cfg);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  const go = (route, focused) => {
    // `navigation` can be undefined with a custom tabBar; guard the optional
    // tabPress event and do the real navigation via the global router.
    navigation?.emit?.({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused) router.navigate(`/(tabs)/${route.name}`);
  };

  // find the center (Ask AI) tab while building the render list
  const centerItem = items.find((x) => x.cfg.center) || null;

  return (
    <View pointerEvents="box-none" style={[s.outer, { height: BAR_H + RISE + bottom }]}>
      <View style={[s.bar, { height: BAR_H + bottom, paddingBottom: bottom }]}>
        {items.map((x) => {
          const focused = state.index === x.i;
          if (x.cfg.center) {
            return (
              <View key={x.route.key} style={s.centerSlot}>
                <Text style={[s.label, focused && s.labelOn]} numberOfLines={1}>{x.label}</Text>
              </View>
            );
          }
          return (
            <TabItem
              key={x.route.key}
              cfg={x.cfg}
              label={x.label}
              focused={focused}
              onPress={() => go(x.route, focused)}
              onLongPress={() => navigation?.emit?.({ type: 'tabLongPress', target: x.route.key })}
              styles={s}
              colors={colors}
            />
          );
        })}
      </View>

      {centerItem && (
        <CenterFab cfg={centerItem.cfg} label={centerItem.label} focused={state.index === centerItem.i} onPress={() => go(centerItem.route, state.index === centerItem.i)} styles={s} colors={colors} />
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {/* Every route must be declared in the layout or the navigator renders nothing */}
      <Tabs.Screen name="home" />
      <Tabs.Screen name="records" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="alarm" />
      <Tabs.Screen name="profile" />
      {/* MedCard has no button in the custom tab bar (see the `hidden: true` entry in TABS).
          Do NOT use `options={{ href: null }}` here: in SDK 58 a hidden tab that becomes
          focused immediately redirects back to the initial tab, so "Open →" and the card
          itself would silently bounce back to Home instead of opening the MEDCARD screen. */}
      <Tabs.Screen name="medcard" />
    </Tabs>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  outer: { backgroundColor: 'transparent' },

  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingTop: 8,
    shadowColor: colors.deepSurface, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },

  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  iconWrap: { width: 56, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', width: 56, height: 32, borderRadius: 16, backgroundColor: colors.tealSoft },
  label: { fontSize: 11, fontWeight: '600', color: colors.mute, marginTop: 3, letterSpacing: 0.2 },
  labelOn: { color: colors.deep, fontWeight: '800' },

  centerSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },

  fabLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: FAB, alignItems: 'center' },
  pulse: { position: 'absolute', top: 0, width: FAB, height: FAB, borderRadius: FAB / 2, backgroundColor: colors.teal },
  fab: {
    width: FAB, height: FAB, borderRadius: FAB / 2,
    backgroundColor: colors.deepSurface,
    borderWidth: 5, borderColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.deepSurface, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
});
