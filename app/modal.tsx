// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity as T } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { C, s } from '@/constants/theme';
import QR from '@/components/QRCode';
import { getMedcard } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';

export default function QRModal() {
  const router = useRouter();
  const { qrToken } = useLocalSearchParams();
  const { t } = useI18n();
  const [card, setCard] = useState(null);

  useEffect(() => {
    getMedcard().then(setCard).catch(() => {});
  }, []);

  return (
    <T activeOpacity={1} onPress={() => router.back()} style={s.modal}>
      <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 20, alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', marginBottom: 10, color: C.ink }}>{t('qr.title')}</Text>
        <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 10, marginBottom: 10 }}>
          <QR size={220} value={String(qrToken || '')} />
        </View>
        {qrToken ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 11, color: C.mute, marginBottom: 4 }}>{t('qr.scanCode')}</Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: C.deep }}>{qrToken}</Text>
          </View>
        ) : null}
        <Text style={{ color: C.mute, fontSize: 12 }}>
          {card ? `${card.name} · ${card.card_id}` : t('qr.default')}
        </Text>
        <Text style={{ color: C.mute, fontSize: 12 }}>{t('qr.footer')}</Text>
      </View>
    </T>
  );
}
