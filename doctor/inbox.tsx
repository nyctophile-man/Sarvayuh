// @ts-nocheck
import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { D, useDoc, Avatar, Pill } from '@/lib/doctor';

export default function Inbox() {
  const r = useRouter(), ins = useSafeAreaInsets(), { inbox, pat, markRead } = useDoc();
  return (
    <View style={{ flex: 1, backgroundColor: D.bg, paddingTop: ins.top + 14 }}>
      <Text style={{ color: D.ink, fontSize: 28, fontWeight: '800', paddingHorizontal: 18 }}>Inbox</Text>
      <Text style={{ color: D.mute, paddingHorizontal: 18, marginBottom: 8 }}>{inbox.filter((m) => m.unread).length} unread</Text>
      <FlatList
        data={inbox} keyExtractor={(m) => m.id} contentContainerStyle={{ paddingHorizontal: 18 }}
        renderItem={({ item: m }) => (
          <Pressable onPress={() => { markRead(m.id); r.push({ pathname: '/(doctor)/patient', params: { id: m.pid } }); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: D.line }}>
            <Avatar name={pat(m.pid).name} size={44} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: D.ink, fontWeight: m.unread ? '800' : '600' }}>{pat(m.pid).name}</Text>
              <Text numberOfLines={1} style={{ color: D.mute, fontSize: 12 }}>{m.text}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: D.mute, fontSize: 11, marginBottom: 4 }}>{m.time}</Text>
              {m.tag === 'urgent' ? <Pill t="Urgent" bg={D.redSoft} fg={D.red} /> : m.unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: D.teal }} /> : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
