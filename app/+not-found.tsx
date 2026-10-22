// @ts-nocheck
import React from 'react';
import { View, Text, TouchableOpacity as T, StyleSheet as S } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '@/constants/theme';
import { useI18n } from '@/lib/i18n/context';

export default function NotFound() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <View style={st.screen}>
      <Text style={st.code}>404</Text>
      <Text style={st.title}>{t('notFound.title')}</Text>
      <Text style={st.sub}>{t('notFound.sub')}</Text>
      <T style={st.btn} activeOpacity={0.85} onPress={() => router.replace('/(tabs)/home')}>
        <Text style={st.btnT}>{t('notFound.cta')}</Text>
      </T>
    </View>
  );
}

const st = S.create({
  screen: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  code: { fontSize: 64, fontWeight: '900', color: C.teal, opacity: 0.25 },
  title: { fontSize: 22, fontWeight: '800', color: C.deep, marginTop: 4 },
  sub: { color: C.mute, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  btn: { backgroundColor: C.teal, borderRadius: 14, height: 50, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  btnT: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
