// @ts-nocheck
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/lib/theme';

export type Rec = {
  i?: string;
  t?: string;
  d?: string;
  c?: string;
  [key: string]: unknown;
};

export function RecRow({ r, right }: { r: Rec; right?: React.ReactNode }) {
  const { colors, styles } = useTheme();
  return (
    <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 8 }]}>
      <View style={styles.ic}>
        <Text style={{ fontSize: 18 }}>{r.i}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontWeight: '700', color: colors.ink }}>{r.t}</Text>
        <Text style={{ color: colors.mute, fontSize: 12 }}>
          {[r.d, r.c].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {right}
    </View>
  );
}

export default RecRow;
