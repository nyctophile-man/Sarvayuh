// @ts-nocheck
import React, { useCallback, useRef } from 'react';
import { View, Text, ScrollView, Animated, Easing } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { C, s } from '@/constants/theme';
import { Btn, Row } from '@/components/ui';
import Logo from '@/components/Logo';
import { useI18n } from '@/lib/i18n/context';

function Logo3D() {
  const p = useRef(new Animated.Value(0)).current;

  // runs every time the screen appears, and restarts from 0
  useFocusEffect(
    useCallback(() => {
      p.setValue(0);
      const anim = Animated.timing(p, {
        toValue: 1,
        duration: 1600,
        delay: 300,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    }, [p])
  );

  const rotateY = p.interpolate({ inputRange: [0, 1], outputRange: ['-360deg', '-12deg'] });
  const rotateX = p.interpolate({ inputRange: [0, 1], outputRange: ['45deg', '6deg'] });
  const scale = p.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const opacity = p.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1], extrapolate: 'clamp' });
  const shadowOpacity = p.interpolate({ inputRange: [0.5, 1], outputRange: [0, 0.2], extrapolate: 'clamp' });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      <Animated.View
        style={{
          opacity,
          transform: [{ perspective: 800 }, { translateY }, { scale }, { rotateY }, { rotateX }],
        }}
      >
        <Logo variant="color" width={150} title="SARVAYUH logo" />
      </Animated.View>

      <Animated.View
        style={{
          marginTop: 18,
          width: 100,
          height: 14,
          borderRadius: 50,
          backgroundColor: C.deep,
          opacity: shadowOpacity,
        }}
      />
    </View>
  );
}

export default function Onboard() {
  const router = useRouter();
  const { t } = useI18n();
  const next = () => router.push('/(auth)/terms');
  return (
    <ScrollView
      style={s.full}
      contentContainerStyle={{ padding: 24, paddingTop: 70, paddingBottom: 40, flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <Logo3D />
      <Text style={{ textAlign: 'center', color: C.mute, marginTop: 20 }}>{t('onboarding.welcomeTo')}</Text>
      <Text style={[s.logo, { color: C.deep, fontSize: 30, textAlign: 'center' }]}>SARVAYUH</Text>
      <Text style={{ textAlign: 'center', color: C.mute, marginTop: 8 }}>{t('onboarding.tagline')}</Text>
      <Row style={{ justifyContent: 'center', marginVertical: 24 }}>
        {[1, 0, 0, 0].map((x, i) => <View key={i} style={[s.dot, x && { backgroundColor: C.deep }]} />)}
      </Row>
      <View style={{ width: '100%' }}>
        <Btn t={t('common.continueArrow')} onPress={next} />
      </View>
    </ScrollView>
  );
}