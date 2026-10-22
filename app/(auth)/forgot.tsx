// @ts-nocheck
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity as T, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet as S,
} from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '@/constants/theme';
import { Btn } from '@/components/ui';
import { forgotPassword } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';

export default function Forgot() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [devToken, setDevToken] = useState('');

  const go = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr(t('forgot.errEmail'));
    setErr('');
    setBusy(true);
    try {
      const res = await forgotPassword(email.trim());
      setOk(true);
      // The backend only returns the token in dev (DEV_RESET_TOKEN=true). Production mails it.
      if (res && res.token) setDevToken(res.token);
    } catch (ex) {
      setErr(ex.message || t('forgot.errFailed'));
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
        <T onPress={() => router.back()} style={st.back} accessibilityLabel="Go back">
          <Text style={st.backT}>{t('common.back')}</Text>
        </T>

        <View style={st.card}>

          <Text style={st.title}>{t('forgot.title')}</Text>
          <Text style={st.subtitle}>{t('forgot.subtitle')}</Text>

          {!!err && (
            <View style={st.errBox}>

              <Text style={st.errText}>{err}</Text>
            </View>
          )}

          {ok ? (
            <View style={st.okBox}>

              <Text style={st.okTitle}>{t('forgot.checkInbox')}</Text>
              <Text style={st.okText}>{t('forgot.checkInboxBody', { email: email.trim() })}</Text>
              {!!devToken && (
                <T
                  activeOpacity={0.8}
                  onPress={() => router.push({ pathname: '/(auth)/reset-password', params: { token: devToken } })}
                  style={st.devBtn}
                >
                  <Text style={st.devText}>{t('forgot.devOpen')}</Text>
                </T>
              )}
            </View>
          ) : (
            <>
              <Text style={st.label}>{t('common.emailAddress')}</Text>
              <View style={st.inputWrap}>

                <TextInput
                  placeholder={t('common.emailPlaceholder')}
                  placeholderTextColor={C.mute}
                  style={st.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Btn t={busy ? t('forgot.sending') : t('forgot.send')} disabled={busy} onPress={go} />
            </>
          )}

          <T style={st.altBtn} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.8}>
            <Text style={st.altText}>{t('forgot.backToSignIn')}</Text>
          </T>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = S.create({
  scroll: { flexGrow: 1, padding: 24, paddingTop: 40, paddingBottom: 32, justifyContent: 'center' },
  back: { alignSelf: 'flex-start', marginBottom: 18, paddingVertical: 6 },
  backT: { color: C.teal, fontWeight: '700', fontSize: 15 },
  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  icon: { fontSize: 40, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: C.ink, textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 13, color: C.mute, marginTop: 4, marginBottom: 18, lineHeight: 19, textAlign: 'center' },
  errBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEA',
    borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#F5C6C0',
  },
  errIcon: { marginRight: 8 },
  errText: { flex: 1, color: '#B3261E', fontSize: 13 },
  okBox: { backgroundColor: '#E7F6F0', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#BFE5D3' },
  okIcon: { fontSize: 26, textAlign: 'center' },
  okTitle: { fontSize: 16, fontWeight: '800', color: C.ink, textAlign: 'center', marginTop: 6 },
  okText: { color: C.mute, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  devBtn: { marginTop: 14, alignSelf: 'center', backgroundColor: C.deep, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18 },
  devText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  label: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 6, marginTop: 4, letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F8FA', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E3E8EC', paddingHorizontal: 14, height: 52, marginBottom: 16,
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 0 },
  altBtn: {
    height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: C.teal,
    alignItems: 'center', justifyContent: 'center', marginTop: 14,
  },
  altText: { color: C.teal, fontWeight: '700', fontSize: 15 },
});
