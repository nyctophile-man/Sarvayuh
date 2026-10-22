// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { D, PATIENTS, TAGS, Avatar, Pill } from '@/lib/doctor';

const FILTERS = [['all', 'All'], ['followup', 'Follow-up due'], ['new', 'New'], ['flagged', 'Flagged']];

export default function Patients() {
  const r = useRouter(), ins = useSafeAreaInsets();
  const [q, setQ] = useState(''), [f, setF] = useState('all');
  const list = PATIENTS.filter((p) => (f === 'all' || p.tag === f) && (p.name + p.healthId).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: D.bg, paddingTop: ins.top + 14 }}>
      <View style={{ paddingHorizontal: 18 }}>
        <Text style={{ color: D.ink, fontSize: 28, fontWeight: '800' }}>My Patients</Text>
        <Text style={{ color: D.mute, marginBottom: 12 }}>{PATIENTS.length} patients</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: D.line, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={D.mute} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search by name or Health ID" placeholderTextColor={D.mute} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: D.ink }} />
        </View>
      </View>
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
        ListEmptyComponent={<Text style={{ color: D.mute, textAlign: 'center', marginTop: 40 }}>No patients found</Text>}
        renderItem={({ item: p }) => (
          <Pressable onPress={() => r.push({ pathname: '/(doctor)/patient', params: { id: p.id } })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: D.line }}>
            <Avatar name={p.name} size={46} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: D.ink, fontWeight: '700', fontSize: 15 }}>{p.name}</Text>
              <Text style={{ color: D.mute, fontSize: 12 }}>{p.age} · {p.sex} · {p.last ? `Last visit ${p.last}` : 'First visit'}</Text>
            </View>
            {p.tag ? <Pill t={TAGS[p.tag][0]} bg={TAGS[p.tag][1]} fg={TAGS[p.tag][2]} /> : <Ionicons name="chevron-forward" size={18} color={D.mute} />}
          </Pressable>
        )}
      />
    </View>
  );
}
