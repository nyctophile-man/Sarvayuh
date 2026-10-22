// @ts-nocheck
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity as T, ScrollView, Image, Alert,
  KeyboardAvoidingView, Platform, StyleSheet as S,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { C } from '@/constants/theme';
import { Btn } from '@/components/ui';
import { putProfile, uploadProfilePhoto } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';

// Works on both older and newer expo-image-picker versions
const IMAGES = ImagePicker.MediaType ? ['images'] : ImagePicker.MediaTypeOptions.Images;

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const ALLERGY_HINTS = ['Penicillin', 'Peanuts', 'Dust', 'Pollen', 'Sulfa drugs', 'Latex'];
const DISEASE_HINTS = ['Diabetes', 'Hypertension', 'Asthma', 'Thyroid', 'Heart disease', 'Arthritis'];
// Value sent to the backend + the translation key used for the label.
const GENDERS = [
  { value: 'Male', key: 'common.male' },
  { value: 'Female', key: 'common.female' },
  { value: 'Other', key: 'common.other' },
];

// Styled input with icon and focus highlight
const Input = ({ icon, focused, onFocus, onBlur, ...p }) => (
  <View style={[st.inputWrap, focused && st.inputFocused]}>
    <TextInput
      placeholderTextColor={C.mute}
      style={st.input}
      onFocus={onFocus}
      onBlur={onBlur}
      {...p}
    />
  </View>
);

// Tag input: type and add, or tap a suggestion
const TagInput = ({ icon, placeholder, items, setItems, hints, addLabel }) => {
  const [txt, setTxt] = useState('');
  const [f, setF] = useState(false);
  const add = (v) => {
    const t = (v ?? txt).trim();
    if (!t) return;
    if (items.some((x) => x.toLowerCase() === t.toLowerCase())) { setTxt(''); return; }
    setItems([...items, t]);
    setTxt('');
  };
  const remove = (v) => setItems(items.filter((x) => x !== v));
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={[st.inputWrap, f && st.inputFocused, { marginBottom: 8 }]}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={C.mute}
          value={txt}
          onChangeText={setTxt}
          onFocus={() => setF(true)}
          onBlur={() => setF(false)}
          onSubmitEditing={() => add()}
          returnKeyType="done"
          style={st.input}
        />
        <T onPress={() => add()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={st.addBtn}>{addLabel}</Text>
        </T>
      </View>

      {items.length > 0 && (
        <View style={st.tagWrap}>
          {items.map((x) => (
            <T key={x} onPress={() => remove(x)} style={st.tag} activeOpacity={0.8}>
              <Text style={st.tagText}>{x}</Text>
              <Text style={st.tagX}>  ✕</Text>
            </T>
          ))}
        </View>
      )}

      <View style={st.tagWrap}>
        {hints.filter((h) => !items.includes(h)).map((h) => (
          <T key={h} onPress={() => add(h)} style={st.hintChip} activeOpacity={0.8}>
            <Text style={st.hintText}>+ {h}</Text>
          </T>
        ))}
      </View>
    </View>
  );
};

export default function Setup() {
  const router = useRouter();
  const { t } = useI18n();
  const [photo, setPhoto] = useState(null);
  const [g, setG] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [blood, setBlood] = useState('');
  const [allergies, setAllergies] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(null);

  // ---------- Photo ----------
  const fromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('setup.permissionTitle'), t('setup.permissionBody'));
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: IMAGES, allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!r.canceled) setPhoto(r.assets[0]);
  };
  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('setup.permissionTitle'), t('setup.permissionBody'));
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled) setPhoto(r.assets[0]);
  };
  const pickPhoto = () => {
    const opts = [
      { text: t('setup.takePhoto'), onPress: fromCamera },
      { text: t('setup.chooseGallery'), onPress: fromGallery },
    ];
    if (photo) opts.push({ text: t('setup.removePhoto'), style: 'destructive', onPress: () => setPhoto(null) });
    opts.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('setup.photoTitle'), t('setup.photoBody'), opts);
  };

  // ---------- DOB: auto-format DD / MM / YYYY ----------
  const onDob = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    let out = d;
    if (d.length > 4) out = `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}`;
    else if (d.length > 2) out = `${d.slice(0, 2)} / ${d.slice(2)}`;
    setDob(out);
  };
  const dobISO = () => {
    const d = dob.replace(/\D/g, '');
    if (d.length !== 8) return null;
    const dd = +d.slice(0, 2), mm = +d.slice(2, 4), yy = +d.slice(4);
    const dt = new Date(yy, mm - 1, dd);
    const valid = dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd;
    if (!valid || dt > new Date() || yy < 1900) return null;
    return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  };

  // ---------- Save ----------
  const next = async () => {
    const iso = dobISO();
    if (!iso) return setErr(t('setup.errDob'));
    setErr('');
    setBusy(true);
    try {
      await putProfile({
        dob: iso,
        gender: g,
        phone,
        blood,
        allergies,
        conditions,
      });
      if (photo) {
        // The photo is uploaded separately (multipart, encrypted at rest).
        // A local file:// URI is not reachable by the server, so it is never sent as a field.
        try {
          await uploadProfilePhoto({
            uri: photo.uri,
            name: photo.fileName || 'avatar.jpg',
            type: photo.mimeType || 'image/jpeg',
          });
        } catch (pe) {
          console.log('photo upload failed', pe.message);
        }
      }
      router.replace('/(tabs)/home');
    } catch (e) {
      setErr(e.message || t('setup.errFailed'));
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
        contentContainerStyle={st.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={st.title}>{t('setup.title')}</Text>
        <Text style={st.sub}>{t('setup.subtitle')}</Text>

        {/* Photo */}
        <T onPress={pickPhoto} activeOpacity={0.85} style={st.photoWrap}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={st.photo} />
          ) : (
            <View style={[st.photo, st.photoEmpty]}>
              <Text style={{ fontSize: 36 }}>👤</Text>
            </View>
          )}
          <View style={st.camBadge}><Text style={{ fontSize: 14 }}>📷</Text></View>
        </T>
        <T onPress={pickPhoto}>
          <Text style={st.photoLink}>{photo ? t('setup.changePhoto') : t('setup.addPhoto')}</Text>
        </T>

        <View style={st.card}>
          {!!err && (
            <View style={st.errBox}>
              <Text style={{ marginRight: 8 }}>⚠️</Text>
              <Text style={st.errText}>{err}</Text>
            </View>
          )}

          <Text style={st.sec}>{t('setup.basicDetails')}</Text>

          <Text style={st.label}>{t('setup.dob')}</Text>
          <Input
            icon="🎂" placeholder="DD / MM / YYYY" value={dob} onChangeText={onDob}
            keyboardType="number-pad" maxLength={14}
            focused={focus === 'dob'} onFocus={() => setFocus('dob')} onBlur={() => setFocus(null)}
          />

          <Text style={st.label}>{t('setup.gender')}</Text>
          <View style={st.rowWrap}>
            {GENDERS.map((x) => (
              <T key={x.value} onPress={() => setG(x.value)} activeOpacity={0.85}
                style={[st.chip, g === x.value && st.chipOn]}>
                <Text style={[st.chipText, g === x.value && { color: '#fff' }]}>{t(x.key)}</Text>
              </T>
            ))}
          </View>

          <Text style={st.label}>{t('setup.phone')}</Text>
          <Input
            icon="📞" placeholder="+91 98765 43210" value={phone} onChangeText={setPhone}
            keyboardType="phone-pad"
            focused={focus === 'ph'} onFocus={() => setFocus('ph')} onBlur={() => setFocus(null)}
          />

          <Text style={st.label}>{t('setup.blood')}</Text>
          <View style={st.rowWrap}>
            {BLOOD.map((x) => (
              <T key={x} onPress={() => setBlood(blood === x ? '' : x)} activeOpacity={0.85}
                style={[st.chipSm, blood === x && st.chipOn]}>
                <Text style={[st.chipText, blood === x && { color: '#fff' }]}>{x}</Text>
              </T>
            ))}
          </View>

          <View style={st.divider} />
          <Text style={st.sec}>{t('setup.healthInfo')}</Text>
          <Text style={st.note}>{t('setup.note')}</Text>

          <Text style={st.label}>{t('setup.allergies')}</Text>
          <TagInput
            icon="🤧" placeholder={t('setup.allergyPlaceholder')} items={allergies}
            setItems={setAllergies} hints={ALLERGY_HINTS} addLabel={t('common.add')}
          />

          <Text style={st.label}>{t('setup.conditions')}</Text>
          <TagInput
            icon="🩺" placeholder={t('setup.conditionPlaceholder')} items={conditions}
            setItems={setConditions} hints={DISEASE_HINTS} addLabel={t('common.add')}
          />

          <Btn t={busy ? t('common.saving') : t('setup.continue')} disabled={busy} onPress={next} style={{ marginTop: 10 }} />

          <T onPress={() => router.replace('/(tabs)/home')} style={{ alignSelf: 'center', marginTop: 14 }}>
            <Text style={{ color: C.mute, fontWeight: '600' }}>{t('setup.skip')}</Text>
          </T>
        </View>

        <Text style={st.footer}>{t('setup.footer')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = S.create({
  scroll: { padding: 24, paddingTop: 56, paddingBottom: 40 },

  title: { fontSize: 24, fontWeight: '800', color: C.ink, textAlign: 'center' },
  sub: { color: C.mute, textAlign: 'center', marginTop: 4, marginBottom: 22, fontSize: 13 },

  photoWrap: { alignSelf: 'center' },
  photo: { width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: '#fff' },
  photoEmpty: {
    backgroundColor: '#E4EEF1', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  camBadge: {
    position: 'absolute', right: 0, bottom: 2, width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  photoLink: { textAlign: 'center', color: C.teal, fontWeight: '700', marginTop: 8, marginBottom: 18 },

  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  sec: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 10 },
  note: { color: C.mute, fontSize: 12, lineHeight: 17, marginBottom: 12, marginTop: -4 },
  divider: { height: 1, backgroundColor: '#E8EDF0', marginVertical: 18 },

  errBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEA', borderRadius: 12,
    padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#F5C6C0',
  },
  errText: { flex: 1, color: '#B3261E', fontSize: 13 },

  label: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 6, marginTop: 4, letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F8FA', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E3E8EC', paddingHorizontal: 14, height: 52, marginBottom: 12,
  },
  inputFocused: { borderColor: C.teal, backgroundColor: '#fff' },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 0 },
  addBtn: { color: C.teal, fontWeight: '700', fontSize: 14, marginLeft: 8 },

  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  chip: {
    paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, backgroundColor: '#F6F8FA',
    borderWidth: 1.5, borderColor: '#E3E8EC', marginRight: 8, marginBottom: 8,
  },
  chipSm: {
    minWidth: 56, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: '#F6F8FA', borderWidth: 1.5, borderColor: '#E3E8EC', marginRight: 8, marginBottom: 8,
  },
  chipOn: { backgroundColor: C.deep || C.teal, borderColor: C.deep || C.teal },
  chipText: { color: C.ink, fontWeight: '600', fontSize: 14 },

  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  tag: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F4F1', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 8,
  },
  tagText: { color: C.deep || C.teal, fontWeight: '700', fontSize: 13 },
  tagX: { color: C.deep || C.teal, fontSize: 11 },
  hintChip: {
    borderRadius: 20, borderWidth: 1, borderColor: '#D5DDE2', borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8,
  },
  hintText: { color: C.mute, fontSize: 12 },

  footer: { color: C.mute, fontSize: 12, textAlign: 'center', marginTop: 22 },
});