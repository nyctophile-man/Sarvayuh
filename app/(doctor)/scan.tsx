// @ts-nocheck
import React, { useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { D, useDoc } from '@/lib/doctor';
import { getDoctorPatients, getPublicShare, publicShareFileUrl } from '@/lib/api';

const Corner = ({ s }) => <View style={[{ position: 'absolute', width: 34, height: 34, borderColor: '#fff', borderRadius: 6 }, s]} />;

export default function Scan() {
  const r = useRouter(), ins = useSafeAreaInsets();
  const { refreshInbox, refreshPatients } = useDoc();
  const [perm, ask] = useCameraPermissions();
  const [mode, setMode] = useState('scan'), [torch, setTorch] = useState(false), [id, setId] = useState('');
  const locked = useRef(false);

  const lookup = async (raw) => {
    const shareMatch = /shares\/public\/([A-Za-z0-9_-]+)/i.exec(raw || '') ||
      /^([A-Fa-f0-9]{48})$/.exec(String(raw || '').trim());
    if (shareMatch) {
      try {
        const token = shareMatch[1];
        const manifest = await getPublicShare(token);
        const names = (manifest.records || []).map((record) => record.title).join(', ');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refreshInbox().catch(() => {});
        refreshPatients().catch(() => {});
        Alert.alert(
          'Shared records found',
          `${manifest.records?.length || 0} file(s): ${names || 'records'}`,
          [
            { text: 'Close', style: 'cancel', onPress: () => (locked.current = false) },
            {
              text: 'Open first file',
              onPress: () => {
                locked.current = false;
                const first = manifest.records?.[0];
                if (first) Linking.openURL(publicShareFileUrl(token, first.id)).catch(() => {});
              },
            },
          ],
        );
        return;
      } catch (error) {
        locked.current = false;
        Alert.alert('Could not open shared records', error instanceof Error ? error.message : 'Please check the QR code and try again.');
        return;
      }
    }

    const m = /SVH-\d{4}-\d{4}/i.exec(raw || '');
    if (!m) {
      Alert.alert('Invalid Health ID', 'Enter or scan a valid MedCard / Health ID.', [{ text: 'OK', onPress: () => (locked.current = false) }]);
      return;
    }
    try {
      const rows = await getDoctorPatients(m[0].toUpperCase());
      const patient = rows[0];
      if (!patient) {
        Alert.alert('Patient not connected', 'No active record share was found for this Health ID. Ask the patient to share their records with your doctor account.', [{ text: 'OK', onPress: () => (locked.current = false) }]);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Patient found', `Open ${patient.name}'s shared patient profile?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => (locked.current = false) },
        { text: 'Open profile', onPress: () => { locked.current = false; r.replace({ pathname: '/(doctor)/patient', params: { id: patient.id } }); } },
      ]);
    } catch (error) {
      locked.current = false;
      Alert.alert('Could not find patient', error instanceof Error ? error.message : 'Please check your connection and try again.');
    }
  };
  const onScan = ({ data }) => { if (locked.current) return; locked.current = true; lookup(data); };

  return (
    <View style={{ flex: 1, backgroundColor: '#0b1620' }}>
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: ins.top + 10, paddingHorizontal: 18 }}>
        <Pressable onPress={() => r.back()}><Ionicons name="arrow-back" size={24} color="#fff" /></Pressable>
        <Text style={{ flex: 1, color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 14 }}>Scan MedCard</Text>
        <Pressable onPress={() => setTorch(!torch)} style={{ backgroundColor: '#ffffff22', padding: 8, borderRadius: 12 }}>
          <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: '#ffffff1f', borderRadius: 14, margin: 18, padding: 4 }}>
        {[['scan', 'Scan QR'], ['id', 'Enter ID']].map(([k, l]) => (
          <Pressable key={k} onPress={() => setMode(k)} style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', backgroundColor: mode === k ? '#fff' : 'transparent' }}>
            <Text style={{ fontWeight: '700', color: mode === k ? D.teal : '#cfe0ea' }}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1, marginHorizontal: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: '#13242f', justifyContent: 'center' }}>
        {mode === 'scan' ? (
          perm?.granted ? (
            <>
              <CameraView style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
              <View style={{ flex: 1, margin: 36 }}>
                <Corner s={{ top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 }} />
                <Corner s={{ top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 }} />
                <Corner s={{ bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 }} />
                <Corner s={{ bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 }} />
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center', padding: 24 }}>
              <Ionicons name="camera-outline" size={40} color="#fff" />
              <Text style={{ color: '#fff', textAlign: 'center', marginVertical: 12 }}>Camera access is needed to scan a patient&apos;s MedCard.</Text>
              <Pressable onPress={ask} style={{ backgroundColor: D.peach, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 14 }}><Text style={{ fontWeight: '800', color: D.ink }}>Allow camera</Text></Pressable>
            </View>
          )
        ) : (
          <View style={{ padding: 22 }}>
            <Text style={{ color: '#cfe0ea', marginBottom: 10 }}>Enter the patient&apos;s Health ID</Text>
            <TextInput value={id} onChangeText={(v) => setId(v.toUpperCase())} autoCapitalize="characters" placeholder="SVH-0000-0000" placeholderTextColor="#7b93a3" style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, fontSize: 18, fontWeight: '700', color: D.ink, letterSpacing: 1 }} />
            <Pressable onPress={() => { locked.current = true; lookup(id); }} style={{ backgroundColor: D.peach, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 }}><Text style={{ fontWeight: '800', color: D.ink, fontSize: 16 }}>Find patient</Text></Pressable>
            <Text style={{ color: '#7b93a3', fontSize: 12, marginTop: 12 }}>Only patients who have shared records with you can be opened.</Text>
          </View>
        )}
      </View>

      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: 16, padding: 18, paddingBottom: ins.bottom + 16, alignItems: 'center' }}>
        <Ionicons name="shield-checkmark" size={26} color={D.teal} />
        <Text style={{ color: D.ink, fontWeight: '600', marginTop: 6 }}>Position the MedCard QR code within the frame</Text>
        <Text style={{ color: D.mute, fontSize: 12, marginTop: 8 }}>🔒 Secure · Encrypted · Patient Consent Required</Text>
      </View>
    </View>
  );
}
