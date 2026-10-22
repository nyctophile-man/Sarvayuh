// @ts-nocheck
import React, { createContext, useContext, useState } from 'react';
import { View, Text } from 'react-native';

/* ---------- theme ---------- */
export const D = {
  bg: '#f2f8fb', card: '#fff', ink: '#0f2a3d', mute: '#6b8294', line: '#e3edf3',
  teal: '#0b5d78', tealSoft: '#e3f3f7', peach: '#ffb27a', peachSoft: '#fdebdc',
  red: '#e5484d', redSoft: '#fde8e8', green: '#2f9e6b', greenSoft: '#e2f5ec', amber: '#b7791f', amberSoft: '#fdf1d6',
};
export const DOCTOR = { name: 'Dr. Priya Nair', initials: 'PN' };

/* ---------- mock data (replace with your API) ---------- */
export const PATIENTS = [
  { id: 'p1', healthId: 'SVH-6401-4442', name: 'Aarav Sharma', age: 34, sex: 'M', last: '12 Oct', tag: 'followup', blood: 'B+', phone: '+911234567890', conditions: ['Hypertension'] },
  { id: 'p2', healthId: 'SVH-2210-1187', name: 'Sunita Rao', age: 52, sex: 'F', last: '02 Oct', tag: 'new', blood: 'O+', phone: '+919800000002', conditions: ['Diabetes T2', 'Thyroid'] },
  { id: 'p3', healthId: 'SVH-7733-0921', name: 'Rohan Mehta', age: 29, sex: 'M', last: null, tag: 'flagged', blood: 'A+', phone: '+919800000003', conditions: ['Fever (3 days)'] },
  { id: 'p4', healthId: 'SVH-5120-3345', name: 'Kavya Iyer', age: 41, sex: 'F', last: '28 Sep', tag: null, blood: 'AB+', phone: '+919800000004', conditions: [] },
  { id: 'p5', healthId: 'SVH-8842-6610', name: 'Imran Khan', age: 63, sex: 'M', last: '15 Sep', tag: 'followup', blood: 'B-', phone: '+919800000005', conditions: ['Arthritis', 'BP'] },
  { id: 'p6', healthId: 'SVH-3095-7712', name: 'Neha Verma', age: 27, sex: 'F', last: '09 Sep', tag: null, blood: 'O-', phone: '+919800000006', conditions: [] },
  { id: 'p7', healthId: 'SVH-9087-2254', name: 'Arjun Patel', age: 58, sex: 'M', last: '01 Sep', tag: null, blood: 'A-', phone: '+919800000007', conditions: ['Cholesterol'] },
];
export const TAGS = {
  followup: ['Follow-up due', D.amberSoft, D.amber],
  new: ['New records', D.peachSoft, '#c2570c'],
  flagged: ['Flagged', D.redSoft, D.red],
};
const INBOX = [
  { id: 'm1', pid: 'p3', text: 'Chat consult request · fever, 3 days', time: '10m', tag: 'urgent', unread: true },
  { id: 'm2', pid: 'p2', text: 'Shared 3 records · Blood Test, MRI', time: '1h', tag: 'new', unread: true },
  { id: 'm3', pid: 'p1', text: 'BP readings attached for review', time: '3h', tag: null, unread: true },
  { id: 'm4', pid: 'p5', text: 'Can we move my follow-up to Friday?', time: 'Yesterday', tag: null, unread: false },
];
const TYPES = ['Check-up · In clinic', 'Follow-up · Video', 'Chat consult · Video', 'Follow-up · In clinic', 'Check-up · Video'];
const SLOTS = [540, 630, 675, 720, 840]; // minutes from midnight

export const fmt = (m, ampm) => {
  const h = Math.floor(m / 60), s = `${h % 12 || 12}:${String(m % 60).padStart(2, '0')}`;
  return ampm ? `${s} ${h >= 12 ? 'PM' : 'AM'}` : s;
};
export const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/* ---------- shared state ---------- */
const Ctx = createContext(null);
export const useDoc = () => useContext(Ctx);

export function DoctorProvider({ children }) {
  const [booked, setBooked] = useState({}), [done, setDone] = useState({}), [inbox, setInbox] = useState(INBOX);
  const pat = (id) => PATIENTS.find((p) => p.id === id);

  const apptsFor = (date) => {
    const now = new Date(), diff = startOf(date) - startOf(now), nowM = now.getHours() * 60 + now.getMinutes();
    let nextTaken = false;
    return SLOTS.map((mins, i) => {
      const key = `${dayKey(date)}|${mins}`;
      const pid = booked[key] || (i === 2 ? null : PATIENTS[(date.getDate() + i) % PATIENTS.length].id);
      let status = 'upcoming';
      if (diff < 0 || done[key] || (diff === 0 && mins < nowM)) status = 'done';
      else if (diff === 0 && pid && !nextTaken) { status = 'next'; nextTaken = true; }
      return { key, mins, pid, status, type: TYPES[(date.getDate() + i) % TYPES.length] };
    });
  };
  const book = (date, mins, pid) => setBooked((b) => ({ ...b, [`${dayKey(date)}|${mins}`]: pid }));
  const complete = (key) => setDone((d) => ({ ...d, [key]: true }));
  const markRead = (id) => setInbox((l) => l.map((m) => (m.id === id ? { ...m, unread: false } : m)));

  return <Ctx.Provider value={{ pat, apptsFor, book, complete, inbox, markRead }}>{children}</Ctx.Provider>;
}

/* ---------- small UI ---------- */
const AV = ['#fde3d0', '#e2f0f7', '#e5f3e8', '#f1e4f5', '#fff2cc'];
export const Avatar = ({ name, size = 42 }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: AV[name.length % AV.length], alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: D.ink, fontWeight: '700', fontSize: size * 0.34 }}>{name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</Text>
  </View>
);
export const Pill = ({ t, bg, fg }) => (
  <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
    <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{t}</Text>
  </View>
);
export const card = { backgroundColor: D.card, borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: D.line };
