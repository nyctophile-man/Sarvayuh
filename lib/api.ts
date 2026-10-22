// Android emulators reach the host machine through 10.0.2.2; other platforms use localhost.
// Physical device: set EXPO_PUBLIC_API_URL=http://<YOUR_MACHINE_IP>:4000.
import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { Blob as ExpoBlob } from 'expo-blob';
import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';

const DEFAULT_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
const BASE = (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL) || DEFAULT_API_URL;

let token: string | null = null;
let authUser: { id?: string; name?: string; email?: string; role?: string } | null = null;
let onUnauthorizedHandler: () => void = () => {};

export const setToken = (t: string | null) => { token = t; };
export const setAuthUser = (user: typeof authUser) => { authUser = user; };
export const getAuthUser = () => authUser;
export const getToken = (): string | null => token;
export const clearToken = () => { token = null; authUser = null; };
export const setUnauthorizedHandler = (cb: () => void) => { onUnauthorizedHandler = cb; };
export const apiBase = BASE;
export const authHeaders = (): Record<string, string> => (token ? { Authorization: 'Bearer ' + token } : {});

/**
 * Builds a multipart file part.
 *
 * Expo SDK 58 replaces the global fetch with expo/fetch (winter runtime). It no longer
 * accepts the old React Native `{ uri, name, type }` part - it throws
 * "Unsupported FormDataPart implementation". Build the multipart part with expo-blob so
 * binary data uses the Blob implementation supported by the SDK 58 fetch runtime.
 */
async function multipartFile(uri: string, name: string | undefined, mimeType: string) {
  let file: File | null = null;
  let fileCreationError: unknown;
  try {
    file = new File(uri);
  } catch (error) {
    // Some picker URIs (notably content:// URIs) cannot be represented by File directly.
    fileCreationError = error;
  }

  const fileName = name || file?.name || 'file';

  let bytes: Uint8Array;
  try {
    if (!file) throw fileCreationError;
    bytes = await file.bytes();
  } catch (fileError) {
    try {
      // Some content:// picker URIs are readable through the legacy file-system API.
      const base64 = await FileSystemLegacy.readAsStringAsync(uri, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });
      const binary = atob(base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } catch (legacyError) {
      try {
        // Web picker assets may be exposed as fetchable blob: or object URLs.
        const res = await fetch(uri);
        if (!res.ok) throw new Error(`Could not read selected file (${res.status})`);
        bytes = new Uint8Array(await res.arrayBuffer());
      } catch (fetchError) {
        const reason = fetchError instanceof Error ? fetchError.message : String(fetchError);
        const fallbackReason = legacyError instanceof Error ? legacyError.message : String(legacyError);
        const sourceReason = fileError instanceof Error ? fileError.message : String(fileError);
        throw new Error(
          `Could not read selected file: ${reason}; file-system fallback: ${fallbackReason}; file API: ${sourceReason}`
        );
      }
    }
  }

  const blob = new ExpoBlob([bytes], { type: mimeType || 'application/octet-stream' });
  return { name: fileName, type: blob.type, bytes: () => blob.bytes() };
}

function appendMultipartFile(formData: FormData, part: Awaited<ReturnType<typeof multipartFile>>) {
  // expo/fetch supports bytes-readable parts; the DOM FormData type only allows Blob.
  formData.append('file', part as unknown as Blob);
}

async function request(path: string, opts: any = {}) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let body = opts.body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await expoFetch(BASE + path, { ...opts, headers, body });
  if (res.status === 401) { clearToken(); onUnauthorizedHandler(); throw new Error('Login required'); }
  if (!res.ok) {
    let msg = res.statusText;
    try { const e = await res.json(); if (e.error) msg = e.error; } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.arrayBuffer();
}

// ---------- Auth ----------
export const signup = (body: any) => request('/auth/signup', { method: 'POST', body });
export const login = (body: any) => request('/auth/login', { method: 'POST', body });
export const forgotPassword = (email: string) => request('/auth/forgot-password', { method: 'POST', body: { email } });
export const resetPassword = (token: string, password: string) => request('/auth/reset-password', { method: 'POST', body: { token, password } });

// ---------- Profile ----------
export const getProfile = () => request('/profile');
export const putProfile = (body: any) => request('/profile', { method: 'PUT', body });
export const uploadProfilePhoto = async (file: { uri: string; name: string; type: string }) => {
  const fd = new FormData();
  const part = await multipartFile(file.uri, file.name, file.type);
  appendMultipartFile(fd, part);
  return request('/profile/photo', { method: 'POST', body: fd });
};

// ---------- Records ----------
export const getRecords = (params?: { patientId?: string; category?: string }) => {
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return request('/records' + qs);
};
export const uploadRecord = async (file: { uri: string; name: string; type: string }, fields: { title?: string; category?: string }) => {
  const fd = new FormData();
  const part = await multipartFile(file.uri, file.name, file.type);
  appendMultipartFile(fd, part);
  if (fields.title) fd.append('title', fields.title);
  if (fields.category) fd.append('category', fields.category);
  return request('/records', { method: 'POST', body: fd });
};
export const getRecordFile = (id: string) => request('/records/' + id + '/file');
export const deleteRecord = (id: string) => request('/records/' + id, { method: 'DELETE' });

// ---------- Medcard ----------
export const getMedcard = () => request('/medcard');
export const postMedcardQr = () => request('/medcard/qr', { method: 'POST' });
export const patchMedcardLock = (locked: boolean) => request('/medcard/lock', { method: 'PATCH', body: { locked } });

// ---------- AI ----------
export type AiMessage = { text: string; style: 'normal' | 'emergency' | 'notice' };
export type AiAction = { type: 'consult_doctor' } | { type: 'call_emergency'; number: string };
export type AiInit = {
  botName: string;
  tagline: string;
  greeting: string;
  quickReplies: string[];
  inputPlaceholder: string;
  disclaimer: string;
};
export type AiChatResponse = {
  sessionId: string;
  messages: AiMessage[];
  quickReplies: string[];
  actions: AiAction[];
  flags: { emergency: boolean; consultPhysician: boolean };
  disclaimer: string;
};

export const getAiInit = () => request('/ai/init');
export const postAiChat = (body: { message: string; sessionId?: string }) =>
  request('/ai/chat', { method: 'POST', body });

// ---------- Shares ----------
export const getShares = () => request('/shares');
export const postShare = (body: any) => request('/shares', { method: 'POST', body });
export const deleteShare = (id: string) => request('/shares/' + id, { method: 'DELETE' });
// Public share links (the token is the secret, no login needed)
export const getPublicShare = (token: string) => request('/shares/public/' + token);
export const publicShareFileUrl = (token: string, recordId: string) => `${BASE}/shares/public/${token}/file/${recordId}`;

// ---------- Feedback ----------
export const sendFeedback = (body: any) => request('/feedback', { method: 'POST', body });

// ---------- Prescriptions ----------
export const getPrescriptions = () => request('/prescriptions');
export const postPrescription = (body: any) => request('/prescriptions', { method: 'POST', body });

// ---------- Doctor workspace ----------
export const getDoctorPatients = (healthId?: string) => {
  const qs = healthId ? '?' + new URLSearchParams({ healthId }).toString() : '';
  return request('/doctor/patients' + qs);
};
export const getDoctorInbox = () => request('/doctor/inbox');
export const markDoctorInboxRead = (id: string) =>
  request('/doctor/inbox/' + encodeURIComponent(id) + '/read', { method: 'PATCH' });
export const getDoctorAppointments = (date: string) =>
  request('/doctor/appointments?' + new URLSearchParams({ date }).toString());
export const createDoctorAppointment = (body: {
  patientId: string;
  date: string;
  minutes: number;
  type: string;
}) => request('/doctor/appointments', { method: 'POST', body });
export const completeDoctorAppointment = (id: string) =>
  request('/doctor/appointments/' + encodeURIComponent(id) + '/complete', { method: 'PATCH' });
