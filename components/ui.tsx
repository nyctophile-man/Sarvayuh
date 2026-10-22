// @ts-nocheck
import React from 'react';
import { View, Text, TextInput, TouchableOpacity as T } from 'react-native';
import { useTheme } from '@/lib/theme';

export const Btn = ({ t, onPress, ghost, gold, disabled, style }) => {
  const { colors, styles } = useTheme();
  return (
    <T onPress={onPress} disabled={disabled} activeOpacity={0.85}
      style={[styles.btn, ghost && styles.btnGhost, gold && { backgroundColor: colors.gold }, disabled && { opacity: 0.45 }, style]}>
      <Text style={[styles.btnT, ghost && { color: colors.teal }, gold && { color: colors.deep }]}>{t}</Text>
    </T>
  );
};

export const Field = (p) => {
  const { colors, styles } = useTheme();
  return <TextInput placeholderTextColor={colors.mute} {...p} style={styles.input} />;
};

export const Row = ({ children, style }) => <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
