// @ts-nocheck
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity as T, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet as S,
} from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '@/constants/theme';
import { Btn } from '@/components/ui';
import { signup, setAuthUser, setToken } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';
import Logo from '@/components/Logo';

// Roles shown on the picker. Pharmacy is disabled until it launches.
const ROLES = [
  { id: 'patient',  icon: '🧑', key: 'role.patient',  soon: false },
  { id: 'doctor',   icon: '🩺', key: 'role.doctor',   soon: false },
  { id: 'pharmacy', icon: '💊', key: 'role.pharmacy', soon: true  },
];

// Reusable styled input with icon, focus highlight and optional right-side action
const Input = ({ icon, right, focused, onFocus, onBlur, ...p }) => (
  <View style={[st.inputWrap, focused && st.inputFocused]}>
    {!!icon && <Text style={st.inputIcon}>{icon}</Text>}
    <TextInput
      placeholderTextColor={C.mute}
      style={st.input}
      onFocus={onFocus}
      onBlur={onBlur}
      {...p}
    />
    {right}
  </View>
);

// Password strength: 0 (empty) to 4
const strengthOf = (pw) => {
  if (!pw) return 0;
  let sc = 0;
  if (pw.length >= 8) sc++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) sc++;
  if (/\d/.test(pw)) sc++;
  if (/[^A-Za-z0-9]/.test(pw)) sc++;
  return Math.max(sc, 1);
};
const STRENGTH = [
  { key: '', color: '#E3E8EC' },
  { key: 'signup.strength.weak', color: '#E5484D' },
  { key: 'signup.strength.fair', color: '#F5A524' },
  { key: 'signup.strength.good', color: '#3DA9FC' },
  { key: 'signup.strength.strong', color: '#17A673' },
];

export default function Signup() {
  const router = useRouter();
  const { t } = useI18n();
  const [role, setRole] = useState('patient'); // 'patient' | 'doctor'
  const [n, setN] = useState('');
  const [e, setE] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(null); // 'name' | 'email' | 'pass' | null

  const score = useMemo(() => strengthOf(p), [p]);

  const go = async () => {
    if (!n.trim()) return setErr(t('signup.errName'));
    if (!/^\S+@\S+\.\S+$/.test(e.trim())) return setErr(t('signup.errEmail'));
    if (p.length < 8) return setErr(t('signup.errPassword'));
    setErr('');
    setBusy(true);
    try {
      const { token, user } = await signup({ name: n.trim(), email: e.trim(), password: p, role });
      setToken(token);
      setAuthUser(user);
      // Doctor -> doctor UI, Patient -> patient profile setup then tabs
      router.replace(role === 'doctor' ? '/(doctor)' : '/(auth)/profile-setup');
    } catch (ex) {
      setErr(ex.message || t('signup.errFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F4F8F9' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={st.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand header */}
        <View style={st.header}>
          <Logo variant="color" width={190} title="SARVAYUH logo" />
          <Text style={st.brand}>SARVAYUH</Text>
          <Text style={st.tagline}>{t('signup.tagline')}</Text>
        </View>

        {/* Form card */}
        <View style={st.card}>
          <Text style={st.title}>{t('signup.title')}</Text>
          <Text style={st.subtitle}>{t('signup.subtitle')}</Text>

          {!!err && (
            <View style={st.errBox}>
              <Text style={st.errIcon}>⚠️</Text>
              <Text style={st.errText}>{err}</Text>
            </View>
          )}

          {/* Role selector */}
          <Text style={st.label}>{t('role.signUpAs')}</Text>
          <View style={st.roleRow}>
            {ROLES.map((r) => {
              const active = role === r.id;
              return (
                <T
                  key={r.id}
                  disabled={r.soon}
                  activeOpacity={0.8}
                  onPress={() => { setRole(r.id); setErr(''); }}
                  style={[st.chip, active && st.chipActive, r.soon && st.chipDisabled]}
                >
                  <Text style={st.chipIcon}>{r.icon}</Text>
                  <Text style={[st.chipLabel, active && st.chipLabelActive]}>{t(r.key)}</Text>
                  {r.soon && (
                    <View style={st.badge}>
                      <Text style={st.badgeText}>{t('role.comingSoon')}</Text>
                    </View>
                  )}
                </T>
              );
            })}
          </View>

          <Text style={st.label}>{t('signup.fullName')}</Text>
          <Input
            placeholder={t('signup.namePlaceholder')}
            value={n}
            onChangeText={setN}
            autoCapitalize="words"
            focused={focus === 'name'}
            onFocus={() => setFocus('name')}
            onBlur={() => setFocus(null)}
          />

          <Text style={st.label}>{t('common.emailAddress')}</Text>
          <Input
            placeholder={t('common.emailPlaceholder')}
            value={e}
            onChangeText={setE}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            focused={focus === 'email'}
            onFocus={() => setFocus('email')}
            onBlur={() => setFocus(null)}
          />

          <Text style={st.label}>{t('common.password')}</Text>
          <Input
            placeholder={t('common.password')}
            value={p}
            onChangeText={setP}
            secureTextEntry={!show}
            autoCapitalize="none"
            focused={focus === 'pass'}
            onFocus={() => setFocus('pass')}
            onBlur={() => setFocus(null)}
            right={
              <T onPress={() => setShow(!show)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={st.showBtn}>{show ? t('common.hide') : t('common.show')}</Text>
              </T>
            }
          />

          {/* Strength meter */}
          <View style={st.meterRow}>
            <View style={st.meter}>
              {[1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    st.meterSeg,
                    { backgroundColor: i <= score ? STRENGTH[score].color : '#E3E8EC' },
                  ]}
                />
              ))}
            </View>
            <Text style={[st.meterLabel, { color: STRENGTH[score].color }]}>
              {STRENGTH[score].key ? t(STRENGTH[score].key) : ''}
            </Text>
          </View>
          <Text style={st.hint}>{t('signup.strengthHint')}</Text>

          <Btn t={busy ? t('signup.creating') : t('signup.createAccount')} disabled={busy} onPress={go} />

          {/* Divider */}
          <View style={st.divRow}>
            <View style={st.divLine} />
            <Text style={st.divText}>{t('common.or')}</Text>
            <View style={st.divLine} />
          </View>

          <T style={st.altBtn} onPress={() => router.push('/(auth)/login')} activeOpacity={0.8}>
            <Text style={st.altText}>{t('signup.hasAccount')}</Text>
          </T>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = S.create({
  scroll: { flexGrow: 1, padding: 24, paddingTop: 56, paddingBottom: 32, justifyContent: 'center' },

  header: { alignItems: 'center', marginBottom: 24 },
  brand: { marginTop: 14, fontSize: 26, fontWeight: '800', letterSpacing: 3, color: C.ink },
  tagline: { marginTop: 2, fontSize: 13, color: C.mute, letterSpacing: 0.5 },

  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '800', color: C.ink },
  subtitle: { fontSize: 13, color: C.mute, marginTop: 4, marginBottom: 18, lineHeight: 19 },

  errBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEA',
    borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#F5C6C0',
  },
  errIcon: { marginRight: 8 },
  errText: { flex: 1, color: '#B3261E', fontSize: 13 },

  label: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 6, marginTop: 4, letterSpacing: 0.3 },

  // Role chips
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E3E8EC', backgroundColor: '#F6F8FA',
  },
  chipActive: { borderColor: C.teal, backgroundColor: '#E8F5F4' },
  chipDisabled: { opacity: 0.55 },
  chipIcon: { fontSize: 20, marginBottom: 4 },
  chipLabel: { fontSize: 12, fontWeight: '700', color: C.mute },
  chipLabelActive: { color: C.teal },
  badge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#FFF1D6' },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#B7791F' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F8FA',
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E3E8EC',
    paddingHorizontal: 14, height: 52, marginBottom: 12,
  },
  inputFocused: { borderColor: C.teal, backgroundColor: '#fff' },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 0 },
  showBtn: { color: C.teal, fontWeight: '700', fontSize: 13, marginLeft: 8 },

  meterRow: { flexDirection: 'row', alignItems: 'center', marginTop: -2 },
  meter: { flex: 1, flexDirection: 'row', gap: 6 },
  meterSeg: { flex: 1, height: 5, borderRadius: 3 },
  meterLabel: { width: 56, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  hint: { color: C.mute, fontSize: 12, marginTop: 8, marginBottom: 18, lineHeight: 17 },

  divRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  divLine: { flex: 1, height: 1, backgroundColor: '#E3E8EC' },
  divText: { marginHorizontal: 12, color: C.mute, fontSize: 12 },

  altBtn: {
    height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: C.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  altText: { color: C.teal, fontWeight: '700', fontSize: 15 },
});