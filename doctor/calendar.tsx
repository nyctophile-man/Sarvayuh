// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { D, PATIENTS, useDoc, Avatar, Pill, fmt, dayKey } from '@/lib/doctor';

const DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monday = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const same = (a, b) => dayKey(a) === dayKey(b);

export default function Calendar() {
  const r = useRouter(), ins = useSafeAreaInsets(), { apptsFor, pat, book } = useDoc();
  const [sel, setSel] = useState(new Date()), [mode, setMode] = useState('week'), [slot, setSlot] = useState(null);
  const list = apptsFor(sel);
  const shift = (n) => { const x = new Date(sel); mode === 'week' ? x.setDate(x.getDate() + 7 * n) : x.setMonth(x.getMonth() + n); setSel(x); };

  const y = sel.getFullYear(), m = sel.getMonth();
  const days = mode === 'week'
    ? Array.from({ length: 7 }, (_, i) => { const x = monday(sel); x.setDate(x.getDate() + i); return x; })
    : [...Array((new Date(y, m, 1).getDay() + 6) % 7).fill(null), ...Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => new Date(y, m, i + 1))];

  return (
    <View style={{ flex: 1, backgroundColor: D.bg, paddingTop: ins.top + 14 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: D.ink, fontSize: 28, fontWeight: '800' }}>Appointments</Text>
          <Pressable onPress={() => setMode(mode === 'week' ? 'month' : 'week')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: D.tealSoft, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 12 }}>
            <Text style={{ color: D.teal, fontWeight: '700', textTransform: 'capitalize' }}>{mode} </Text>
            <Ionicons name="swap-vertical" size={14} color={D.teal} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 }}>
          <Text style={{ color: D.ink, fontSize: 17, fontWeight: '700' }}>{sel.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</Text>
          <View style={{ flexDirection: 'row' }}>
            <Pressable onPress={() => shift(-1)} style={{ padding: 6 }}><Ionicons name="chevron-back" size={20} color={D.ink} /></Pressable>
            <Pressable onPress={() => shift(1)} style={{ padding: 6 }}><Ionicons name="chevron-forward" size={20} color={D.ink} /></Pressable>
          </View>
        </View>

        {mode === 'month' && <View style={{ flexDirection: 'row' }}>{DN.map((d) => <Text key={d} style={{ width: '14.28%', textAlign: 'center', color: D.mute, fontSize: 11, marginBottom: 6 }}>{d}</Text>)}</View>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {days.map((d, i) => {
            if (!d) return <View key={i} style={{ width: '14.28%' }} />;
            const on = same(d, sel);
            return (
              <Pressable key={i} onPress={() => { Haptics.selectionAsync(); setSel(d); }} style={{ width: '14.28%', alignItems: 'center', marginBottom: mode === 'month' ? 6 : 0 }}>
                <View style={{ alignItems: 'center', paddingVertical: 8, width: 42, borderRadius: 14, backgroundColor: on ? D.teal : 'transparent' }}>
                  {mode === 'week' && <Text style={{ color: on ? '#cfe9f0' : D.mute, fontSize: 11 }}>{DN[i]}</Text>}
                  <Text style={{ color: on ? '#fff' : same(d, new Date()) ? D.teal : D.ink, fontWeight: '800', fontSize: 16 }}>{d.getDate()}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', marginVertical: 14 }}>
          <Pill t={`${list.filter((a) => a.pid).length} appointments`} bg={D.tealSoft} fg={D.teal} />
          <View style={{ width: 8 }} />
          <Pill t={`${list.filter((a) => !a.pid && a.status !== 'done').length} free slots`} bg={D.greenSoft} fg={D.green} />
        </View>

        {list.map((a) => {
          const p = a.pid && pat(a.pid), isNext = a.status === 'next';
          return (
            <View key={a.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ width: 52, color: isNext ? D.teal : D.ink, fontWeight: '700' }}>{fmt(a.mins)}</Text>
              {p ? (
                <Pressable onPress={() => r.push({ pathname: '/(doctor)/patient', params: { id: p.id } })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: isNext ? D.tealSoft : '#fff', borderWidth: isNext ? 1.5 : 1, borderColor: isNext ? D.teal : D.line }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: D.ink, fontWeight: '700' }}>{p.name}</Text>
                    <Text style={{ color: D.mute, fontSize: 12 }}>{a.type}</Text>
                  </View>
                  {a.status === 'done' ? <Pill t="Done" bg={D.greenSoft} fg={D.green} /> : isNext ? <Pill t="Next" bg={D.teal} fg="#fff" /> : <Ionicons name="chevron-forward" size={18} color={D.mute} />}
                </Pressable>
              ) : (
                <Pressable disabled={a.status === 'done'} onPress={() => setSlot(a)} style={{ flex: 1, padding: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: D.teal + '66', opacity: a.status === 'done' ? 0.4 : 1 }}>
                  <Text style={{ color: D.teal, fontWeight: '600' }}>Free slot · tap to book</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!slot} transparent animationType="slide" onRequestClose={() => setSlot(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }} onPress={() => setSlot(null)}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 30, maxHeight: '70%' }}>
            <Text style={{ color: D.ink, fontWeight: '800', fontSize: 17, marginBottom: 10 }}>Book {slot && fmt(slot.mins, true)} for…</Text>
            <ScrollView>
              {PATIENTS.map((p) => (
                <Pressable key={p.id} onPress={() => { book(sel, slot.mins, p.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setSlot(null); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                  <Avatar name={p.name} size={38} /><Text style={{ marginLeft: 12, color: D.ink, fontWeight: '600' }}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
