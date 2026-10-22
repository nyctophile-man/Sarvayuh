// @ts-nocheck
// app/(tabs)/alarm.tsx  –  SARVAYUH Medicine Alarm
// Next-dose hero with live analog clock, today's schedule (Morning/Afternoon/Evening/Night),
// mark taken / missed, per-medicine alarm toggle, add/edit sheet with time + days picker,
// reminders via expo-notifications and saving via AsyncStorage (both optional, loaded safely).
//
// Optional installs for real reminders + saving:
//   npx expo install expo-notifications @react-native-async-storage/async-storage
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
    Animated,
    Modal,
    Platform,
    Pressable,
    StyleSheet as S,
    ScrollView,
    TouchableOpacity as T,
    Text, TextInput,
    View,
} from 'react-native';
import { useI18n } from '@/lib/i18n/context';
import { useTheme } from '@/lib/theme';

// optional libs – the screen works without them (no crash, just no reminders / no saving)
let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch { Notifications = null; }
let Store: any = null;
try { Store = require('@react-native-async-storage/async-storage').default; } catch { Store = null; }

/* ------------------------------------------------------------------ */
/*  Look                                                               */
/* ------------------------------------------------------------------ */
const medicineTypes = (colors) => [
  { k: 'tablet', labelKey: 'alarm.type.tablet', icon: 'medical', color: colors.teal, bg: colors.tealSoft },
  { k: 'syrup', labelKey: 'alarm.type.syrup', icon: 'flask', color: colors.amber, bg: colors.amberSoft },
  { k: 'injection', labelKey: 'alarm.type.injection', icon: 'bandage', color: colors.red, bg: colors.redSoft },
  { k: 'drops', labelKey: 'alarm.type.drops', icon: 'water', color: colors.blue, bg: colors.blueSoft },
];

const DAY_KEYS = [
  'alarm.day.sunday', 'alarm.day.monday', 'alarm.day.tuesday', 'alarm.day.wednesday',
  'alarm.day.thursday', 'alarm.day.friday', 'alarm.day.saturday',
];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const SECTIONS = [
  { k: 'm', titleKey: 'alarm.section.morning', icon: 'sunny-outline', from: 0, to: 720 },
  { k: 'a', titleKey: 'alarm.section.afternoon', icon: 'partly-sunny-outline', from: 720, to: 1020 },
  { k: 'e', titleKey: 'alarm.section.evening', icon: 'cloudy-night-outline', from: 1020, to: 1260 },
  { k: 'n', titleKey: 'alarm.section.night', icon: 'moon-outline', from: 1260, to: 1441 },
];

const SAMPLE = [
  { id: 'm1', name: 'Metformin', dose: '500 mg · after breakfast', type: 'tablet', time: '08:00', days: ALL_DAYS, on: true, nids: [] },
  { id: 'm2', name: 'Vitamin D3', dose: '1 tablet', type: 'tablet', time: '13:30', days: ALL_DAYS, on: true, nids: [] },
  { id: 'm3', name: 'Cough syrup', dose: '10 ml', type: 'syrup', time: '19:00', days: ALL_DAYS, on: true, nids: [] },
  { id: 'm4', name: 'Amlodipine', dose: '5 mg · before sleep', type: 'tablet', time: '22:00', days: ALL_DAYS, on: false, nids: [] },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmt12 = (time, t) => {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${t(h >= 12 ? 'alarm.period.pm' : 'alarm.period.am')}`;
};
const left = (mins, t) => {
  if (mins <= 0) return t('alarm.inNow');
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h ? t('alarm.inHoursMinutes', { h, m }) : t('alarm.inMinutes', { m });
};
const daysLabel = (days, t) => {
  if (days.length === 7) return t('alarm.days.every');
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return t('alarm.days.weekdays');
  return days.slice().sort().map((d) => t(DAY_KEYS[d]).slice(0, 3)).join(', ');
};

/* ------------------------------------------------------------------ */
/*  Reminders (expo-notifications, optional)                           */
/* ------------------------------------------------------------------ */
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  } catch { }
}

async function cancelNotifs(ids) {
  if (!Notifications || !ids?.length) return;
  for (const id of ids) { try { await Notifications.cancelScheduledNotificationAsync(id); } catch { } }
}

async function scheduleNotifs(med, t) {
  if (!Notifications || !med.on) return [];
  try {
    const perm = await Notifications.requestPermissionsAsync();
    if (perm?.status !== 'granted' && !perm?.granted) return [];
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('meds', {
        name: t('alarm.notif.channel'), importance: Notifications.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 300, 200, 300], sound: 'default',
      });
    }
    const [hour, minute] = med.time.split(':').map(Number);
    const WEEKLY = Notifications.SchedulableTriggerInputTypes?.WEEKLY;
    const ids = [];
    for (const d of med.days) {
      const trigger = WEEKLY
        ? { type: WEEKLY, weekday: d + 1, hour, minute, channelId: 'meds' }
        : { weekday: d + 1, hour, minute, repeats: true };
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: t('alarm.notif.title'), body: `${med.name}${med.dose ? ' · ' + med.dose : ''}`, sound: true },
        trigger,
      });
      ids.push(id);
    }
    return ids;
  } catch (e) {
    console.log('schedule error', e);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */
/* Clock hand, hoisted to module scope (defined components inside components recreate on every render) */
const ClockHand = ({ deg, len, w, color, size }) => (
  <View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', transform: [{ rotate: `${deg}deg` }] }}>
    <View style={{ marginTop: size / 2 - len, width: w, height: len, borderRadius: w, backgroundColor: color }} />
  </View>
);

const AnalogClock = ({ now, onPress, colors }) => {
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const hDeg = h * 30 + m * 0.5;
  const mDeg = m * 6;
  const SIZE = 90;
  return (
    <T
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,.4)',
        backgroundColor: 'rgba(255,255,255,.1)',
        shadowColor: colors.teal,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {[0, 3, 6, 9].map((i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: SIZE - 6,
            height: SIZE - 6,
            alignItems: 'center',
            transform: [{ rotate: `${i * 30}deg` }],
          }}
        >
          <View
            style={{
              width: 3,
              height: 7,
              marginTop: 2,
              borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,.8)',
            }}
          />
        </View>
      ))}
      <ClockHand deg={hDeg} len={24} w={4} color={colors.white} size={SIZE} />
      <ClockHand deg={mDeg} len={34} w={2.5} color={colors.teal} size={SIZE} />
      <View
        style={{
          position: 'absolute',
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.teal,
          borderWidth: 2,
          borderColor: colors.white,
        }}
      />
    </T>
  );
};

const Stepper = ({ value, onUp, onDown, styles, colors }) => (
  <View style={styles.stepper}>
    <T onPress={onUp} hitSlop={{ top: 8, bottom: 8, left: 14, right: 14 }}><Ionicons name="chevron-up" size={22} color={colors.teal} /></T>
    <Text style={styles.stepV}>{value}</Text>
    <T onPress={onDown} hitSlop={{ top: 8, bottom: 8, left: 14, right: 14 }}><Ionicons name="chevron-down" size={22} color={colors.teal} /></T>
  </View>
);

/* ------------------------------------------------------------------ */
/*  Screen                                                             */
/* ------------------------------------------------------------------ */
export default function MedicineAlarm() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const TYPES = useMemo(() => medicineTypes(colors), [colors]);
  const typeOf = (k) => TYPES.find((type) => type.k === k) || TYPES[0];
  const DEEP = colors.deepSurface;
  const TEAL = colors.teal;
  const MUTE = colors.mute;
  const GREEN = colors.green;
  const RED = colors.red;
  const [meds, setMeds] = useState(SAMPLE);
  const [taken, setTaken] = useState({});     // { 'YYYY-MM-DD': { medId: true } }
  const [now, setNow] = useState(new Date());
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState(false);

  // form
  const [editId, setEditId] = useState(null);
  const [fName, setFName] = useState('');
  const [fDose, setFDose] = useState('');
  const [fType, setFType] = useState('tablet');
  const [fH, setFH] = useState(8);
  const [fM, setFM] = useState(0);
  const [fPM, setFPM] = useState(false);
  const [fDays, setFDays] = useState(ALL_DAYS);
  const [err, setErr] = useState('');

  // toast
  const [toastMsg, setToastMsg] = useState('');
  const [toastA] = useState(() => new Animated.Value(0));
  const toast = (m) => {
    setToastMsg(m);
    Animated.sequence([
      Animated.timing(toastA, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1700),
      Animated.timing(toastA, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  };

  /* ---- live clock ---- */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  /* ---- load / save ---- */
  useEffect(() => {
    (async () => {
      try {
        if (Store) {
          const raw = await Store.getItem('sarvayuh_meds_v1');
          if (raw) { const d = JSON.parse(raw); if (d.meds) setMeds(d.meds); if (d.taken) setTaken(d.taken); }
        }
      } catch { }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready || !Store) return;
    Store.setItem('sarvayuh_meds_v1', JSON.stringify({ meds, taken })).catch(() => { });
  }, [meds, taken, ready]);

  /* ---- derived ---- */
  const key = dateKey(now);
  const dow = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // derived (plain recompute; cheap enough that useMemo is unnecessary and
  // avoids the React-compiler "existing memoization could not be preserved" error)
  const todays = meds.filter((m) => m.days.includes(dow)).sort((a, b) => toMin(a.time) - toMin(b.time));
  const isTaken = (m) => !!(taken[key] && taken[key][m.id]);
  const statusOf = (m) => (isTaken(m) ? 'taken' : toMin(m.time) < nowMin ? 'missed' : 'upcoming');

  const doneCount = todays.filter(isTaken).length;
  const total = todays.length;
  const pct = total ? doneCount / total : 0;

  const nextToday = todays.find((m) => !isTaken(m) && m.on && toMin(m.time) >= nowMin);
  const nextFuture = (() => {
    if (nextToday) return null;
    for (let d = 1; d <= 7; d++) {
      const day = (dow + d) % 7;
      const list = meds.filter((m) => m.on && m.days.includes(day)).sort((a, b) => toMin(a.time) - toMin(b.time));
      if (list.length) return { med: list[0], dayLabel: d === 1 ? t('alarm.tomorrow') : t(DAY_KEYS[day]) };
    }
    return null;
  })();

  /* ---- actions ---- */
  const toggleTaken = (m) => {
    setTaken((p) => {
      const day = { ...(p[key] || {}) };
      if (day[m.id]) delete day[m.id]; else day[m.id] = true;
      return { ...p, [key]: day };
    });
    if (!isTaken(m)) toast(t('alarm.toast.markedTaken', { name: m.name }));
  };

  const snooze = async (m) => {
    toast(t('alarm.toast.snoozed'));
    if (!Notifications) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: t('alarm.notif.snoozed'), body: `${m.name}${m.dose ? ' · ' + m.dose : ''}`, sound: true },
        trigger: Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL
          ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 600 }
          : { seconds: 600 },
      });
    } catch { }
  };

  const toggleAlarm = async (m) => {
    await cancelNotifs(m.nids);
    const next = { ...m, on: !m.on };
    next.nids = await scheduleNotifs(next, t);
    setMeds((p) => p.map((x) => (x.id === m.id ? next : x)));
    toast(next.on ? t('alarm.toast.alarmOn') : t('alarm.toast.alarmOff'));
  };

  /* ---- sheet ---- */
  const openNew = () => {
    const h24 = (now.getHours() + 1) % 24;
    setEditId(null); setFName(''); setFDose(''); setFType('tablet');
    setFH(h24 % 12 || 12); setFM(0); setFPM(h24 >= 12); setFDays(ALL_DAYS); setErr('');
    setSheet(true);
  };

  const openEdit = (m) => {
    const [h, mi] = m.time.split(':').map(Number);
    setEditId(m.id); setFName(m.name); setFDose(m.dose || ''); setFType(m.type);
    setFH(h % 12 || 12); setFM(mi); setFPM(h >= 12); setFDays(m.days); setErr('');
    setSheet(true);
  };

  const toggleDay = (d) => setFDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  const save = async () => {
    try {
      if (!fName.trim()) { setErr(t('alarm.err.name')); return; }
      if (!fDays.length) { setErr(t('alarm.err.days')); return; }
      const h24 = (fH % 12) + (fPM ? 12 : 0);
      const old = meds.find((x) => x.id === editId);
      const med = {
        id: editId || `m${Date.now()}`,
        name: fName.trim(), dose: fDose.trim(), type: fType,
        time: `${pad(h24)}:${pad(fM)}`, days: fDays.slice().sort(), on: old ? old.on : true, nids: [],
      };
      if (old) await cancelNotifs(old.nids);
      med.nids = await scheduleNotifs(med, t);
      setMeds((p) => (old ? p.map((x) => (x.id === med.id ? med : x)) : [...p, med]));
      setSheet(false);
      toast(old ? t('alarm.toast.updated') : t('alarm.toast.added'));
    } catch (err2) {
      console.log('save error', err2);
      setErr(t('alarm.err.save', { message: err2 && err2.message ? err2.message : String(err2) }));
    }
  };

  const remove = async () => {
    const old = meds.find((x) => x.id === editId);
    if (old) await cancelNotifs(old.nids);
    setMeds((p) => p.filter((x) => x.id !== editId));
    setSheet(false);
    toast(t('alarm.toast.deleted'));
  };

  /* ---- render ---- */
  const hero = nextToday;

  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={st.header}>
          <View style={{ flex: 1 }}>
            <Text style={st.h1}>{t('alarm.title')}</Text>
            <Text style={st.date}>{now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
          </View>
          <T style={st.addBtn} activeOpacity={0.85} onPress={openNew}>
            <Ionicons name="add" size={18} color={colors.onBrand} />
            <Text style={st.addT}>{t('alarm.add')}</Text>
          </T>
        </View>

        {/* Hero */}
        <View style={st.hero}>
          <View pointerEvents="none" style={st.blobA} />
          <View pointerEvents="none" style={st.blobB} />

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={st.heroTag}>{hero ? t('alarm.nextDose') : total && doneCount === total ? t('alarm.allDone') : t('alarm.nextDose')}</Text>
              {hero ? (
                <>
                  <Text style={st.heroTime}>{fmt12(hero.time, t)}</Text>
                  <Text style={st.heroName} numberOfLines={1}>{hero.name}</Text>
                  <Text style={st.heroDose} numberOfLines={1}>{hero.dose || t(typeOf(hero.type).labelKey)}</Text>
                </>
              ) : nextFuture ? (
                <>
                  <Text style={st.heroTime}>{fmt12(nextFuture.med.time, t)}</Text>
                  <Text style={st.heroName} numberOfLines={1}>{nextFuture.dayLabel} · {nextFuture.med.name}</Text>
                  <Text style={st.heroDose}>{t('alarm.noMoreToday')}</Text>
                </>
              ) : (
                <>
                  <Text style={[st.heroTime, { fontSize: 30 }]}>{t('alarm.noAlarms')}</Text>
                  <Text style={st.heroDose}>{t('alarm.noAlarmsSub')}</Text>
                </>
              )}
            </View>
            <AnalogClock now={now} onPress={hero ? () => openEdit(hero) : openNew} colors={colors} />
          </View>

          {hero && (
            <>
              <View style={st.countPill}>
                <Ionicons name="time-outline" size={14} color={colors.onDeep} />
                <Text style={st.countT}>{left(toMin(hero.time) - nowMin, t)}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 14 }}>
                <T style={[st.heroBtn, { backgroundColor: colors.surface, flex: 1.3, marginRight: 10 }]} activeOpacity={0.88} onPress={() => toggleTaken(hero)}>
                  <Ionicons name="checkmark-circle" size={18} color={DEEP} />
                  <Text style={[st.heroBtnT, { color: DEEP }]}>{t('alarm.takeNow')}</Text>
                </T>
                <T style={[st.heroBtn, { backgroundColor: 'rgba(255,255,255,.16)', flex: 1 }]} activeOpacity={0.88} onPress={() => snooze(hero)}>
                  <Ionicons name="alarm-outline" size={18} color={colors.onDeep} />
                  <Text style={[st.heroBtnT, { color: colors.onDeep }]}>{t('alarm.snooze')}</Text>
                </T>
              </View>
            </>
          )}
        </View>

        {/* Progress */}
        <View style={st.prog}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={st.progT}>{t('alarm.progress')}</Text>
            <Text style={st.progN}>{t('alarm.takenCount', { done: doneCount, total })}</Text>
          </View>
          <View style={st.bar}><View style={[st.barFill, { width: `${Math.round(pct * 100)}%` }]} /></View>
        </View>

        {/* Schedule */}
        <View style={{ paddingHorizontal: 20, marginTop: 6 }}>
          {todays.length === 0 ? (
            <View style={st.empty}>
              <Ionicons name="alarm-outline" size={46} color={MUTE} />
              <Text style={st.emptyT}>{t('alarm.empty')}</Text>
              <T style={[st.addBtn, { marginTop: 14 }]} onPress={openNew}><Text style={st.addT}>{t('alarm.addMedicine')}</Text></T>
            </View>
          ) : (
            SECTIONS.map((sec) => {
              const list = todays.filter((m) => toMin(m.time) >= sec.from && toMin(m.time) < sec.to);
              if (!list.length) return null;
              return (
                <View key={sec.k} style={{ marginTop: 14 }}>
                  <View style={st.secHead}>
                    <Ionicons name={sec.icon} size={16} color={MUTE} />
                    <Text style={st.secT}>{t(sec.titleKey)}</Text>
                  </View>
                  {list.map((m) => {
                    const ty = typeOf(m.type); const status = statusOf(m);
                    return (
                      <T key={m.id} activeOpacity={0.9} onPress={() => openEdit(m)} style={[st.row, status === 'taken' && { opacity: 0.72 }]}>
                        <View style={st.timeCol}>
                          <Text style={st.timeT}>{fmt12(m.time, t).split(' ')[0]}</Text>
                          <Text style={st.timeAP}>{fmt12(m.time, t).split(' ')[1]}</Text>
                        </View>
                        <View style={[st.icBox, { backgroundColor: ty.bg }]}>
                          <Ionicons name={ty.icon} size={20} color={ty.color} />
                        </View>
                        <View style={{ flex: 1, marginHorizontal: 12 }}>
                          <Text style={[st.rName, status === 'taken' && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{m.name}</Text>
                          <Text style={st.rDose} numberOfLines={1}>{m.dose || t(ty.labelKey)}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <View style={[st.chip, status === 'taken' ? { backgroundColor: colors.greenSoft } : status === 'missed' ? { backgroundColor: colors.redSoft } : { backgroundColor: colors.tealSoft }]}>
                              <Text style={[st.chipT, { color: status === 'taken' ? GREEN : status === 'missed' ? RED : TEAL }]}>
                                {status === 'taken' ? t('alarm.status.taken') : status === 'missed' ? t('alarm.status.missed') : t('alarm.status.upcoming')}
                              </Text>
                            </View>
                            <T onPress={() => toggleAlarm(m)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name={m.on ? 'notifications' : 'notifications-off-outline'} size={15} color={m.on ? TEAL : MUTE} />
                              <Text style={[st.alarmT, { color: m.on ? TEAL : MUTE }]}>{m.on ? t('alarm.alarmOn') : t('alarm.alarmOff')}</Text>
                            </T>
                          </View>
                        </View>
                        <T onPress={() => toggleTaken(m)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={[st.check, status === 'taken' && { backgroundColor: GREEN, borderColor: GREEN }]}>
                          {status === 'taken' && <Ionicons name="checkmark" size={18} color={colors.onBrand} />}
                        </T>
                      </T>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ---------------- Add / Edit sheet ---------------- */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={st.backdrop} onPress={() => setSheet(false)} />
        <View style={st.sheet}>
          <View style={st.handle} />
          <View style={st.sheetHead}>
            <Text style={st.sheetTitle}>{editId ? t('alarm.editTitle') : t('alarm.newTitle')}</Text>
            <T onPress={() => setSheet(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={MUTE} />
            </T>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
            <Text style={st.lbl}>{t('alarm.lbl.name')}</Text>
            <TextInput value={fName} onChangeText={(v) => { setFName(v); setErr(''); }} placeholder={t('alarm.namePlaceholder')} placeholderTextColor={MUTE} style={st.input} />

            <Text style={st.lbl}>{t('alarm.lbl.dose')}</Text>
            <TextInput value={fDose} onChangeText={setFDose} placeholder={t('alarm.dosePlaceholder')} placeholderTextColor={MUTE} style={st.input} />

            <Text style={st.lbl}>{t('alarm.lbl.type')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {TYPES.map((x) => (
                <T key={x.k} onPress={() => setFType(x.k)} style={[st.typeChip, fType === x.k && { backgroundColor: DEEP, borderColor: DEEP }]}>
                  <Ionicons name={x.icon} size={15} color={fType === x.k ? colors.onDeep : x.color} />
                  <Text style={[st.typeT, fType === x.k && { color: colors.onDeep }]}>  {t(x.labelKey)}</Text>
                </T>
              ))}
            </View>

            <Text style={st.lbl}>{t('alarm.lbl.time')}</Text>
            <View style={st.timeBox}>
              <Stepper value={pad(fH)} onUp={() => setFH((h) => (h % 12) + 1)} onDown={() => setFH((h) => (h === 1 ? 12 : h - 1))} styles={st} colors={colors} />
              <Text style={st.colon}>:</Text>
              <Stepper value={pad(fM)} onUp={() => setFM((m) => (m + 5) % 60)} onDown={() => setFM((m) => (m - 5 + 60) % 60)} styles={st} colors={colors} />
              <View style={st.apBox}>
                {['AM', 'PM'].map((ap) => {
                  const on = (ap === 'PM') === fPM;
                  return (
                    <T key={ap} onPress={() => setFPM(ap === 'PM')} style={[st.apBtn, on && { backgroundColor: DEEP }]}>
                      <Text style={[st.apT, on && { color: colors.onDeep }]}>{ap}</Text>
                    </T>
                  );
                })}
              </View>
            </View>

            <Text style={st.lbl}>{t('alarm.lbl.repeat', { days: daysLabel(fDays, t).toUpperCase() })}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {ALL_DAYS.map((i) => {
                const on = fDays.includes(i);
                const short = t(DAY_KEYS[i]).slice(0, 3);
                return (
                  <T key={i} onPress={() => toggleDay(i)} style={[st.dayDot, on && { backgroundColor: TEAL, borderColor: TEAL }]}>
                    <Text style={[st.dayT, on && { color: colors.onBrand }]}>{short}</Text>
                  </T>
                );
              })}
            </View>

            {!!err && <Text style={st.errT}>{err}</Text>}

            <T style={st.primary} activeOpacity={0.88} onPress={save}>
              <Text style={st.primaryT}>{editId ? t('alarm.saveChanges') : t('alarm.addMedicine')}</Text>
            </T>
            {!!editId && (
              <T style={st.delBtn} activeOpacity={0.85} onPress={remove}>
                <Ionicons name="trash-outline" size={16} color={RED} />
                <Text style={st.delT}>{t('alarm.deleteMedicine')}</Text>
              </T>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Toast */}
      <Animated.View pointerEvents="none" style={[st.toast, { opacity: toastA, transform: [{ translateY: toastA.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
        <Text style={st.toastT}>{toastMsg}</Text>
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const makeStyles = (c) => S.create({
  screen: { flex: 1, backgroundColor: c.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 46, paddingBottom: 14 },
  h1: { fontSize: 24, fontWeight: '800', color: c.deep },
  date: { color: c.mute, fontSize: 13, marginTop: 2, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.teal, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  addT: { color: c.onBrand, fontWeight: '800', fontSize: 13, marginLeft: 2 },

  hero: { marginHorizontal: 20, backgroundColor: c.deepSurface, borderRadius: 26, padding: 20, overflow: 'hidden', shadowColor: c.deepSurface, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  blobA: { position: 'absolute', right: -50, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,.07)' },
  blobB: { position: 'absolute', left: -40, bottom: -80, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,.05)' },
  heroTag: { color: '#8FB8BE', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 },
  heroTime: { color: c.onDeep, fontSize: 38, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },
  heroName: { color: c.onDeep, fontSize: 17, fontWeight: '800', marginTop: 2 },
  heroDose: { color: c.onDeepSoft, fontSize: 12.5, marginTop: 2, fontWeight: '600' },
  countPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.16)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 14 },
  countT: { color: '#fff', fontWeight: '800', fontSize: 12.5, marginLeft: 6 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 14 },
  heroBtnT: { fontWeight: '800', fontSize: 14, marginLeft: 6 },

  prog: { marginHorizontal: 20, marginTop: 16, backgroundColor: c.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: c.line },
  progT: { color: c.ink, fontWeight: '800', fontSize: 14 },
  progN: { color: c.teal, fontWeight: '800', fontSize: 13 },
  bar: { height: 9, borderRadius: 5, backgroundColor: c.line, marginTop: 12, overflow: 'hidden' },
  barFill: { height: 9, borderRadius: 5, backgroundColor: c.green },

  secHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  secT: { color: c.mute, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginLeft: 6, textTransform: 'uppercase' },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 18, padding: 12, marginBottom: 10, shadowColor: c.deepSurface, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  timeCol: { width: 50, alignItems: 'center', marginRight: 8 },
  timeT: { color: c.ink, fontWeight: '800', fontSize: 15 },
  timeAP: { color: c.mute, fontWeight: '700', fontSize: 10.5, marginTop: 1 },
  icBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rName: { color: c.ink, fontWeight: '800', fontSize: 15 },
  rDose: { color: c.mute, fontSize: 12, marginTop: 1 },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  chipT: { fontSize: 10.5, fontWeight: '800' },
  alarmT: { fontSize: 11, fontWeight: '700' },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyT: { color: c.mute, fontSize: 14.5, fontWeight: '700', marginTop: 10 },

  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingBottom: 28, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle: { color: c.deep, fontSize: 19, fontWeight: '800' },
  lbl: { color: c.mute, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, height: 48, color: c.ink, fontSize: 15, backgroundColor: c.surfaceAlt },

  typeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, marginBottom: 8 },
  typeT: { color: c.ink, fontWeight: '700', fontSize: 13 },

  timeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.tealSoft, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingVertical: 10 },
  stepper: { alignItems: 'center', width: 64 },
  stepV: { color: c.deep, fontSize: 38, fontWeight: '800', marginVertical: 2 },
  colon: { color: c.deep, fontSize: 34, fontWeight: '800', marginHorizontal: 4 },
  apBox: { marginLeft: 14, borderRadius: 12, borderWidth: 1, borderColor: c.line, overflow: 'hidden', backgroundColor: c.surface },
  apBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  apT: { color: c.ink, fontWeight: '800', fontSize: 13 },

  dayDot: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
  dayT: { color: c.ink, fontWeight: '800', fontSize: 13 },

  errT: { color: c.red, fontSize: 12.5, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  primary: { backgroundColor: c.teal, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryT: { color: c.onBrand, fontWeight: '800', fontSize: 15 },
  delBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, marginTop: 8 },
  delT: { color: c.red, fontWeight: '800', fontSize: 14 },

  toast: { position: 'absolute', left: 24, right: 24, bottom: 110, backgroundColor: c.deepSurface, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  toastT: { color: c.onDeep, fontWeight: '700', fontSize: 13.5 },
});
