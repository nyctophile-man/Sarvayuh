// @ts-nocheck
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity as T, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet as S,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '@/constants/theme';
import { Btn } from '@/components/ui';
import { resetPassword } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';

export default function ResetPassword() {
  const router = useRouter();
  const { token } = useLocalSearchParams();
  const { t } = useI18n();
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const go = async () => {
    if (p.length < 8) return setErr(t('reset.errShort'));
    if (p !== c) return setErr(t('reset.errMismatch'));
    if (!token) return setErr(t('reset.errToken'));
    setErr('');
    setBusy(true);
    try {
      await resetPassword(String(token), p);
      setDone(true);
      setTimeout(() => router.replace('/(auth)/login'), 1500);
    } catch (ex) {
      setErr(ex.message || t('reset.errFailed'));
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
        <View style={st.card}>

          <Text style={st.title}>{done ? t('reset.doneTitle') : t('reset.title')}</Text>
          <Text style={st.subtitle}>
            {done ? t('reset.doneSubtitle') : t('reset.subtitle')}
          </Text>

          {!!err && (
            <View style={st.errBox}>

              <Text style={st.errText}>{err}</Text>
            </View>
          )}

          {!done && (
            <>
              <Text style={st.label}>{t('reset.newPassword')}</Text>
              <View style={st.inputWrap}>

                <TextInput
                  placeholder={t('reset.newPasswordPlaceholder')}
                  placeholderTextColor={C.mute}
                  style={st.input}
                  value={p}
                  onChangeText={setP}
                  secureTextEntry={!show}
                  autoCapitalize="none"
                />
                <T onPress={() => setShow(!show)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={st.showBtn}>{show ? t('common.hide') : t('common.show')}</Text>
                </T>
              </View>

              <Text style={st.label}>{t('reset.confirmPassword')}</Text>
              <View style={st.inputWrap}>

                <TextInput
                  placeholder={t('reset.confirmPlaceholder')}
                  placeholderTextColor={C.mute}
                  style={st.input}
                  value={c}
                  onChangeText={setC}
                  secureTextEntry={!show}
                  autoCapitalize="none"
                />
              </View>

              <Btn t={busy ? t('reset.updating') : t('reset.update')} disabled={busy} onPress={go} />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = S.create({
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 32, justifyContent: 'center' },
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
  label: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 6, marginTop: 4, letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F8FA', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E3E8EC', paddingHorizontal: 14, height: 52, marginBottom: 12,
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 0 },
  showBtn: { color: C.teal, fontWeight: '700', fontSize: 13, marginLeft: 8 },
});
