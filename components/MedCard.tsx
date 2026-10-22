// @ts-nocheck
import Logo from '@/components/Logo';
import { Btn, Row } from '@/components/ui';
import { useI18n } from '@/lib/i18n/context';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect, Path } from 'react-native-svg';

// ---- card data (used as placeholder when no real user data is passed) ----
const CARD = {
  name: '',
  id: 'SVH-6401-4442',
  gender: '',
  blood: 'B+',
  dob: '',
  emergency: '+91 1234567890',
  qr: 'https://sarvayuh.app/h/SVH-6401-4442',
};

const RATIO = 1587 / 991; // same proportion as your design

// Normalizes whatever the caller passes into the fields the card faces render.
const toCardData = (user, t, locale) => {
  if (!user) return {
    ...CARD,
    name: t('common.guest'),
    gender: t('common.male'),
    dob: new Date(2006, 10, 1).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
    emergencyName: '',
    emergencyPhone: CARD.emergency,
    allergies: '',
  };
  const gender = user.gender;
  const genderKey = String(gender ?? '').toLowerCase();
  const genderLabel =
    genderKey === 'male' || genderKey === 'female' || genderKey === 'other'
      ? t(`common.${genderKey}`)
      : gender || t('common.notAdded');
  const notAdded = t('common.notAdded');
  const emergencyName = user?.emergencyName && user.emergencyName !== notAdded ? user.emergencyName : '';
  const emergencyPhone = user?.emergencyPhone && user.emergencyPhone !== notAdded ? user.emergencyPhone : '';
  const dob = user?.dob ? new Date(user.dob) : null;
  const formattedDob = dob && !Number.isNaN(dob.getTime())
    ? dob.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    : user?.dob || t('common.notAdded');
  const allergies = Array.isArray(user?.allergies) ? user.allergies.join(', ') : user?.allergies || '';
  return {
    name: user?.name || t('common.notAdded'),
    id: user?.cardId || user?.card_id || CARD.id,
    gender: genderLabel,
    blood: user?.blood || t('common.notAdded'),
    dob: formattedDob,
    emergencyName,
    emergencyPhone,
    allergies,
    qr: user?.qr || `https://sarvayuh.app/h/${user?.cardId || user?.card_id || CARD.id}`,
  };
};

/* ------------------------- FRONT ------------------------- */
function Front({ w, h, card = CARD }) {
  const { t } = useI18n();
  const u = w / 100; // 1 unit = 1% of card width, so everything scales
  return (
    <LinearGradient
      colors={['#041f4f', '#06316b', '#0a7ab5', '#17c3d6']}
      locations={[0, 0.4, 0.8, 1]}
      start={{ x: 0, y: 0.3 }}
      end={{ x: 1, y: 0.7 }}
      style={{ width: w, height: h, borderRadius: 4 * u, overflow: 'hidden' }}
    >
      {/* big faded lotus on the right */}
      <View style={{ position: 'absolute', right: -4 * u, top: 12 * u, opacity: 0.28 }}>
        <Logo variant="white" width={48 * u} title="" />
      </View>

      {/* bottom light wave */}
      <View
        style={{
          position: 'absolute', left: -10 * u, right: -10 * u, bottom: -14 * u,
          height: 20 * u, borderRadius: 50 * u,
          borderTopWidth: 0.4 * u, borderColor: '#3fd8ff', backgroundColor: 'rgba(23,195,214,0.18)',
        }}
      />

      {/* logo top-left */}
      <View style={{ position: 'absolute', left: 7 * u, top: 8 * u }}>
        <Logo variant="white" width={26 * u} title="SARVAYUH" />
      </View>

      {/* top-right label */}
      <Text style={{ position: 'absolute', right: 7 * u, top: 7 * u, color: '#fff', fontSize: 2.6 * u, letterSpacing: 0.3 * u, fontWeight: '600' }}>
        {t('medcard.healthId')}
      </Text>

      {/* name + id */}
      <Text style={{ position: 'absolute', left: 10 * u, top: 29 * u, color: '#fff', fontSize: 5.4 * u }}>{card.name}</Text>
      <Text style={{ position: 'absolute', left: 10.5 * u, top: 40 * u, color: '#fff', fontSize: 2.8 * u }}>{card.id}</Text>

      {/* bottom info row */}
      <View style={{ position: 'absolute', left: 10 * u, right: 7 * u, bottom: 8 * u, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Info u={u} icon="person" label={t('medcard.gender')} value={card.gender} circle />
        <Info u={u} icon="water-outline" label={t('medcard.blood')} value={card.blood} />
        <Info u={u} icon="calendar-outline" label={t('medcard.dob')} value={card.dob} />
      </View>
    </LinearGradient>
  );
}

function Info({ u, icon, label, value, circle }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: 6 * u, height: 6 * u, borderRadius: 3 * u,
          backgroundColor: circle ? '#041f4f' : 'transparent',
          alignItems: 'center', justifyContent: 'center', marginRight: 2 * u,
        }}
      >
        <Ionicons name={icon} size={4.4 * u} color="#fff" />
      </View>
      <View>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 2.9 * u }}>{label}</Text>
        <Text style={{ color: '#fff', fontSize: 2.6 * u, fontFamily: 'serif' }}>{value}</Text>
      </View>
    </View>
  );
}

/* ------------------------- BACK (redesigned) ------------------------- */
const BACK_H = 100 / RATIO; // card height inside the 100-wide SVG space
const EDGE = `M73 0 C66 12 59 24 61 33 C63 43 67 54 71 ${BACK_H}`; // curved edge of the dark panel
const INK = '#0b2a5b', MUTE = '#5f7896';

function Back({ w, h, card = CARD }) {
  const { t } = useI18n();
  const u = w / 100;
  const hasContact = !!(card.emergencyName || card.emergencyPhone);
  return (
    <View style={{ width: w, height: h, borderRadius: 4 * u, overflow: 'hidden', backgroundColor: '#f3faff' }}>
      {/* background art: light gradient + dark curved panel */}
      <Svg width={w} height={h} viewBox={`0 0 100 ${BACK_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          <SvgGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#ffffff" />
            <Stop offset="0.55" stopColor="#eaf6ff" />
            <Stop offset="1" stopColor="#cdeeff" />
          </SvgGradient>
          <SvgGradient id="dk" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0b4f94" />
            <Stop offset="1" stopColor="#041f4f" />
          </SvgGradient>
        </Defs>
        <Rect width="100" height={BACK_H} fill="url(#bg)" />
        <Path d={`${EDGE} L100 ${BACK_H} L100 0 Z`} fill="url(#dk)" />
        <Path d={EDGE} fill="none" stroke="#18c9ff" strokeOpacity={0.35} strokeWidth={2.6} />
        <Path d={EDGE} fill="none" stroke="#18c9ff" strokeWidth={0.7} />
      </Svg>

      {/* LEFT: identity + emergency info (flex layout, so nothing overlaps) */}
      <View style={{ position: 'absolute', left: 6 * u, top: 6 * u, bottom: 5.5 * u, width: 52 * u, justifyContent: 'space-between' }}>
        <View>
          <Logo variant="color" width={19 * u} title="SARVAYUH" />
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: INK, fontSize: 5.2 * u, fontWeight: '700', marginTop: 3.2 * u }}>
            {card.name}
          </Text>
          <View style={{ alignSelf: 'flex-start', marginTop: 1.4 * u, backgroundColor: '#dcefff', borderRadius: 1.6 * u, paddingHorizontal: 2 * u, paddingVertical: 0.7 * u }}>
            <Text style={{ color: INK, fontSize: 3 * u, fontWeight: '700', letterSpacing: 0.25 * u }}>{card.id}</Text>
          </View>
        </View>

        <View>
          <Text style={{ color: MUTE, fontSize: 2.4 * u, fontWeight: '700', letterSpacing: 0.3 * u }}>
            {String(t('medcard.emergencyContact')).toUpperCase()}
          </Text>
          {hasContact ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 0.8 * u }}>
              <Ionicons name="call" size={3.6 * u} color="#1f7ae0" />
              <View style={{ marginLeft: 1.6 * u, flexShrink: 1 }}>
                {!!card.emergencyName && <Text numberOfLines={1} style={{ color: INK, fontSize: 3 * u, fontWeight: '600' }}>{card.emergencyName}</Text>}
                {!!card.emergencyPhone && <Text numberOfLines={1} style={{ color: INK, fontSize: 3.6 * u, fontWeight: '700' }}>{card.emergencyPhone}</Text>}
              </View>
            </View>
          ) : (
            <Text style={{ color: MUTE, fontSize: 3 * u, marginTop: 0.8 * u }}>{t('common.notAdded')}</Text>
          )}

          {/* blood group + allergies chips */}
          <View style={{ flexDirection: 'row', marginTop: 2 * u, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffe5e5', borderRadius: 2 * u, paddingHorizontal: 2 * u, paddingVertical: 0.8 * u, marginRight: 1.6 * u }}>
              <Ionicons name="water" size={3 * u} color="#d93636" />
              <Text style={{ color: '#b42323', fontSize: 3 * u, fontWeight: '800', marginLeft: 0.8 * u }}>{card.blood}</Text>
            </View>
            {!!card.allergies && (
              <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3d6', borderRadius: 2 * u, paddingHorizontal: 2 * u, paddingVertical: 0.8 * u }}>
                <Ionicons name="medkit" size={3 * u} color="#a86a00" />
                <Text numberOfLines={1} style={{ flexShrink: 1, color: '#8a5a00', fontSize: 2.6 * u, fontWeight: '700', marginLeft: 0.8 * u }}>{card.allergies}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="shield-checkmark" size={7.2 * u} color="#2f7fe0" />
          <View style={{ marginLeft: 1.6 * u, flexShrink: 1 }}>
            <Text style={{ color: INK, fontWeight: '800', fontSize: 3.3 * u }}>{t('medcard.inEmergency')}</Text>
            <Text numberOfLines={2} style={{ color: MUTE, fontSize: 2.4 * u }}>{t('medcard.scanQr')}</Text>
          </View>
        </View>
      </View>

      {/* RIGHT: QR on the dark panel */}
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 32 * u, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#bfe3ff', fontSize: 2.2 * u, letterSpacing: 0.35 * u, textAlign: 'center', marginBottom: 2.4 * u, lineHeight: 3.4 * u }}>
          {t('medcard.scanToAccess')}
        </Text>
        <View style={{ backgroundColor: '#fff', padding: 1.8 * u, borderRadius: 2.4 * u }}>
          <QRCode value={card.qr} size={19 * u} ecl="H" quietZone={0} />
        </View>
        <Text style={{ color: '#7fb4e6', fontSize: 2 * u, marginTop: 2 * u }}>sarvayuh.app</Text>
      </View>
    </View>
  );
}

/* ------------------------- FLIP CARD ------------------------- */
function FlipCard({ user, onPress: onPressProp }) {
  const { width: sw } = useWindowDimensions();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const w = Math.min(sw - 48, 420);
  const h = w / RATIO;

  const flip = useRef(new Animated.Value(0)).current;   // 0 = front, 1 = back
  const intro = useRef(new Animated.Value(0)).current;  // entrance
  const flipped = useRef(false);
  const [busy, setBusy] = useState(false);
  const card = toCardData(user, t, locale);

  const flipTo = (to) => {
    setBusy(true);
    Animated.timing(flip, {
      toValue: to, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
    }).start(() => { flipped.current = !!to; setBusy(false); });
  };

  useFocusEffect(
    useCallback(() => {
      flip.setValue(0); intro.setValue(0); flipped.current = false;
      const a = Animated.timing(intro, { toValue: 1, duration: 700, delay: 200, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true });
      a.start();
      const t = setTimeout(() => flipTo(1), 1500); // auto flip front -> back
      return () => { a.stop(); clearTimeout(t); };
    }, [])
  );

  const toggle = () => { if (!busy) flipTo(flipped.current ? 0 : 1); };
  const onPress = () => { if (onPressProp) onPressProp(); else toggle(); };

  // eslint-disable-next-line react-hooks/refs -- Animated.Value, not a React ref
  const frontRot = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  // eslint-disable-next-line react-hooks/refs -- Animated.Value, not a React ref
  const backRot = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  // eslint-disable-next-line react-hooks/refs -- Animated.Value, not a React ref
  const scale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  // eslint-disable-next-line react-hooks/refs -- Animated.Value, not a React ref
  const translateY = intro.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  // eslint-disable-next-line react-hooks/refs -- Animated.Value, not a React ref
  const opacity = intro.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' });

  const face = { position: 'absolute', backfaceVisibility: 'hidden' };
  const shadow = { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 10 };

  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center' }}>
      <Animated.View style={{ width: w, height: h, opacity, transform: [{ translateY }, { scale }] }}>
        <Animated.View style={[face, shadow, { transform: [{ perspective: 1000 }, { rotateY: frontRot }] }]}>
          <Front w={w} h={h} card={card} />
        </Animated.View>
        <Animated.View style={[face, shadow, { transform: [{ perspective: 1000 }, { rotateY: backRot }] }]}>
          <Back w={w} h={h} card={card} />
        </Animated.View>
      </Animated.View>
      {!onPressProp && <Text style={{ color: colors.mute, fontSize: 12, marginTop: 14 }}>{t('medcard.tapToFlip')}</Text>}
    </Pressable>
  );
}

// Public component used by Home and the MedCard tab: a flippable card fed by
// live user data (falls back to the sample data above when nothing is passed).
export function MedCard(props) {
  const { user, onPress } = props;
  return <FlipCard user={user} onPress={onPress} />;
}


function Onboard() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors, styles } = useTheme();
  const next = () => router.push('/(auth)/terms');
  return (
    <ScrollView
      style={styles.full}
      contentContainerStyle={{ padding: 24, paddingTop: 70, paddingBottom: 40, flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <FlipCard />
      <Text style={{ textAlign: 'center', color: colors.mute, marginTop: 20 }}>{t('onboarding.welcomeTo')}</Text>
      <Text style={[styles.logo, { color: colors.deep, fontSize: 30, textAlign: 'center' }]}>SARVAYUH</Text>
      <Text style={{ textAlign: 'center', color: colors.mute, marginTop: 8 }}>{t('onboarding.tagline')}</Text>
      <Row style={{ justifyContent: 'center', marginVertical: 24 }}>
        {[1, 0, 0, 0].map((x, i) => <View key={i} style={[styles.dot, x && { backgroundColor: colors.deep }]} />)}
      </Row>
      <View style={{ width: '100%' }}>
        <Btn t={t('common.continueArrow')} onPress={next} />
      </View>
    </ScrollView>
  );
}