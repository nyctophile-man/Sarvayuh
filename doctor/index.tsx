// @ts-nocheck
import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { D, DOCTOR, useDoc, Avatar, Pill, card, fmt } from '@/lib/doctor';

export default function Home() {
  const r = useRouter(), ins = useSafeAreaInsets();
  const { apptsFor, inbox, pat, complete } = useDoc();
  const today = new Date(), hr = today.getHours();
  const all = apptsFor(today).filter((a) => a.pid);
  const next = all.find((a) => a.status === 'next');
  const upcoming = all.filter((a) => a.status !== 'done').slice(0, 4);
  const unread = inbox.filter((m) => m.unread).length, req = inbox.filter((m) => m.tag).length;
  const open = (id) => r.push({ pathname: '/(doctor)/patient', params: { id } });
  const start = () => { complete(next.key); open(next.pid); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: D.bg }} contentContainerStyle={{ padding: 18, paddingTop: ins.top + 14, paddingBottom: 30 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: D.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: D.teal, fontWeight: '800' }}>{DOCTOR.initials}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: D.mute, fontSize: 12 }}>{hr < 12 ? 'Good Morning,' : hr < 17 ? 'Good Afternoon,' : 'Good Evening,'}</Text>
          <Text style={{ color: D.ink, fontSize: 20, fontWeight: '800' }}>{DOCTOR.name}</Text>
        </View>
        <Pressable onPress={() => r.push('/(doctor)/inbox')}>
          <Ionicons name="notifications-outline" size={24} color={D.ink} />
          {unread > 0 && <View style={{ position: 'absolute', right: 0, top: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: D.red }} />}
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        {[[all.length, "Today's visits", '/(doctor)/calendar'], [req, 'New requests', '/(doctor)/inbox'], [unread, 'Unread', '/(doctor)/inbox']].map(([n, l, to], i) => (
          <Pressable key={l} onPress={() => r.push(to)} style={[card, { flex: 1, alignItems: 'center', marginBottom: 0, marginLeft: i ? 10 : 0 }]}>
            <Text style={{ color: D.teal, fontSize: 24, fontWeight: '800' }}>{n}</Text>
            <Text style={{ color: D.mute, fontSize: 11 }}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ color: D.ink, fontWeight: '800', marginBottom: 8 }}>Next appointment</Text>
      <View style={card}>
        {next ? (
          <>
            <Pressable onPress={() => open(next.pid)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={pat(next.pid).name} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: D.ink, fontWeight: '700', fontSize: 16 }}>{pat(next.pid).name}</Text>
                <Text style={{ color: D.mute, fontSize: 12 }}>{fmt(next.mins, true)} · {next.type.split(' · ')[0]} · {next.type.split(' · ')[1]}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={D.mute} />
            </Pressable>
            <Pressable onPress={start} style={{ backgroundColor: D.peach, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: D.ink, fontWeight: '800', fontSize: 16 }}>Start consult</Text>
            </Pressable>
          </>
        ) : <Text style={{ color: D.mute }}>No more appointments today 🎉</Text>}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: D.ink, fontWeight: '800', marginBottom: 8 }}>Needs attention</Text>
        <Pressable onPress={() => r.push('/(doctor)/inbox')}><Text style={{ color: D.teal, fontWeight: '700', fontSize: 12 }}>View all</Text></Pressable>
      </View>
      <View style={card}>
        {inbox.filter((m) => m.tag).map((m, i) => (
          <Pressable key={m.id} onPress={() => open(m.pid)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: D.line }}>
            <Avatar name={pat(m.pid).name} size={38} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: D.ink, fontWeight: '700' }}>{pat(m.pid).name}</Text>
              <Text style={{ color: D.mute, fontSize: 12 }}>{m.text}</Text>
            </View>
            {m.tag === 'urgent' ? <Pill t="Urgent" bg={D.redSoft} fg={D.red} /> : <Pill t="New" bg={D.peachSoft} fg="#c2570c" />}
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: D.ink, fontWeight: '800', marginBottom: 8 }}>Today's schedule</Text>
        <Pressable onPress={() => r.push('/(doctor)/calendar')}><Text style={{ color: D.teal, fontWeight: '700', fontSize: 12 }}>Calendar</Text></Pressable>
      </View>
      <View style={card}>
        {upcoming.length === 0 && <Text style={{ color: D.mute }}>Nothing left on the schedule.</Text>}
        {upcoming.map((a) => (
          <Pressable key={a.key} onPress={() => open(a.pid)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
            <View style={{ backgroundColor: D.peachSoft, borderRadius: 10, paddingVertical: 6, width: 82, alignItems: 'center' }}>
              <Text style={{ color: D.ink, fontWeight: '700', fontSize: 12 }}>{fmt(a.mins, true)}</Text>
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={{ color: D.ink, fontWeight: '700' }}>{pat(a.pid).name}</Text>
              <Text style={{ color: D.mute, fontSize: 12 }}>{a.type}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
