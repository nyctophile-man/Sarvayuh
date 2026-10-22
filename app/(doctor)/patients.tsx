// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { D, TAGS, Avatar, Pill, useDoc } from '@/lib/doctor';

const FILTERS = [['all', 'All'], ['new', 'Recently shared']];

export default function Patients() {
  const r = useRouter(), ins = useSafeAreaInsets();
  const [q, setQ] = useState(''), [f, setF] = useState('all');
  const { patients, patientsLoading, patientsError, refreshPatients } = useDoc();
  const list = patients.filter((p) => (f === 'all' || p.tag === f) && (p.name + p.healthId).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: D.bg, paddingTop: ins.top + 14 }}>
      <View style={{ paddingHorizontal: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: D.ink, fontSize: 28, fontWeight: '800' }}>My Patients</Text>
            <Text style={{ color: D.mute, marginBottom: 12 }}>{patients.length} patients who shared records with you</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh patients" onPress={() => refreshPatients().catch((error) => console.error('Doctor patient refresh failed:', error))} style={{ padding: 10 }}>
            <Ionicons name="refresh" size={20} color={D.teal} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: D.line, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={D.mute} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search by name or Health ID" placeholderTextColor={D.mute} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: D.ink }} />
        </View>
      </View>
      {!!patientsError && (
        <Pressable onPress={() => refreshPatients().catch((error) => console.error('Doctor patient refresh failed:', error))} style={{ marginHorizontal: 18, marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: D.redSoft }}>
          <Text style={{ color: D.red }}>{patientsError} · Tap to retry</Text>
        </Pressable>
      )}
      <View style={{ height: 52 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, alignItems: 'center' }}>
          {FILTERS.map(([k, l]) => (
            <Pressable key={k} onPress={() => { Haptics.selectionAsync(); setF(k); }} style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 18, marginRight: 8, backgroundColor: f === k ? D.teal : D.tealSoft }}>
              <Text style={{ color: f === k ? '#fff' : D.teal, fontWeight: '700', fontSize: 13 }}>{l}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={list} keyExtractor={(p) => p.id} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}
        ListEmptyComponent={<Text style={{ color: D.mute, textAlign: 'center', marginTop: 40 }}>{patientsLoading ? 'Loading patients…' : patientsError ? 'Unable to load patients' : 'No patients have shared records with you yet'}</Text>}
        renderItem={({ item: p }) => (
          <Pressable onPress={() => r.push({ pathname: '/(doctor)/patient', params: { id: p.id } })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: D.line }}>
            <Avatar name={p.name} size={46} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: D.ink, fontWeight: '700', fontSize: 15 }}>{p.name}</Text>
              <Text style={{ color: D.mute, fontSize: 12 }}>{p.healthId || 'Health ID unavailable'} · {p.last ? `Shared ${p.last}` : 'Recently shared'}</Text>
            </View>
            {p.tag ? <Pill t={TAGS[p.tag][0]} bg={TAGS[p.tag][1]} fg={TAGS[p.tag][2]} /> : <Ionicons name="chevron-forward" size={18} color={D.mute} />}
          </Pressable>
        )}
      />
    </View>
  );
}
