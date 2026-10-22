import { MedCard } from '@/components/MedCard';
import { getMedcard, getProfile } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';
import { useTheme } from '@/lib/theme';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, PanResponder, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Colors = ReturnType<typeof useTheme>['colors'];
type Detail = { label: string; value?: string | null };

const PEEK = 32;     // closed hone par card ke upar jitna tab dikhta hai
const PANEL_H = 200; // open hone par card kitna neeche jaata hai

/* ---------- swipe-down reveal (no flip, no tilt) ---------- */
function SwipeRevealCard({
  children, details, hintClosed, hintOpen, onDragChange, colors,
}: {
  children: ReactNode;
  details: Detail[];
  hintClosed: string;
  hintOpen: string;
  onDragChange?: (dragging: boolean) => void;
  colors: Colors;
}) {
  const st = useMemo(() => makeRevealStyles(colors), [colors]);
  const p = useRef(new Animated.Value(0)).current; // 0 = closed, 1 = open
  const base = useRef(0);
  const [open, setOpen] = useState(false);
  const [cardH, setCardH] = useState(200);
  const range = PANEL_H - PEEK;

  const snap = (to: 0 | 1, velocity = 0) => {
    base.current = to;
    setOpen(to === 1);
    Animated.spring(p, {
      toValue: to,
      velocity,
      useNativeDriver: false, // height bhi animate ho raha hai, isliye JS driver
      damping: 18,
      stiffness: 170,
      mass: 0.8,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => { p.stopAnimation((v) => { base.current = v; }); onDragChange?.(true); },
      onPanResponderMove: (_, g) => {
        const next = base.current + g.dy / range;
        // thoda rubber-band feel edges par
        const eased = next < 0 ? next * 0.25 : next > 1 ? 1 + (next - 1) * 0.25 : next;
        p.setValue(eased);
      },
      onPanResponderRelease: (_, g) => {
        onDragChange?.(false);
        const cur = base.current + g.dy / range;
        const to = g.vy > 0.4 ? 1 : g.vy < -0.4 ? 0 : cur > 0.5 ? 1 : 0;
        snap(to, g.vy / 3);
      },
      onPanResponderTerminate: () => { onDragChange?.(false); snap(base.current > 0.5 ? 1 : 0); },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const cardY = p.interpolate({ inputRange: [0, 1], outputRange: [PEEK, PANEL_H] });
  const boxH = p.interpolate({ inputRange: [0, 1], outputRange: [PEEK + cardH, PANEL_H + cardH] });
  const gridOpacity = p.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] });
  const chevronRot = p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <Animated.View style={{ height: boxH }} {...pan.panHandlers}>
      {/* piche wala details panel */}
      <View style={st.panel}>
        <Pressable onPress={() => snap(open ? 0 : 1)} style={st.tab} hitSlop={12}>
          <Animated.Text style={[st.chevron, { transform: [{ rotate: chevronRot }] }]}>⌃</Animated.Text>
          <Text style={st.hint}>{open ? hintOpen : hintClosed}</Text>
        </Pressable>
        <Animated.View style={[st.grid, { opacity: gridOpacity }]}>
          {details.map((d) => (
            <View key={d.label} style={st.cell}>
              <Text style={st.label}>{d.label}</Text>
              <Text style={st.value} numberOfLines={1}>{d.value || '—'}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* card: sirf neeche slide hota hai */}
      <Animated.View
        style={[st.card, { transform: [{ translateY: cardY }] }]}
        onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

/* ---------- screen ---------- */
export default function MedCardTab() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const st = makeStyles(colors);

  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return !v || v === key ? fallback : v;
  };

  useEffect(() => {
    let active = true;
    Promise.all([getProfile(), getMedcard()])
      .then(([profile, card]) => {
        if (!active) return;
        setUser({
          ...profile,
          ...card,
          name: card.name || profile.name,
          cardId: card.card_id,
          blood: card.blood || profile.blood,
          dob: profile.dob,
          gender: profile.gender,
          phone: profile.phone,
          allergies: profile.allergies,
          conditions: profile.conditions,
          emergencyName: profile.emergency_name,
          emergencyPhone: profile.emergency_phone,
          photo: profile.photo,
        });
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : '');
      });
    return () => { active = false; };
  }, []);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={st.stateBox}>
            <Text style={st.stateTitle}>{t('medcard.errTitle')}</Text>
            <Text style={st.stateMessage}>{error || t('medcard.errLoad')}</Text>
          </View>
        ) : user ? (
          <SwipeRevealCard
            colors={colors}
            onDragChange={setDragging}
            hintClosed={tr('medcard.swipeDown', 'Swipe down for details')}
            hintOpen={tr('medcard.swipeUp', 'Swipe up to hide')}
            details={[
              { label: 'Card ID', value: user.cardId },
              { label: 'Blood', value: user.blood },
              { label: 'DOB', value: user.dob },
              { label: 'Allergies', value: user.allergies },
              { label: 'Conditions', value: user.conditions },
              { label: 'Emergency', value: user.emergencyPhone },
            ]}
          >
            <MedCard user={user} />
          </SwipeRevealCard>
        ) : (
          <View style={st.loading}>
            <ActivityIndicator color={colors.teal} />
            <Text style={st.stateMessage}>{t('medcard.loading')}</Text>
          </View>
        )}

        {!!user && <Text style={st.hint}>{t('medcard.hint')}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- styles ---------- */
const makeRevealStyles = (c: Colors) => StyleSheet.create({
  panel: {
    position: 'absolute', top: 0, left: 10, right: 10, height: PANEL_H + 30,
    backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.line,
    paddingHorizontal: 18,
  },
  tab: { height: PEEK, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  chevron: { color: c.mute, fontSize: 14, marginTop: 4 },
  hint: { color: c.mute, fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  cell: { width: '50%', paddingVertical: 9, paddingRight: 8 },
  label: { color: c.mute, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  value: { color: c.deep, fontSize: 14, fontWeight: '700', marginTop: 2 },
  card: {
    position: 'absolute', top: 0, left: 0, right: 0,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});

const makeStyles = (colors: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 34 },
  loading: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateBox: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.line },
  stateTitle: { color: colors.deep, fontSize: 16, fontWeight: '700' },
  stateMessage: { color: colors.inkSoft, fontSize: 13, marginTop: 8 },
  hint: { color: colors.mute, textAlign: 'center', fontSize: 12, marginTop: 18 },
});