// @ts-nocheck
import React from 'react';
import { View } from 'react-native';
import QRCodeSvg from 'react-native-qrcode-svg';
import { useTheme } from '@/lib/theme';

/* Real scannable QR code (react-native-qrcode-svg). */
const QR = ({ size = 80, value = 'SARVAYUH' }) => {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size, backgroundColor: colors.white, padding: 6 }}>
      <QRCodeSvg value={String(value || 'SARVAYUH')} size={size - 12} color={colors.deepSurface} backgroundColor={colors.white} />
    </View>
  );
};

export default QR;
