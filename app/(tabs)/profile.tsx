// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TextInput, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Btn } from '@/components/ui';
import { getProfile, putProfile, clearToken } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';
import { useTheme } from '@/lib/theme';

const BLOODS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['male', 'female', 'other'];

// Security rows: translation key + route (null = not wired yet)
const SECURITY_ITEMS: { key: string; route: string | null }[] = [
  { key: 'profile.item.password', route: '/(auth)/forgot' },   // Change Password
  { key: 'profile.item.twoFactor', route: null },               // Two-Factor Authentication
  { key: 'profile.item.export', route: null },                  // Export Account
  { key: 'profile.item.privacy', route: 'PRIVACY' },            // Privacy Policy (opens popup, not a page)
  { key: 'profile.item.revoke', route: null },                  // Revoke Access Tokens
];

const PRIVACY_SECTIONS = [1, 2, 3, 4, 5, 6];

/* ---------------- small UI pieces ---------------- */
const Segment = ({ th, options, value, onChange }) => (
  <View style={{ flexDirection: 'row', backgroundColor: th.chip, borderRadius: 12, padding: 3 }}>
    {options.map(([k, label]) => {
      const on = value === k;
      return (
        <Pressable key={k} onPress={() => onChange(k)} style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, backgroundColor: on ? th.deep : 'transparent' }}>
          <Text style={{ color: on ? '#fff' : th.mute, fontWeight: '600', fontSize: 13 }}>{label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const Chip = ({ th, label, on, onPress }) => (
  <Pressable onPress={onPress} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, marginRight: 8, marginBottom: 8, backgroundColor: on ? th.deep : th.chip, borderWidth: 1, borderColor: on ? th.deep : th.border }}>
    <Text style={{ color: on ? '#fff' : th.ink, fontWeight: '600' }}>{label}</Text>
  </Pressable>
);

export default function Profile() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const { colors, mode, setMode } = useTheme();
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [err, setErr] = useState('');
  const [d, setD] = useState(''), [g, setG] = useState(''), [ph, setPh] = useState(''), [b, setB] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const th = {
    bg: colors.bg,
    card: colors.surface,
    ink: colors.ink,
    mute: colors.inkSoft,
    border: colors.line,
    input: colors.surfaceAlt,
    accent: colors.teal,
    deep: colors.deepSurface,
    chip: colors.soft,
  };

  useEffect(() => {
    getProfile().then((p) => { setData(p); setD(p.dob || ''); setG((p.gender || '').toLowerCase()); setPh(p.phone || ''); setB(p.blood || ''); setLoading(false); })
      .catch((e) => { if (e.message === 'Login required') { clearToken(); router.replace('/(auth)/signup'); } setErr(e.message); setLoading(false); });
  }, [router]);

  const save = async () => {
    try {
      setErr('');
      await putProfile({ dob: d, gender: g, phone: ph, blood: b });
      setData({ ...data, dob: d, gender: g, phone: ph, blood: b });
      setJustSaved(true); setTimeout(() => setJustSaved(false), 1800);
    } catch (e) { setErr(e.message || t('profile.errSave')); }
  };

  const initials = useMemo(() => {
    const n = (data && data.name) || t('common.guest');
    return n.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');
  }, [data, t]);

  const filled = [d, g, ph, b].filter(Boolean).length;
  const pct = filled / 4;

  const card = { backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 16, marginBottom: 16 };
  const h2 = { color: th.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 6 };
  const input = { backgroundColor: th.input, color: th.ink, borderWidth: 1, borderColor: th.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, fontSize: 15 };
  const label = { color: th.mute, fontSize: 12, marginBottom: 6, marginTop: 4 };

  if (loading) return <View style={{ flex: 1, backgroundColor: th.bg }}><ActivityIndicator style={{ marginTop: 60 }} color={th.accent} /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.bg }} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 50 }}>
      {/* header card */}
      <View style={[card, { flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 22 }}>{initials}</Text>
        </View>
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={{ color: th.ink, fontSize: 20, fontWeight: '700' }}>{data?.name || t('common.guest')}</Text>
          {!!data?.email && <Text style={{ color: th.mute, marginTop: 2 }}>{data.email}</Text>}
          <View style={{ height: 6, borderRadius: 3, backgroundColor: th.chip, marginTop: 10, overflow: 'hidden' }}>
            <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: th.accent }} />
          </View>
          <Text style={{ color: th.mute, fontSize: 11, marginTop: 4 }}>{t('profile.complete')} {Math.round(pct * 100)}%</Text>
        </View>
      </View>

      {!!err && <Text style={{ color: '#e5484d', marginBottom: 10 }}>{err}</Text>}

      {/* preferences: language + theme */}
      <Text style={h2}>{t('profile.preferences')}</Text>
      <View style={card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ color: th.ink, fontWeight: '600' }}>{t('profile.language')}</Text>
          <Segment th={th} value={lang} onChange={setLang} options={[['en', 'English'], ['hi', 'हिन्दी']]} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: th.ink, fontWeight: '600' }}>{t('profile.theme')}</Text>
          <Segment th={th} value={mode} onChange={setMode} options={[['light', t('profile.light')], ['dark', t('profile.dark')]]} />
        </View>
      </View>

      {/* profile form */}
      <Text style={h2}>{t('profile.title')}</Text>
      <View style={card}>
        <Text style={label}>{t('profile.dob')}</Text>
        <TextInput style={input} placeholder="DD/MM/YYYY" placeholderTextColor={th.mute} value={d} onChangeText={setD} />

        <Text style={label}>{t('profile.gender')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {GENDERS.map((x) => <Chip key={x} th={th} label={t(`common.${x}`)} on={g === x} onPress={() => setG(x)} />)}
        </View>

        <Text style={label}>{t('profile.blood')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {BLOODS.map((x) => <Chip key={x} th={th} label={x} on={b === x} onPress={() => setB(x)} />)}
        </View>

        <Text style={label}>{t('profile.phone')}</Text>
        <TextInput style={input} placeholder="+91" placeholderTextColor={th.mute} value={ph} onChangeText={setPh} keyboardType="phone-pad" />

        <Btn t={justSaved ? t('profile.saved') : t('profile.save')} onPress={save} style={{ marginTop: 6 }} />
      </View>

      {/* security (tappable rows) */}
      <Text style={h2}>{t('profile.security')}</Text>
      <View style={[card, { paddingVertical: 4 }]}>
        {SECURITY_ITEMS.map((item, i) => {
          const route = item.route;
          return (
            <Pressable
              key={item.key}
              onPress={() => (route === 'PRIVACY' ? setShowPrivacy(true) : route && router.push(route))}
              disabled={!route}
              android_ripple={{ color: th.chip }}
              style={({ pressed }) => ({
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: i === SECURITY_ITEMS.length - 1 ? 0 : 1, borderBottomColor: th.border,
                opacity: pressed && route ? 0.6 : 1,
              })}
            >
              <Text style={{ color: th.ink }}>{t(item.key)}</Text>
              {i === 1
                ? <Text style={{ color: th.accent, fontWeight: '700', fontSize: 12 }}>{t('profile.enabled')}</Text>
                : <Text style={{ color: th.mute, fontSize: 18 }}>›</Text>}
            </Pressable>
          );
        })}
      </View>

      <Btn ghost t={t('profile.signOut')} onPress={() => { clearToken(); router.replace('/(auth)/login'); }} style={{ marginTop: 6 }} />
      {/* privacy policy popup */}
      <Modal visible={showPrivacy} animationType="slide" onRequestClose={() => setShowPrivacy(false)}>
        <View style={{ flex: 1, backgroundColor: th.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: th.border }}>
            <Text style={{ color: th.ink, fontSize: 20, fontWeight: '700' }}>{t('profile.privacyTitle')}</Text>
            <Pressable onPress={() => setShowPrivacy(false)} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: th.chip }}>
              <Text style={{ color: th.ink, fontWeight: '600' }}>{t('common.close')}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
            <Text style={{ color: th.mute, fontSize: 12, marginBottom: 16 }}>{t('profile.updated')}</Text>
            {PRIVACY_SECTIONS.map((n, i) => (
              <View key={n} style={[card, { marginBottom: 12 }]}>
                <Text style={{ color: th.ink, fontWeight: '700', fontSize: 15, marginBottom: 6 }}>{n}. {t(`profile.privacy.s${n}.h`)}</Text>
                <Text style={{ color: th.mute, lineHeight: 21 }}>{t(`profile.privacy.s${n}.b`)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}
