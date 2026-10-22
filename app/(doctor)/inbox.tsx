// @ts-nocheck
import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { D, useDoc, Avatar, Pill } from '@/lib/doctor';

export default function Inbox() {
  const r = useRouter(), ins = useSafeAreaInsets();
  const { inbox, inboxLoading, inboxError, refreshInbox, markRead } = useDoc();
  return (
    <View style={{ flex: 1, backgroundColor: D.bg, paddingTop: ins.top + 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }}>
        <Text style={{ color: D.ink, fontSize: 28, fontWeight: '800' }}>Inbox</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh inbox" onPress={() => refreshInbox().catch((error) => console.error('Doctor inbox refresh failed:', error))} style={{ padding: 10 }}>
          <Text style={{ color: D.teal, fontWeight: '700' }}>↻</Text>
        </Pressable>
      </View>
      <Text style={{ color: D.mute, paddingHorizontal: 18, marginBottom: 8 }}>{inbox.filter((m) => m.unread).length} unread · patient sharing activity</Text>
      {!!inboxError && (
        <Pressable onPress={() => refreshInbox().catch((error) => console.error('Doctor inbox refresh failed:', error))} style={{ marginHorizontal: 18, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: D.redSoft }}>
          <Text style={{ color: D.red }}>{inboxError} · Tap to retry</Text>
        </Pressable>
      )}
      <FlatList
        data={inbox} keyExtractor={(m) => m.id} contentContainerStyle={{ paddingHorizontal: 18 }}
        ListEmptyComponent={<Text style={{ color: D.mute, textAlign: 'center', marginTop: 40 }}>{inboxLoading ? 'Loading inbox…' : inboxError ? 'Unable to load inbox' : 'No patient sharing activity yet'}</Text>}
        renderItem={({ item: m }) => (
          <Pressable onPress={() => {
            markRead(m.id).catch((error) => console.error('Could not mark doctor inbox item as read:', error));
            r.push({ pathname: '/(doctor)/patient', params: { id: m.pid } });
          }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: D.line }}>
            <Avatar name={m.patient_name} size={44} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: D.ink, fontWeight: m.unread ? '800' : '600' }}>{m.patient_name}</Text>
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
