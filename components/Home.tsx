// @ts-nocheck
// app/(tabs)/home.tsx  –  SARVAYUH Home Dashboard (live data from backend)
import { MedCard } from '@/components/MedCard';
import { getMedcard, getProfile, getRecords, sendFeedback } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';
import { useTheme } from '@/lib/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet,
  TouchableOpacity as T, Text,
  TextInput,
  View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

type Rec = { id: string; title: string; category: string; created_at: string };
type Tile = { labelKey: string; icon: string; bg: string; iconBg: string; to: string };
type Feature = { key: 'sos' | 'hospital' | 'family' | 'feedback'; titleKey: string; descKey: string; ctaKey: string; icon: string; bg: string };

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */
const TILES: Tile[] = [
  { labelKey: 'home.tile.upload', icon: '⬆️', bg: '#E3F3F1', iconBg: '#0E7C86', to: '/(tabs)/records' },
  { labelKey: 'home.tile.emergency', icon: '🚑', bg: '#FCE7E5', iconBg: '#E5575A', to: '/modal' },
  { labelKey: 'home.tile.share', icon: '🔗', bg: '#E4EEF3', iconBg: '#4A7C93', to: '/(tabs)/records' },
];

const FEATURES: Feature[] = [
  { key: 'sos', titleKey: 'home.feature.sos.title', descKey: 'home.feature.sos.desc', ctaKey: 'home.feature.sos.cta', icon: '🚨', bg: '#FBDAD8' },
  { key: 'hospital', titleKey: 'home.feature.hospital.title', descKey: 'home.feature.hospital.desc', ctaKey: 'home.feature.hospital.cta', icon: '🏥', bg: '#DCE9F7' },
  { key: 'family', titleKey: 'home.feature.family.title', descKey: 'home.feature.family.desc', ctaKey: 'home.feature.family.cta', icon: '👨‍👩‍👧', bg: '#E3DEF0' },
  { key: 'feedback', titleKey: 'home.feature.feedback.title', descKey: 'home.feature.feedback.desc', ctaKey: 'home.feature.feedback.cta', icon: '💬', bg: '#DDEBD6' },
];

const RECORD_ICONS: Record<string, string> = { 'Lab Reports': '🧪', Prescriptions: '💊', Imaging: '🩻', Others: '📄' };

const CARD_GAP = 12;
const SIDE_PAD = 16;
const PEEK = 28;
const AUTO_MS = 3500;

const AMBULANCE_NUMBER = '108'; // India ambulance. National emergency number is 112.
const SOS_SECONDS = 5;
const FAMILY_KEY = 'sarvayuh_family_v1';
const FEEDBACK_QUEUE_KEY = 'sarvayuh_feedback_queue_v1';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const RELATIONS = ['spouse', 'father', 'mother', 'son', 'daughter', 'brother', 'sister', 'other'];

// Guards against a request that never settles: without it a single hanging
// call keeps the whole home screen on the loading spinner.
const REQUEST_TIMEOUT_MS = 12000;
const withTimeout = <T,>(promise: Promise<T>, ms: number = REQUEST_TIMEOUT_MS): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const greeting = (t: (k: string) => string) => {
  const h = new Date().getHours();
  return h < 12 ? t('home.greeting.morning') : h < 17 ? t('home.greeting.afternoon') : t('home.greeting.evening');
};

// "1998-03-14" or "14 / 03 / 1998" -> "14 Mar 1998"
const fmtDob = (v?: string, t?: (k: string) => string, locale = 'en-GB') => {
  const empty = t ? t('common.notAdded') : 'Not added';
  if (!v) return empty;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(v)
    ? v.slice(0, 10)
    : (() => {
        const d = v.replace(/\D/g, '');
        return d.length === 8 ? `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}` : '';
      })();
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime())
    ? empty
    : dt.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
};

const joinList = (v: any, t?: (k: string) => string) => {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  const clean = arr.map((x) => String(x).trim()).filter(Boolean);
  return clean.length ? clean.join(', ') : t ? t('common.notAdded') : 'Not added';
};

const calcAge = (v?: string) => {
  const dt = new Date(v || '');
  if (Number.isNaN(dt.getTime())) return '';
  const now = new Date();
  let a = now.getFullYear() - dt.getFullYear();
  if (now < new Date(now.getFullYear(), dt.getMonth(), dt.getDate())) a--;
  return a >= 0 ? String(a) : '';
};

// DD / MM / YYYY input mask
const maskDob = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)} / ${d.slice(2)}`;
  return d;
};
const dobToISO = (v: string) => {
  const d = v.replace(/\D/g, '');
  if (d.length !== 8) return null;
  const dd = +d.slice(0, 2), mm = +d.slice(2, 4), yy = +d.slice(4);
  const dt = new Date(yy, mm - 1, dd);
  const ok = dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd && dt <= new Date() && yy >= 1900;
  return ok ? `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}` : null;
};

const SectionHead = ({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) => {
  const { colors } = useTheme();
  const s = useMemo(() => makeHomeStyles(colors), [colors]);
  return (
    <View style={s.secHead}>
      <Text style={s.secT}>{title}</Text>
      {!!action && (
        <T onPress={onPress} accessibilityLabel={action} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.viewAll}>{action}</Text>
        </T>
      )}
    </View>
  );
};

// Bottom sheet wrapper used by every feature
const Sheet = ({ visible, title, onClose, full, children }: any) => {
  const { colors } = useTheme();
  const m = useMemo(() => makeModalStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.backdrop}>
        <T style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[m.sheet, full ? { height: '92%' } : { maxHeight: '88%' }]}
        >
          <View style={m.handle} />
          <View style={m.head}>
            <Text style={m.headT}>{title}</Text>
            <T onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={m.close}>✕</Text>
            </T>
          </View>
          {children}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/*  1. SOS – ambulance call                                            */
/* ------------------------------------------------------------------ */
const SosModal = ({ visible, onClose, contactName, contactPhone }: any) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const C = colors;
  const m = useMemo(() => makeModalStyles(colors), [colors]);
  const [count, setCount] = useState(SOS_SECONDS);
  const [coords, setCoords] = useState<any>(null);
  const [locStatus, setLocStatus] = useState<'getting' | 'off' | 'ready' | 'failed'>('getting');
  const dialed = useRef(false);

  const dial = useCallback(() => {
    if (dialed.current) return;
    dialed.current = true;
    Linking.openURL(`tel:${AMBULANCE_NUMBER}`).catch(() =>
      Alert.alert(t('home.sos.callFailed'), t('home.sos.callFailedBody', { number: AMBULANCE_NUMBER }))
    );
    setTimeout(onClose, 600);
  }, [onClose, t]);

  // Reset + start location fetch when the modal opens. Intentional sync setState:
  // state must be clean before the new countdown/location fetch begins.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) return;
    dialed.current = false;
    setCount(SOS_SECONDS);
    setCoords(null);
    setLocStatus('getting');
    let alive = true;

    (async () => {
      try {
        const p = await Location.requestForegroundPermissionsAsync();
        if (!p.granted) { if (alive) setLocStatus('off'); return; }
        const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (alive) { setCoords(l.coords); setLocStatus('ready'); }
      } catch {
        if (alive) setLocStatus('failed');
      }
    })();

    const id = setInterval(() => setCount((c) => Math.max(0, c - 1)), 1000);
    return () => { alive = false; clearInterval(id); };
  }, [visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (visible && count <= 0) dial();
  }, [count, visible, dial]);

  const sendLocation = () => {
    const link = coords ? `https://maps.google.com/?q=${coords.latitude},${coords.longitude}` : '';
    const body = t('home.sos.smsBody', {
      location: link ? t('home.sos.smsLocation', { link }) : t('home.sos.smsNoLocation'),
    });
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${contactPhone || ''}${sep}body=${encodeURIComponent(body)}`).catch(() =>
      Alert.alert(t('home.sos.msgFailed'))
    );
  };

  return (
    <Sheet visible={visible} title={t('home.sos.title')} onClose={onClose}>
      <View style={{ padding: 22, alignItems: 'center' }}>
        <View style={m.sosRing}>
          <Text style={m.sosNum}>{count}</Text>
        </View>
        <Text style={m.sosTitle}>{t('home.sos.calling', { number: AMBULANCE_NUMBER, count })}</Text>
        <Text style={m.sosSub}>{t('home.sos.cancelHint')}</Text>
        <Text style={m.sosLoc}>📍 {t(`home.sos.location${locStatus.charAt(0).toUpperCase()}${locStatus.slice(1)}`)}</Text>

        <T style={[m.btn, { backgroundColor: '#E5484D', marginTop: 18 }]} onPress={dial} activeOpacity={0.85}>
          <Text style={m.btnT}>{t('home.sos.callNow')}</Text>
        </T>
        <T style={[m.btn, m.btnGhost, { marginTop: 10 }]} onPress={sendLocation} activeOpacity={0.85}>
          <Text style={[m.btnT, { color: C.deep }]}>
            {t('home.sos.sendLocation', { contact: contactPhone ? contactName || t('home.sos.sendLocationContact') : t('home.sos.sendLocationContact') })}
          </Text>
        </T>
        <T style={{ marginTop: 16 }} onPress={onClose}>
          <Text style={{ color: C.mute, fontWeight: '700', fontSize: 15 }}>{t('common.cancel')}</Text>
        </T>
      </View>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ */
/*  2. Nearest hospitals – Google Map inside the app                   */
/* ------------------------------------------------------------------ */
const PLACE_TYPES = [
  { key: 'hospitals', q: 'hospitals' },
  { key: 'emergency', q: 'emergency room' },
  { key: 'pharmacy', q: 'pharmacy' },
  { key: 'clinics', q: 'clinics' },
];

const HospitalModal = ({ visible, onClose }: any) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const C = colors;
  const m = useMemo(() => makeModalStyles(colors), [colors]);
  const [coords, setCoords] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'nolocation'>('loading');
  const [type, setType] = useState(PLACE_TYPES[0]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setStatus('loading');
    setType(PLACE_TYPES[0]);
    (async () => {
      try {
        const p = await Location.requestForegroundPermissionsAsync();
        if (!p.granted) { if (alive) setStatus('nolocation'); return; }
        const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (alive) { setCoords(l.coords); setStatus('ready'); }
      } catch {
        if (alive) setStatus('nolocation');
      }
    })();
    return () => { alive = false; };
  }, [visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const near = coords ? `${coords.latitude},${coords.longitude}` : '';
  const embed = `https://maps.google.com/maps?q=${encodeURIComponent(type.q)}+near+${near}&z=14&output=embed`;
  const openApp = () => {
    const url = coords
      ? `https://www.google.com/maps/search/${encodeURIComponent(type.q)}/@${coords.latitude},${coords.longitude},14z`
      : `https://www.google.com/maps/search/${encodeURIComponent(type.q)}+near+me`;
    Linking.openURL(url).catch(() => Alert.alert(t('home.hospital.mapsFailed')));
  };

  return (
    <Sheet visible={visible} title={t('home.hospital.title')} onClose={onClose} full>
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {PLACE_TYPES.map((x) => (
            <T key={x.q} onPress={() => setType(x)} style={[m.chip, type.q === x.q && m.chipOn]} activeOpacity={0.85}>
              <Text style={[m.chipT, type.q === x.q && { color: '#fff' }]}>{t(`home.hospital.type.${x.key}`)}</Text>
            </T>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {status === 'loading' && (
          <View style={m.center}>
            <ActivityIndicator size="large" color={C.deep} />
            <Text style={m.centerT}>{t('home.hospital.finding')}</Text>
          </View>
        )}
        {status === 'nolocation' && (
          <View style={m.center}>
            <Text style={{ fontSize: 40 }}>📍</Text>
            <Text style={m.centerH}>{t('home.hospital.off')}</Text>
            <Text style={m.centerT}>{t('home.hospital.offBody')}</Text>
            <T style={[m.btn, { marginTop: 14 }]} onPress={openApp}><Text style={m.btnT}>{t('home.hospital.searchMaps')}</Text></T>
            <T style={{ marginTop: 12 }} onPress={() => Linking.openSettings()}><Text style={{ color: C.teal, fontWeight: '700' }}>{t('home.hospital.openSettings')}</Text></T>
          </View>
        )}
        {status === 'ready' && (
          <WebView
            key={type.q}
            source={{ uri: embed }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
            originWhitelist={['*']}
            startInLoadingState
            renderLoading={() => (
              <View style={[m.center, StyleSheet.absoluteFill, { backgroundColor: '#fff' }]}>
                <ActivityIndicator size="large" color={C.deep} />
              </View>
            )}
          />
        )}
      </View>

      {status === 'ready' && (
        <View style={{ padding: 14 }}>
          <T style={m.btn} onPress={openApp} activeOpacity={0.85}>
            <Text style={m.btnT}>{t('home.hospital.directions')}</Text>
          </T>
        </View>
      )}
    </Sheet>
  );
};

/* ------------------------------------------------------------------ */
/*  3. Family management                                               */
/* ------------------------------------------------------------------ */
const FamilyModal = ({ visible, onClose }: any) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const C = colors;
  const m = useMemo(() => makeModalStyles(colors), [colors]);
  const [list, setList] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [rel, setRel] = useState('');
  const [dob, setDob] = useState('');
  const [blood, setBlood] = useState('');
  const [err, setErr] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) return;
    setAdding(false);
    AsyncStorage.getItem(FAMILY_KEY).then((v) => setList(v ? JSON.parse(v) : [])).catch(() => {});
  }, [visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = async (next: any[]) => {
    setList(next);
    try { await AsyncStorage.setItem(FAMILY_KEY, JSON.stringify(next)); } catch {}
  };

  const reset = () => { setName(''); setRel(''); setDob(''); setBlood(''); setErr(''); };

  const save = async () => {
    if (!name.trim()) return setErr(t('home.family.errName'));
    if (!rel) return setErr(t('home.family.errRelation'));
    let iso = '';
    if (dob.trim()) {
      const x = dobToISO(dob);
      if (!x) return setErr(t('home.family.errDob'));
      iso = x;
    }
    await persist([...list, { id: String(Date.now()), name: name.trim(), relation: rel, dob: iso, blood }]);
    reset();
    setAdding(false);
  };

  const remove = (mem: any) =>
    Alert.alert(t('home.family.removeTitle'), t('home.family.removeBody', { name: mem.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('home.family.remove'), style: 'destructive', onPress: () => persist(list.filter((x) => x.id !== mem.id)) },
    ]);

  return (
    <Sheet visible={visible} title={adding ? t('home.family.addTitle') : t('home.family.title')} onClose={onClose} full>
      <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!adding ? (
          <>
            {list.length === 0 ? (
              <View style={m.emptyBox}>
                <Text style={{ fontSize: 40 }}>👨‍👩‍👧</Text>
                <Text style={m.centerH}>{t('home.family.empty')}</Text>
                <Text style={m.centerT}>{t('home.family.emptySub')}</Text>
              </View>
            ) : (
              list.map((f) => {
                const age = calcAge(f.dob);
                return (
                  <View key={f.id} style={m.member}>
                    <View style={m.memAvatar}><Text style={m.memAvatarT}>{f.name.charAt(0).toUpperCase()}</Text></View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={m.memName}>{f.name}</Text>
                      <Text style={m.memMeta}>
                        {[
                          t(`home.relation.${f.relation}`),
                          age ? t('home.family.years', { n: age }) : '',
                          f.blood ? t('home.family.bloodLabel', { group: f.blood }) : '',
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <T onPress={() => remove(f)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={{ fontSize: 18 }}>🗑️</Text>
                    </T>
                  </View>
                );
              })
            )}
            <T style={[m.btn, { marginTop: 12 }]} onPress={() => { reset(); setAdding(true); }} activeOpacity={0.85}>
              <Text style={m.btnT}>{t('home.family.add')}</Text>
            </T>
            <Text style={m.note}>{t('home.family.note')}</Text>
          </>
        ) : (
          <>
            {!!err && <View style={m.errBox}><Text style={m.errT}>⚠️  {err}</Text></View>}

            <Text style={m.label}>{t('home.family.name')}</Text>
            <TextInput style={m.input} placeholder={t('home.family.namePlaceholder')} placeholderTextColor={C.mute} value={name} onChangeText={setName} autoCapitalize="words" />

            <Text style={m.label}>{t('home.family.relation')}</Text>
            <View style={m.wrap}>
              {RELATIONS.map((r) => (
                <T key={r} onPress={() => setRel(r)} style={[m.chip, rel === r && m.chipOn]} activeOpacity={0.85}>
                  <Text style={[m.chipT, rel === r && { color: '#fff' }]}>{t(`home.relation.${r}`)}</Text>
                </T>
              ))}
            </View>

            <Text style={m.label}>{t('home.family.dob')}</Text>
            <TextInput style={m.input} placeholder="DD / MM / YYYY" placeholderTextColor={C.mute} value={dob}
              onChangeText={(v) => setDob(maskDob(v))} keyboardType="number-pad" maxLength={14} />

            <Text style={m.label}>{t('home.family.blood')}</Text>
            <View style={m.wrap}>
              {BLOOD.map((b) => (
                <T key={b} onPress={() => setBlood(blood === b ? '' : b)} style={[m.chipSm, blood === b && m.chipOn]} activeOpacity={0.85}>
                  <Text style={[m.chipT, blood === b && { color: '#fff' }]}>{b}</Text>
                </T>
              ))}
            </View>

            <T style={[m.btn, { marginTop: 14 }]} onPress={save} activeOpacity={0.85}><Text style={m.btnT}>{t('home.family.save')}</Text></T>
            <T style={{ alignSelf: 'center', marginTop: 14 }} onPress={() => setAdding(false)}>
              <Text style={{ color: C.mute, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </T>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ */
/*  4. App feedback                                                    */
/* ------------------------------------------------------------------ */
const FB_TYPES = ['praise', 'bug', 'idea', 'other'];
const STAR_KEYS = ['', 'poor', 'fair', 'good', 'veryGood', 'excellent'];

const FeedbackModal = ({ visible, onClose, email }: any) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const C = colors;
  const m = useMemo(() => makeModalStyles(colors), [colors]);
  const [rating, setRating] = useState(0);
  const [type, setType] = useState('praise');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) { setRating(0); setType('praise'); setMsg(''); setBusy(false); setDone(false); setErr(''); }
  }, [visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const submit = async () => {
    if (!rating) return setErr(t('home.feedback.errRating'));
    setErr('');
    setBusy(true);
    const payload = {
      rating, category: type, message: msg.trim(), email: email || undefined,
      platform: Platform.OS, created_at: new Date().toISOString(),
    };
    try {
      await sendFeedback(payload);
      setDone(true);
    } catch (e) {
      // Server unreachable: keep the feedback on the device instead of losing it
      try {
        const raw = await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY);
        const queued = raw ? JSON.parse(raw) : [];
        queued.push(payload);
        await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(queued));
        setDone(true);
      } catch {
        setErr(e?.message || t('home.feedback.errFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title={t('home.feedback.title')} onClose={onClose}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {done ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text style={{ fontSize: 54 }}>🙏</Text>
            <Text style={m.centerH}>{t('home.feedback.thanks')}</Text>
            <Text style={m.centerT}>{t('home.feedback.thanksSub')}</Text>
            <T style={[m.btn, { marginTop: 18, alignSelf: 'stretch' }]} onPress={onClose}><Text style={m.btnT}>{t('common.done')}</Text></T>
          </View>
        ) : (
          <>
            {!!err && <View style={m.errBox}><Text style={m.errT}>⚠️  {err}</Text></View>}

            <Text style={[m.label, { textAlign: 'center' }]}>{t('home.feedback.experience')}</Text>
            <View style={m.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <T key={n} onPress={() => setRating(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Text style={[m.star, n <= rating ? { opacity: 1 } : { opacity: 0.25 }]}>⭐</Text>
                </T>
              ))}
            </View>
            <Text style={m.starLbl}>{rating ? t(`home.feedback.star.${STAR_KEYS[rating]}`) : ''}</Text>

            <Text style={m.label}>{t('home.feedback.about')}</Text>
            <View style={m.wrap}>
              {FB_TYPES.map((x) => (
                <T key={x} onPress={() => setType(x)} style={[m.chip, type === x && m.chipOn]} activeOpacity={0.85}>
                  <Text style={[m.chipT, type === x && { color: '#fff' }]}>{t(`home.feedback.type.${x}`)}</Text>
                </T>
              ))}
            </View>

            <Text style={m.label}>{t('home.feedback.more')}</Text>
            <TextInput
              style={[m.input, { height: 110, textAlignVertical: 'top', paddingTop: 12 }]}
              placeholder={t('home.feedback.morePlaceholder')}
              placeholderTextColor={C.mute}
              value={msg}
              onChangeText={setMsg}
              multiline
              maxLength={1000}
            />
            <Text style={m.note}>{msg.length}/1000</Text>

            <T style={[m.btn, { marginTop: 8 }, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy} activeOpacity={0.85}>
              <Text style={m.btnT}>{busy ? t('home.feedback.sending') : t('home.feedback.submit')}</Text>
            </T>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ */
/*  Screen                                                             */
/* ------------------------------------------------------------------ */
export default function Home() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const C = colors;
  const s = useMemo(() => makeHomeStyles(colors), [colors]);
  const { top } = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  const [profile, setProfile] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentRecords, setRecentRecords] = useState<Rec[]>([]);
  const [stats, setStats] = useState({ total: 0, fresh: 0 });
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState('');
  const [recentFailed, setRecentFailed] = useState(false);
  const [cardError, setCardError] = useState('');
  const [cardFailed, setCardFailed] = useState(false);
  const [sheet, setSheet] = useState<null | Feature['key']>(null);

  // ---- feature carousel state ----
  const cardW = screenW - SIDE_PAD * 2 - PEEK;
  const step = cardW + CARD_GAP;
  const carouselRef = useRef<ScrollView>(null);
  const idxRef = useRef(0);
  const userDragging = useRef(false);
  const sheetOpen = sheet !== null;
  const [activeIdx, setActiveIdx] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setStatusBarStyle('light');

      // Profile and MEDCARD are loaded independently: one failing request must not
      // discard the other, and a request that never settles must not keep the whole
      // screen on the loading spinner.
      Promise.allSettled([withTimeout(getProfile()), withTimeout(getMedcard())])
        .then(([profileResult, medcardResult]) => {
          if (cancelled) return;
          if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
          if (medcardResult.status === 'fulfilled') setCard(medcardResult.value);
          if (medcardResult.status === 'rejected') {
            setCardFailed(true);
            setCardError(medcardResult.reason?.message || '');
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });

      setRecentLoading(true);
      setRecentError('');
      setRecentFailed(false);
      setCardError('');
      setCardFailed(false);
      getRecords()
        .then((rows) => {
          if (!Array.isArray(rows)) throw new Error('Unexpected records response');
          if (cancelled) return;
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          setStats({
            total: rows.length,
            fresh: rows.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length,
          });
          setRecentRecords(rows.slice(0, 3));
        })
        .catch((error) => {
          if (!cancelled) {
            setRecentRecords([]);
            setStats({ total: 0, fresh: 0 });
            setRecentFailed(true);
            setRecentError(error.message || '');
          }
        })
        .finally(() => { if (!cancelled) setRecentLoading(false); });

      return () => { cancelled = true; setStatusBarStyle('dark'); };
    }, [])
  );

  // Auto-advance the carousel; pauses while touching it or while a sheet is open.
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => {
        if (userDragging.current || sheetOpen) return;
        const next = (idxRef.current + 1) % FEATURES.length;
        carouselRef.current?.scrollTo({ x: next * step, animated: true });
        idxRef.current = next;
        setActiveIdx(next);
      }, AUTO_MS);
      return () => clearInterval(id);
    }, [step, sheetOpen])
  );

  const onCarouselEnd = (e: any) => {
    userDragging.current = false;
    const i = Math.round(e.nativeEvent.contentOffset.x / step);
    idxRef.current = i;
    setActiveIdx(i);
  };

  const userName = profile?.name || t('common.guest');

  // Empty values stay empty here; the MEDCARD component renders the
  // localized "not added" placeholder for them.
  const medUser = {
    name: profile?.name || '',
    cardId: card?.card_id || (cardFailed ? t('common.notAdded') : t('common.loading')),
    gender: profile?.gender || '',
    blood: profile?.blood || '',
    dob: fmtDob(profile?.dob, t, locale),
    age: calcAge(profile?.dob),
    allergies: joinList(profile?.allergies, t),
    conditions: joinList(profile?.conditions, t),
    phone: profile?.phone || '',
    email: profile?.email || '',
    emergencyName: profile?.emergency_name || '',
    emergencyPhone: profile?.emergency_phone || '',
    photo: profile?.photo || null,
  };

  const tiles = TILES.map((x) => ({ ...x, label: t(x.labelKey) }));
  const features = FEATURES.map((x) => ({
    ...x,
    title: t(x.titleKey),
    desc: t(x.descKey),
    cta: t(x.ctaKey),
  }));

  const STATS: [string, string][] = [
    [String(stats.total), t('home.stat.total')],
    [String(stats.fresh), t('home.stat.week')],
    ['100%', t('home.stat.secure')],
  ];

  if (loading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={C.deep} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View pointerEvents="none" style={[s.topFill, { top: -top, height: top }]} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
        {/* ---------- Header (same color as the MEDCARD, no bell) ---------- */}
        <View style={s.header}>
          <View pointerEvents="none" style={s.hBlobA} />
          <View pointerEvents="none" style={s.hBlobB} />
          <View style={s.row}>
            <View style={s.avatar}><Text style={s.avatarT}>{userName.charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.greet}>{greeting(t)} 👋</Text>
              <Text style={s.name} numberOfLines={1}>{userName}</Text>
              <View style={s.idPill}><Text style={s.idPillT}>🪪  {medUser.cardId}</Text></View>
            </View>
          </View>
        </View>

        {/* ---------- Health overview ---------- */}
        <View style={[s.card, s.overview]}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <View style={s.row}>
              <View style={s.ovIcon}><Text style={{ fontSize: 16 }}>📋</Text></View>
              <View style={{ marginLeft: 10 }}>
                <Text style={s.ovTitle}>{t('home.overview.title')}</Text>
                <Text style={s.ovSub}>{t('home.overview.sub')}</Text>
              </View>
            </View>
            <View style={s.tick}><Text style={s.tickT}>✓</Text></View>
          </View>
          <View style={s.statsRow}>
            {STATS.map(([v, l], i) => (
              <View key={l} style={[s.statItem, i > 0 && s.statDivider]}>
                <Text style={s.statV}>{v}</Text>
                <Text style={s.statL}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ---------- Quick actions ---------- */}
        <SectionHead title={t('home.quickActions')} />
        <View style={[s.row, s.tiles]}>
          {tiles.map((x) => (
            <T key={x.labelKey} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={x.label.replace('\n', ' ')}
              onPress={() => router.push(x.to as never)} style={[s.tile, { backgroundColor: C.surface }]}>
              <View style={[s.tileIcon, { backgroundColor: x.iconBg }]}><Text style={{ fontSize: 20 }}>{x.icon}</Text></View>
              <Text style={s.tileL}>{x.label}</Text>
            </T>
          ))}
        </View>

        {/* ---------- MEDCARD ---------- */}
        <SectionHead title={t('home.medcard.title')} action={t('home.medcard.open')} onPress={() => router.navigate('/(tabs)/medcard')} />
        <View style={s.medcardWrap}>
          <MedCard user={medUser} onPress={() => router.navigate('/(tabs)/medcard' as never)} />
          {cardFailed && (
            <View style={s.cardErrBox}>
              <Text accessibilityRole="alert" style={s.cardErrT}>⚠️  {cardError || t('home.err.medcard')}</Text>
            </View>
          )}
          <Text style={s.tiltHint}></Text>
        </View>

        {/* ---------- Explore (feature carousel) ---------- */}
        <SectionHead title={t('home.explore')} />
        <ScrollView
          ref={carouselRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          onScrollBeginDrag={() => { userDragging.current = true; }}
          onMomentumScrollEnd={onCarouselEnd}
          onScrollEndDrag={(e) => {
            if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.x) < 0.05) onCarouselEnd(e);
          }}
          contentContainerStyle={{ paddingHorizontal: SIDE_PAD, paddingVertical: 4 }}
        >
          {features.map((f, i) => (
            <View key={f.key} style={[s.feat, { width: cardW, backgroundColor: C.surfaceAlt, marginRight: i === features.length - 1 ? 0 : CARD_GAP }]}>
              <View pointerEvents="none" style={s.featBlobA} />
              <View pointerEvents="none" style={s.featBlobB} />
              <View style={s.row}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.featT}>{f.title}</Text>
                  <Text style={s.featD} numberOfLines={3}>{f.desc}</Text>
                </View>
                <View style={s.featIconWrap}><Text style={s.featIcon}>{f.icon}</Text></View>
              </View>
              <T
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={f.cta}
                onPress={() => setSheet(f.key)}
                style={[s.featBtn, f.key === 'sos' && { backgroundColor: C.red }]}
              >
                <Text style={s.featBtnT}>{f.cta}  →</Text>
              </T>
            </View>
          ))}
        </ScrollView>
        <View style={[s.row, s.dots]}>
          {features.map((f, i) => (<View key={f.key} style={[s.pgDot, i === activeIdx && s.pgDotOn]} />))}
        </View>

        {/* ---------- Recent records ---------- */}
        <SectionHead title={t('home.recent.title')} action={t('home.recent.viewAll')} onPress={() => router.push('/(tabs)/records' as never)} />
        {recentLoading ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color={C.deep} />
        ) : recentFailed ? (
          <View style={s.errBox}><Text accessibilityRole="alert" style={s.errT}>⚠️  {recentError || t('home.err.recent')}</Text></View>
        ) : recentRecords.length ? (
          recentRecords.map((r) => {
            const date = new Date(r.created_at);
            const meta = t('home.recent.meta', {
              date: Number.isNaN(date.getTime())
                ? t('home.recent.dateUnavailable')
                : date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
              category: r.category,
            });
            return (
              <T key={r.id} activeOpacity={0.85} onPress={() => router.push('/(tabs)/records' as never)} style={[s.card, s.rec]}>
                <View style={[s.recIcon, { backgroundColor: C.soft }]}>
                  <Text style={{ fontSize: 18 }}>{RECORD_ICONS[r.category] || '📄'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.recT} numberOfLines={1}>{r.title}</Text>
                  <Text style={s.recM}>{meta}</Text>
                </View>
                <Text style={s.chev}>›</Text>
              </T>
            );
          })
        ) : (
          <View style={s.empty}>
            <Text style={{ fontSize: 30 }}>🗂️</Text>
            <Text style={s.emptyT}>{t('home.recent.empty')}</Text>
            <Text style={s.emptyD}>{t('home.recent.emptySub')}</Text>
          </View>
        )}

        {/* ---------- Smart health dashboard promo ---------- */}
        <View style={s.dash}>
          <View pointerEvents="none" style={s.dashBlob} />
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={s.dashT}>{t('home.dash.title')}</Text>
            <Text style={s.dashD}>{t('home.dash.desc')}</Text>
            <T activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('home.dash.cta')}
              onPress={() => router.push('/(tabs)/records' as never)} style={s.dashBtn}>
              <Text style={s.dashBtnT}>{t('home.dash.cta')}</Text>
            </T>
          </View>
          <Text style={s.dashIcon}>📊</Text>
        </View>
      </ScrollView>

      {/* ---------- Feature sheets ---------- */}
      <SosModal
        visible={sheet === 'sos'}
        onClose={() => setSheet(null)}
        contactName={medUser.emergencyName}
        contactPhone={medUser.emergencyPhone}
      />
      <HospitalModal visible={sheet === 'hospital'} onClose={() => setSheet(null)} />
      <FamilyModal visible={sheet === 'family'} onClose={() => setSheet(null)} />
      <FeedbackModal visible={sheet === 'feedback'} onClose={() => setSheet(null)} email={medUser.email} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const SHADOW = {
  shadowColor: '#0A3A47',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;

const makeHomeStyles = (C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  // status-bar strip + header now use the same color as the MEDCARD (C.deep)
  topFill: { position: 'absolute', left: 0, right: 0, backgroundColor: '#0B4F5C' },

  row: { flexDirection: 'row', alignItems: 'center' },

 header: {
  backgroundColor: '#0B4F5C', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 70,
  borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden',
},
  hBlobA: { position: 'absolute', right: -40, top: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,.07)' },
  hBlobB: { position: 'absolute', left: -30, bottom: -60, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,.05)' },
  avatar: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: '#0B4F5C', borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,.75)', alignItems: 'center', justifyContent: 'center',
  },
  avatarT: { color: C.onBrand, fontWeight: '800', fontSize: 20 },
  greet: { color: C.onDeepSoft, fontSize: 12.5 },
  name: { color: C.onDeep, fontSize: 21, fontWeight: '800', marginTop: 1 },
  idPill: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: 'rgba(255,255,255,.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  idPillT: { color: C.onDeep, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },

  card: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.line },

  overview: { marginHorizontal: 16, marginTop: -50, padding: 18, ...SHADOW, shadowOpacity: 0.14, shadowRadius: 18, elevation: 7 },
  ovIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  ovTitle: { color: C.ink, fontWeight: '800', fontSize: 15 },
  ovSub: { color: C.mute, fontSize: 11.5, marginTop: 1 },
  tick: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  tickT: { color: C.onBrand, fontSize: 12, fontWeight: '800' },
  statsRow: { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { borderLeftWidth: 1, borderLeftColor: C.line },
  statV: { color: C.deep, fontSize: 24, fontWeight: '800' },
  statL: { color: C.mute, fontSize: 11, marginTop: 3 },

  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 24, marginBottom: 10 },
  secT: { color: C.deep, fontSize: 17, fontWeight: '800' },
  viewAll: { color: C.teal, fontSize: 12.5, fontWeight: '700' },

  tiles: { marginHorizontal: 11 },
  tile: { flex: 1, marginHorizontal: 5, borderRadius: 18, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: C.line, ...SHADOW, shadowOpacity: 0.05 },
  tileIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tileL: { color: C.ink, fontSize: 11.5, fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 15 },

  medcardWrap: { marginHorizontal: 16 },
  tiltHint: { textAlign: 'center', color: C.mute, fontSize: 11, marginTop: 10 },
  cardErrBox: { marginTop: 10, backgroundColor: C.redSoft, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.red },
  cardErrT: { color: C.red, fontSize: 12.5 },

  feat: { borderRadius: 24, padding: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,.7)', ...SHADOW, shadowOpacity: 0.07 },
  featBlobA: { position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,.35)' },
  featBlobB: { position: 'absolute', left: 40, bottom: -50, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,.25)' },
  featT: { color: C.deep, fontSize: 18, fontWeight: '800' },
  featD: { color: C.ink, fontSize: 12.5, lineHeight: 18, marginTop: 6, opacity: 0.85 },
  featIconWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  featIcon: { fontSize: 32 },
  featBtn: { alignSelf: 'flex-start', marginTop: 16, backgroundColor: C.deepSurface, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  featBtnT: { color: C.onDeep, fontSize: 13, fontWeight: '700' },
  dots: { justifyContent: 'center', marginTop: 12 },
  pgDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.line, marginHorizontal: 3 },
  pgDotOn: { width: 18, backgroundColor: C.deep },

  rec: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 16, ...SHADOW, shadowOpacity: 0.04, elevation: 1 },
  recIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  recT: { color: C.ink, fontWeight: '700', fontSize: 14 },
  recM: { color: C.mute, fontSize: 11.5, marginTop: 3 },
  chev: { color: C.mute, fontSize: 24, marginLeft: 6 },

  empty: { marginHorizontal: 16, alignItems: 'center', paddingVertical: 24, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, backgroundColor: C.surface },
  emptyT: { color: C.ink, fontWeight: '700', fontSize: 14, marginTop: 8 },
  emptyD: { color: C.mute, fontSize: 12, marginTop: 3 },

  errBox: { marginHorizontal: 16, backgroundColor: C.redSoft, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.red },
  errT: { color: C.red, fontSize: 13 },

  dash: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 24, padding: 18, borderRadius: 24, backgroundColor: C.deepSurface, overflow: 'hidden' },
  dashBlob: { position: 'absolute', right: -30, top: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,.08)' },
  dashT: { color: C.onDeep, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  dashD: { color: C.onDeepSoft, fontSize: 12, marginTop: 5, lineHeight: 17 },
  dashBtn: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: C.surface, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18 },
  dashBtnT: { color: C.deep, fontSize: 12.5, fontWeight: '800' },
  dashIcon: { fontSize: 48 },
});

// styles for the feature sheets
const makeModalStyles = (C) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  headT: { flex: 1, fontSize: 18, fontWeight: '800', color: C.ink },
  close: { fontSize: 22, color: C.mute },

  btn: { backgroundColor: C.deepSurface, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, alignSelf: 'stretch' },
  btnGhost: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.deep },
  btnT: { color: C.onDeep, fontWeight: '800', fontSize: 15 },

  label: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 6, marginTop: 12, letterSpacing: 0.3 },
  input: { backgroundColor: C.surfaceAlt, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 14, height: 50, fontSize: 15, color: C.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: C.surfaceAlt, borderWidth: 1.5, borderColor: C.line, marginRight: 8, marginBottom: 8 },
  chipSm: { minWidth: 54, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, backgroundColor: C.surfaceAlt, borderWidth: 1.5, borderColor: C.line, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: C.deepSurface, borderColor: C.deepSurface },
  chipT: { color: C.ink, fontWeight: '600', fontSize: 13.5 },
  note: { color: C.mute, fontSize: 11.5, textAlign: 'center', marginTop: 8 },

  errBox: { backgroundColor: C.redSoft, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.red },
  errT: { color: C.red, fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  centerH: { fontSize: 17, fontWeight: '800', color: C.ink, marginTop: 10, textAlign: 'center' },
  centerT: { color: C.mute, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  emptyBox: { alignItems: 'center', paddingVertical: 30 },

  // SOS
  sosRing: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.redSoft, borderWidth: 6, borderColor: C.red, alignItems: 'center', justifyContent: 'center' },
  sosNum: { fontSize: 52, fontWeight: '800', color: C.red },
  sosTitle: { marginTop: 16, fontSize: 18, fontWeight: '800', color: C.ink, textAlign: 'center' },
  sosSub: { marginTop: 4, color: C.mute, fontSize: 13 },
  sosLoc: { marginTop: 10, color: C.deep, fontSize: 12.5, fontWeight: '600' },

  // family
  member: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, marginBottom: 10 },
  memAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  memAvatarT: { color: C.purple, fontWeight: '800', fontSize: 17 },
  memName: { color: C.ink, fontWeight: '700', fontSize: 15 },
  memMeta: { color: C.mute, fontSize: 12, marginTop: 2 },

  // feedback
  stars: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  star: { fontSize: 38, marginHorizontal: 5 },
  starLbl: { textAlign: 'center', color: C.deep, fontWeight: '700', marginTop: 4, height: 18 },
});