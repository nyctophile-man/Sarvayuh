// @ts-nocheck
import React, { createContext, useContext, useState } from 'react';
import { View, Text } from 'react-native';
import {
  createDoctorAppointment,
  completeDoctorAppointment,
  getDoctorAppointments,
  getDoctorInbox,
  getDoctorPatients,
  markDoctorInboxRead,
} from './api';

/* ---------- theme ---------- */
export const D = {
  bg: '#f2f8fb', card: '#fff', ink: '#0f2a3d', mute: '#6b8294', line: '#e3edf3',
  teal: '#0b5d78', tealSoft: '#e3f3f7', peach: '#ffb27a', peachSoft: '#fdebdc',
  red: '#e5484d', redSoft: '#fde8e8', green: '#2f9e6b', greenSoft: '#e2f5ec', amber: '#b7791f', amberSoft: '#fdf1d6',
};
const DEFAULT_DOCTOR = { name: 'Doctor' };
export const TAGS = {
  new: ['Recently shared', D.peachSoft, '#c2570c'],
};
const SLOTS = [540, 630, 675, 720, 840]; // minutes from midnight

export const fmt = (m, ampm) => {
  const h = Math.floor(m / 60), s = `${h % 12 || 12}:${String(m % 60).padStart(2, '0')}`;
  return ampm ? `${s} ${h >= 12 ? 'PM' : 'AM'}` : s;
};
export const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dateString = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ageFromDob = (dob) => {
  if (!dob) return null;
  const born = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  return now.getFullYear() - born.getFullYear() -
    (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate()) ? 1 : 0);
};
const relativeTime = (date) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 2880) return 'Yesterday';
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
const normalizePatient = (patient) => ({
  ...patient,
  healthId: patient.health_id,
  age: ageFromDob(patient.dob),
  sex: patient.gender || '',
  conditions: patient.conditions ? patient.conditions.split(',').map((value) => value.trim()).filter(Boolean) : [],
  last: patient.last_shared_at ? new Date(patient.last_shared_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : null,
  tag: patient.last_shared_at && Date.now() - new Date(patient.last_shared_at).getTime() < 7 * 86400000 ? 'new' : null,
});

/* ---------- shared state ---------- */
const Ctx = createContext(null);
export const useDoc = () => useContext(Ctx);

export function DoctorProvider({ children, doctor = DEFAULT_DOCTOR }) {
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState('');
  const [inbox, setInbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState('');
  const [appointmentsByDate, setAppointmentsByDate] = useState({});
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState('');

  const refreshPatients = async () => {
    setPatientsLoading(true);
    setPatientsError('');
    try {
      const rows = await getDoctorPatients();
      setPatients(rows.map(normalizePatient));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load patients';
      setPatientsError(message);
      throw error;
    } finally {
      setPatientsLoading(false);
    }
  };
  const refreshInbox = async () => {
    setInboxLoading(true);
    setInboxError('');
    try {
      const rows = await getDoctorInbox();
      setInbox(rows.map((event) => ({
        ...event,
        text: event.message,
        time: relativeTime(event.created_at),
        tag: event.unread ? 'new' : null,
      })));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load inbox';
      setInboxError(message);
      throw error;
    } finally {
      setInboxLoading(false);
    }
  };
  const loadAppointments = async (date) => {
    const key = dateString(date);
    setAppointmentsLoading(true);
    setAppointmentsError('');
    try {
      const rows = await getDoctorAppointments(key);
      setAppointmentsByDate((current) => ({ ...current, [key]: rows }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load appointments';
      setAppointmentsError(message);
      throw error;
    } finally {
      setAppointmentsLoading(false);
    }
  };
  const pat = (id) => patients.find((patient) => patient.id === id);
  const apptsFor = (date) => {
    const key = dateString(date);
    const stored = appointmentsByDate[key] || [];
    const byMinute = new Map(stored.map((appointment) => [appointment.minutes, appointment]));
    let nextTaken = false;
    const now = new Date();
    return SLOTS.map((mins) => {
      const appointment = byMinute.get(mins);
      const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(mins / 60), mins % 60);
      let status = appointment?.status === 'completed' || slotDate < now ? 'done' : 'upcoming';
      if (appointment?.status === 'scheduled' && slotDate >= now && !nextTaken) {
        status = 'next';
        nextTaken = true;
      }
      return {
        key: appointment?.id || `${key}|${mins}`,
        id: appointment?.id,
        date: appointment?.date || key,
        mins,
        pid: appointment?.pid || null,
        patient_name: appointment?.patient_name || '',
        status,
        type: appointment?.type || 'Available appointment',
      };
    });
  };
  const book = async (date, mins, patientId) => {
    const appointment = await createDoctorAppointment({
      patientId,
      date: dateString(date),
      minutes: mins,
      type: 'Consultation',
    });
    const key = dateString(date);
    setAppointmentsByDate((current) => ({
      ...current,
      [key]: [
        ...(current[key] || []).filter((row) => row.minutes !== mins),
        { ...appointment, patient_name: pat(patientId)?.name || '' },
      ],
    }));
    loadAppointments(date).catch((error) => console.error('Booked appointment refresh failed:', error));
    return appointment;
  };
  const complete = async (appointment) => {
    if (!appointment?.id) throw new Error('Appointment is not saved');
    await completeDoctorAppointment(appointment.id);
    const date = new Date(`${appointment.date}T00:00:00`);
    const key = dateString(date);
    setAppointmentsByDate((current) => ({
      ...current,
      [key]: (current[key] || []).map((row) => row.id === appointment.id ? { ...row, status: 'completed' } : row),
    }));
    loadAppointments(date).catch((error) => console.error('Completed appointment refresh failed:', error));
  };
  const markRead = async (id) => {
    try {
      await markDoctorInboxRead(id);
      setInbox((current) => current.map((event) => event.id === id ? { ...event, unread: false, tag: null } : event));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not mark inbox item as read';
      setInboxError(message);
      throw error;
    }
  };

  React.useEffect(() => {
    refreshPatients().catch((error) => console.error('Doctor patients load failed:', error));
    refreshInbox().catch((error) => console.error('Doctor inbox load failed:', error));
    loadAppointments(new Date()).catch((error) => console.error('Doctor appointments load failed:', error));
  }, []);

  return <Ctx.Provider value={{
    pat, patients, patientsLoading, patientsError, refreshPatients,
    apptsFor, book, complete, loadAppointments, appointmentsLoading, appointmentsError,
    inbox, inboxLoading, inboxError, refreshInbox, markRead, doctor,
  }}>{children}</Ctx.Provider>;
}

/* ---------- small UI ---------- */
const AV = ['#fde3d0', '#e2f0f7', '#e5f3e8', '#f1e4f5', '#fff2cc'];
export const Avatar = ({ name, size = 42 }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: AV[(name || '?').length % AV.length], alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: D.ink, fontWeight: '700', fontSize: size * 0.34 }}>{(name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)}</Text>
  </View>
);
export const Pill = ({ t, bg, fg }) => (
  <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
    <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{t}</Text>
  </View>
);
export const card = { backgroundColor: D.card, borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: D.line };
