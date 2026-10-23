// @ts-nocheck
import { getAuthUser } from '@/lib/api';
import { D, DoctorProvider, useDoc } from '@/lib/doctor';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Bar({ state, navigation }) {
  const ins = useSafeAreaInsets(), r = useRouter();
  const { inbox } = useDoc();
  const cur = state.routes[state.index].name;
  if (!['index', 'patients', 'inbox', 'calendar'].includes(cur)) return null; // hide on scan / patient
  const item = (name, label, icon, unread = 0) => {
    const on = cur === name;
    return (
      <Pressable key={name} style={{ flex: 1, alignItems: 'center', paddingTop: 10 }} onPress={() => { const route = state.routes.find((rt) => rt.name === name); Haptics.selectionAsync(); if (route) navigation?.emit?.({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (cur !== name) r.navigate(name === 'index' ? '/(doctor)' : `/(doctor)/${name}`); }}>
        <View>
          <Ionicons name={on ? icon : icon + '-outline'} size={22} color={on ? D.teal : D.mute} />
          {unread > 0 && <View style={{ position: 'absolute', right: -3, top: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: D.red }} />}
        </View>
        <Text style={{ fontSize: 11, marginTop: 2, color: on ? D.teal : D.mute, fontWeight: on ? '700' : '500' }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: D.line, paddingBottom: Math.max(ins.bottom, 8), height: 62 + Math.max(ins.bottom, 8) }}>
      {item('index', 'Home', 'home')}
      {item('patients', 'Patients', 'people')}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); r.push('/(doctor)/scan'); }}
          style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: D.teal, alignItems: 'center', justifyContent: 'center', marginTop: -24, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
        >
          <Ionicons name="qr-code-outline" size={26} color="#fff" />
        </Pressable>
      </View>
      {item('inbox', 'Inbox', 'mail', inbox.filter((message) => message.unread).length)}
      {item('calendar', 'Calendar', 'calendar')}
    </View>
  );
}

export default function DoctorLayout() {
  const name = getAuthUser()?.name || 'Doctor';
  const doctor = { name, role: 'doctor' };
  return (
    <DoctorProvider doctor={doctor}>
      <Tabs tabBar={(p) => <Bar {...p} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="patients" />
        <Tabs.Screen name="inbox" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="scan" options={{ href: null }} />
        <Tabs.Screen name="patient" options={{ href: null }} />
      </Tabs>
    </DoctorProvider>
  );
}
