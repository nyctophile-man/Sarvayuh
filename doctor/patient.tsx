// @ts-nocheck
import React from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { D, TAGS, useDoc, Avatar, Pill, card } from '@/lib/doctor';

export default function Patient() {
  const r = useRouter(), ins = useSafeAreaInsets(), { id } = useLocalSearchParams(), { pat } = useDoc();
  const p = pat(id);
  if (!p) return <View style={{ flex: 1, backgroundColor: D.bg }} />;
  const row = (icon, l, v) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <Ionicons name={icon} size={18} color={D.teal} />
      <Text style={{ color: D.mute, marginLeft: 10, width: 90 }}>{l}</Text>
      <Text style={{ color: D.ink, fontWeight: '600' }}>{v}</Text>
    </View>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: D.bg }} contentContainerStyle={{ padding: 18, paddingTop: ins.top + 10, paddingBottom: 40 }}>
      <Pressable onPress={() => r.back()} style={{ marginBottom: 12 }}><Ionicons name="arrow-back" size={24} color={D.ink} /></Pressable>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <Avatar name={p.name} size={84} />
        <Text style={{ color: D.ink, fontSize: 22, fontWeight: '800', marginTop: 10 }}>{p.name}</Text>
        <Text style={{ color: D.mute, marginBottom: 8 }}>{p.age} yrs · {p.sex === 'M' ? 'Male' : 'Female'} · {p.last ? `Last visit ${p.last}` : 'First visit'}</Text>
        {p.tag && <Pill t={TAGS[p.tag][0]} bg={TAGS[p.tag][1]} fg={TAGS[p.tag][2]} />}
      </View>
      <View style={card}>
        {row('id-card-outline', 'Health ID', p.healthId)}
        {row('water-outline', 'Blood group', p.blood)}
        {row('call-outline', 'Phone', p.phone)}
      </View>
      <Text style={{ color: D.ink, fontWeight: '800', marginBottom: 8 }}>Conditions</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 }}>
        {p.conditions.length ? p.conditions.map((c) => <View key={c} style={{ backgroundColor: D.tealSoft, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 16, marginRight: 8, marginBottom: 8 }}><Text style={{ color: D.teal, fontWeight: '600' }}>{c}</Text></View>) : <Text style={{ color: D.mute }}>None recorded</Text>}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Pressable onPress={() => Linking.openURL(`tel:${p.phone}`)} style={{ flex: 1, backgroundColor: D.peach, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginRight: 8 }}>
          <Text style={{ color: D.ink, fontWeight: '800' }}>📞 Call</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`sms:${p.phone}`)} style={{ flex: 1, backgroundColor: D.teal, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>💬 Message</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
