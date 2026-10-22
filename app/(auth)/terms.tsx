// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, TouchableOpacity as T, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { C, s } from '@/constants/theme';
import { Btn } from '@/components/ui';
import { useI18n } from '@/lib/i18n/context';

const DOCS = [
  {
    key: 'terms',
    titleKey: 'terms.terms.title',
    subKey: 'terms.terms.sub',
    count: 9,
  },
  {
    key: 'privacy',
    titleKey: 'terms.privacy.title',
    subKey: 'terms.privacy.sub',
    count: 9,
  },
];

export default function Terms() {
  const router = useRouter();
  const { t } = useI18n();
  const next = () => router.push('/(auth)/signup');
  const [ok, setOk] = useState(false);
  const [doc, setDoc] = useState(null); // the doc key currently shown in the sheet

  const sectionsOf = (key) =>
    Array.from({ length: key === 'terms' ? 9 : 9 }, (_, i) => i + 1).map((n) => ({
      heading: t(`terms.${key}.s${n}.h`),
      body: t(`terms.${key}.s${n}.b`),
    }));

  return (
    <View style={[s.full, { padding: 24, justifyContent: 'center' }]}>

      <Text style={s.h1}>{t('terms.title')}</Text>
      <Text style={{ color: C.mute, marginBottom: 18 }}>{t('terms.subtitle')}</Text>

      {DOCS.map((d) => (
        <T
          key={d.key}
          activeOpacity={0.8}
          onPress={() => setDoc(d.key)}
          style={[s.card, { marginBottom: 10, flexDirection: 'row', alignItems: 'center' }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: C.ink }}>{t(d.titleKey)}</Text>
            <Text style={{ color: C.mute, fontSize: 12 }}>{t(d.subKey)}</Text>
          </View>
          <Text style={{ color: C.mute, fontSize: 28, marginLeft: 8, marginTop: -4 }}>›</Text>
        </T>
      ))}

      <T onPress={() => setOk(!ok)} style={{ flexDirection: 'row', marginVertical: 18, alignItems: 'center' }}>
        <View style={[s.cb, ok && { backgroundColor: C.teal }]}>{ok && <Text style={{ color: '#fff' }}>✓</Text>}</View>
        <Text style={{ flex: 1, marginLeft: 10, color: C.ink }}>{t('terms.agree')}</Text>
      </T>
      <Btn t={t('common.continueArrow')} disabled={!ok} onPress={next} />

      {/* Bottom sheet */}
      <Modal
        visible={!!doc}
        transparent
        animationType="slide"
        onRequestClose={() => setDoc(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          {/* tap outside to close */}
          <T style={{ flex: 1 }} activeOpacity={1} onPress={() => setDoc(null)} />

          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '85%',
              paddingTop: 10,
            }}
          >
            {/* drag handle look */}
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 12 }} />

            {/* header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: C.ink }}>{doc ? t(`terms.${doc}.title`) : ''}</Text>
              <T onPress={() => setDoc(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 22, color: C.mute }}>✕</Text>
              </T>
            </View>

            {/* content */}
            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              {doc && sectionsOf(doc).map((sec, i) => (
                <View key={i} style={{ marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', color: C.ink, marginBottom: 3 }}>{sec.heading}</Text>
                  <Text style={{ color: C.mute, fontSize: 14, lineHeight: 20 }}>{sec.body}</Text>
                </View>
              ))}
              <Text style={{ color: C.mute, fontSize: 11, fontStyle: 'italic' }}>{t('terms.lastUpdated')}</Text>
            </ScrollView>

            {/* footer */}
            <View style={{ padding: 20, paddingTop: 8 }}>
              <Btn t={t('common.close')} onPress={() => setDoc(null)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
