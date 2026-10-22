// @ts-nocheck
import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { C, s } from '@/constants/theme';
import { getAuthUser, getToken } from '@/lib/api';
import { logo } from '@/constants/images';

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    // Already logged in (token in memory) -> open home directly
    const go = async () => {
      const t = getToken();
      if (t) {
        router.replace(getAuthUser()?.role === 'doctor' ? '/(doctor)' : '/(tabs)/home');
        return;
      }
      router.replace('/(auth)/onboarding');
    };
    go();
  }, [router]);

  return (
    <View style={[s.full, { backgroundColor: C.deep, justifyContent: 'center', alignItems: 'center' }]}>
      <Image source={logo} resizeMode="contain" accessibilityLabel="SARVAYUH logo" style={{ width: 130, height: 130 }} />
      <Text style={s.logo}>SARVAYUH</Text>
      <Text style={[s.tiny, { letterSpacing: 3, marginTop: 6 }]}>HEALTH WITHOUT BOUNDARIES</Text>
    </View>
  );
}
