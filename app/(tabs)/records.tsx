// @ts-nocheck
// app/(tabs)/records.tsx  –  SARVAYUH "My Health Records"
// Features: upload (PDF/image), search, filters, multi-select, export (JSON / CSV / text),
//           QR share + download link (with 10-min expiry), delete, toast, empty state.
//
// Data comes from the backend: GET /records, POST /records, DELETE /records/:id, POST /shares.
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity as T, ScrollView, StyleSheet as S,
  Animated, Modal, Share, Pressable, Platform, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import QRCode from 'react-native-qrcode-svg';
import { getRecords, uploadRecord, deleteRecord, postShare, apiBase, getRecordFile } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';
import { useTheme } from '@/lib/theme';

/* ------------------------------------------------------------------ */
/*  Shared row (single source of truth: @/components/RecordRow)        */
/* ------------------------------------------------------------------ */
export { RecRow } from '@/components/RecordRow';

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */
const SHARE_MINUTES = 10;                 // share link lifetime
const SHARE_HOURS = SHARE_MINUTES / 60;   // the API takes hours
const DOCTOR_SHARE_HOURS = 24;
const TYPES = ['Lab Reports', 'Prescriptions', 'Imaging', 'Others'];
const FILTERS = ['All', ...TYPES];
const ICON = { 'Lab Reports': '🧪', Prescriptions: '💊', Imaging: '🩻', Others: '📄' };
// Backend category value -> translation key (display only).
const TYPE_KEYS: Record<string, string> = {
  'Lab Reports': 'records.type.lab',
  Prescriptions: 'records.type.prescriptions',
  Imaging: 'records.type.imaging',
  Others: 'records.type.others',
};

const guessType = (r) => {
  const txt = `${r.mime || ''} ${r.title || ''} ${r.category || ''}`.toLowerCase();
  if (/lab|blood|cbc|sugar|urine|thyroid|report/.test(txt)) return 'Lab Reports';
  if (/rx|prescri|tablet|medicine/.test(txt)) return 'Prescriptions';
  if (/x-?ray|mri|ct|scan|usg|ultra|imaging/.test(txt)) return 'Imaging';
  return 'Others';
};

const fmtDate = (v, locale = 'en-IN') =>
  v ? new Date(v).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const norm = (r, idx, t, locale) => {
  const type = TYPES.includes(r.category) ? r.category : guessType(r);
  return {
    id: String(r.id ?? `r${idx + 1}`),
    i: ICON[type] || '📄',
    t: r.title || t('records.untitled'),
    d: fmtDate(r.created_at, locale),
    c: r.category || 'Others',
    type,
    mime: r.mime,
    size: r.size,
  };
};

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const fmtTime = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
const fmtSize = (b) => (!b ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const recordMimeType = (asset) => {
  const extension = asset.name?.split('.').pop()?.toLowerCase();
  const mimeByExtension = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };
  if (mimeByExtension[extension]) return mimeByExtension[extension];

  const mimeType = asset.mimeType?.toLowerCase().split(';')[0];
  if (mimeType === 'image/jpg') return 'image/jpeg';
  return ['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType) ? mimeType : null;
};

/* ------------------------------------------------------------------ */
/*  Bottom sheet                                                       */
/* ------------------------------------------------------------------ */
const Sheet = ({ visible, onClose, title, children }) => {
  const { colors } = useTheme();
  const st = makeStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} />
      <View style={st.sheet}>
        <View style={st.handle} />
        <View style={st.sheetHead}>
          <Text style={st.sheetTitle}>{title}</Text>
          <T onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontSize: 18, color: colors.mute }}>✕</Text>
          </T>
        </View>
        {children}
      </View>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/*  Screen                                                             */
/* ------------------------------------------------------------------ */
export default function HealthRecords() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const st = makeStyles(colors);
  const [recs, setRecs] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [sel, setSel] = useState({});
  const [sheet, setSheet] = useState(null); // 'upload' | 'export' | 'qr' | 'doctor-share' | null
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // upload form
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Lab Reports');
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState('');

  // qr
  const [qrIds, setQrIds] = useState([]);
  const [qrLink, setQrLink] = useState('');
  const [left, setLeft] = useState(0);
  const [qrKey, setQrKey] = useState(0);
  const [qrBusy, setQrBusy] = useState(false);
  const [doctorShareIds, setDoctorShareIds] = useState([]);
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorShareBusy, setDoctorShareBusy] = useState(false);

  // toast
  const [toastMsg, setToastMsg] = useState('');
  const [toastA] = useState(() => new Animated.Value(0));
  const toastTimer = useRef(null);
  const toast = (m) => {
    setToastMsg(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2300);
    Animated.sequence([
      Animated.timing(toastA, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastA, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  /* ---------- load from backend ---------- */
  const load = useCallback(async () => {
    try {
      const rows = await getRecords();
      setRecs((rows || []).map((r, i) => norm(r, i, t, locale)));
      setErr('');
    } catch (e) {
      if (e.message !== 'Login required') setErr(e.message || t('records.errLoad'));
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }, [t, locale]);
  // Initial data fetch: load() awaits getRecords() before any setState, so no
  // synchronous setState happens here — the rule can't see through the async fn.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  /* ---------- derived ---------- */
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return recs.filter((r) => {
      const okType = filter === 'All' || r.type === filter;
      const okQ = !k || `${r.t} ${r.d} ${r.c} ${r.type}`.toLowerCase().includes(k);
      return okType && okQ;
    });
  }, [recs, q, filter]);

  const selected = recs.filter((r) => sel[r.id]);
  const count = selected.length;
  const allSelected = filtered.length > 0 && filtered.every((r) => sel[r.id]);
  const target = count ? selected : filtered; // what Export / QR act on

  /* ---------- selection ---------- */
  const toggle = (id) => setSel((p) => ({ ...p, [id]: !p[id] }));
  const toggleAll = () => {
    if (allSelected) {
      setSel((p) => { const n = { ...p }; filtered.forEach((r) => delete n[r.id]); return n; });
    } else {
      setSel((p) => { const n = { ...p }; filtered.forEach((r) => (n[r.id] = true)); return n; });
    }
  };

  const removeSelected = () =>
    Alert.alert(t('common.delete'), t('records.confirmDelete', { n: count }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          const ids = selected.map((r) => r.id);
          try {
            await Promise.all(ids.map((id) => deleteRecord(id)));
            setRecs((p) => p.filter((r) => !sel[r.id]));
            setSel({});
            toast(t('records.toast.deleted'));
          } catch (e) {
            console.warn('[records] delete failed:', e?.message || e);
            toast(e.message || t('records.toast.deleteFailed'));
          }
        },
      },
    ]);

  /* ---------- upload ---------- */
  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setFile(a);
      if (!title) setTitle(a.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      console.warn('[records] file picker failed:', e?.message || e);
      toast(e.message || t('records.toast.pickerFailed'));
    }
  };

  const closeUpload = () => { setSheet(null); setFile(null); setTitle(''); setType('Lab Reports'); };

  const saveUpload = async () => {
    if (!file) return toast(t('records.toast.chooseFile'));
    if (!title.trim()) return toast(t('records.toast.enterTitle'));
    const mimeType = recordMimeType(file);
    if (!mimeType) return toast(t('records.toast.chooseType'));
    if (file.size > 10 * 1024 * 1024) return toast(t('records.toast.tooLarge'));
    setSaving(true);
    try {
      const created = await uploadRecord(
        { uri: file.uri, name: file.name, type: mimeType },
        { title: title.trim(), category: type }
      );
      setRecs((p) => [norm({
        ...created,
        mime: created.mime || mimeType,
        size: created.size ?? file.size,
        created_at: created.created_at || new Date().toISOString(),
      }, 0, t, locale), ...p]);
      closeUpload();
      toast(t('records.toast.uploaded'));
    } catch (e) {
      console.warn('[records] upload failed:', e?.message || e);
      toast(e.message || t('records.toast.uploadFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openRecord = async (record) => {
    setOpeningId(record.id);
    try {
      const bytes = await getRecordFile(record.id);
      const extension = record.mime === 'application/pdf' ? 'pdf' : record.mime?.split('/')[1] || 'jpg';
      const safeTitle = String(record.t || 'record').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'record';
      const file = new File(Paths.cache, `${safeTitle}-${record.id}.${extension}`);
      await file.write(new Uint8Array(bytes));
      if (!(await file.canPreview())) throw new Error('No app is available to open this file');
      await file.preview({ title: record.t, mimeType: record.mime || undefined });
    } catch (e) {
      console.warn('[records] open failed:', e?.message || e);
      toast(e.message || t('records.toast.openFailed'));
    } finally {
      setOpeningId('');
    }
  };

  /* ---------- export ---------- */
  const buildExport = (fmt) => {
    const rows = target.map((r) => ({ id: r.id, title: r.t, type: r.type, date: r.d, details: r.c }));
    if (fmt === 'json') {
      return JSON.stringify({ app: 'SARVAYUH', exportedOn: new Date().toISOString(), total: rows.length, records: rows }, null, 2);
    }
    if (fmt === 'csv') {
      return ['ID,Title,Type,Date,Details', ...rows.map((r) => [r.id, r.title, r.type, r.date, r.details].map(csvCell).join(','))].join('\n');
    }
    return `SARVAYUH · Health Records (${rows.length})\n\n` +
      rows.map((r, i) => `${i + 1}. ${r.title}\n   ${r.type} · ${r.d}${r.details ? '\n   ' + r.details : ''}`).join('\n\n');
  };

  const doExport = async (fmt) => {
    if (!target.length) return toast(t('records.toast.noExport'));
    try {
      await Share.share({ title: 'SARVAYUH Health Records', message: buildExport(fmt) });
      setSheet(null);
    } catch {
      toast(t('records.toast.exportFailed'));
    }
  };

  /* ---------- QR share (real backend share link) ---------- */
  const openQR = async (ids) => {
    if (!ids.length) return toast(t('records.toast.noShare'));
    setQrBusy(true);
    try {
      const share = await postShare({ recordIds: ids, expiresInHours: SHARE_HOURS });
      setQrIds(ids);
      setLeft(share.expiresIn || 0);
      setQrLink(`${apiBase}/shares/public/${share.token}`);
      setQrKey((k) => k + 1);
      setSheet('qr');
    } catch (e) {
      toast(e.message || t('records.toast.shareFailed'));
    } finally {
      setQrBusy(false);
    }
  };

  const openDoctorShare = (ids) => {
    if (!ids.length) return toast(t('records.toast.noShare'));
    setDoctorShareIds(ids);
    setDoctorEmail('');
    setSheet('doctor-share');
  };

  const shareWithDoctor = async () => {
    const email = doctorEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast(t('records.toast.invalidDoctorEmail'));
    setDoctorShareBusy(true);
    try {
      await postShare({
        recordIds: doctorShareIds,
        recipientEmail: email,
        recipientRole: 'doctor',
        expiresInHours: DOCTOR_SHARE_HOURS,
      });
      setSheet(null);
      setDoctorEmail('');
      toast(t('records.toast.doctorShared'));
    } catch (e) {
      toast(e.message || t('records.toast.shareFailed'));
    } finally {
      setDoctorShareBusy(false);
    }
  };

  useEffect(() => {
    if (sheet !== 'qr') return;
    const t = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [sheet, qrKey]);

  const qrRecs = recs.filter((r) => qrIds.includes(r.id));

  /* ---------- UI ---------- */
  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={st.header}>
          <Text style={st.h1}>{t('records.title')}</Text>
          <T style={st.uploadBtn} activeOpacity={0.85} onPress={() => setSheet('upload')}>
            <Text style={st.uploadT}>{t('records.upload')}</Text>
          </T>
        </View>

        {/* Search */}
        <View style={st.search}>
          <Text style={{ fontSize: 15 }}>🔍</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('records.search')}
            placeholderTextColor={colors.mute}
            style={st.searchIn}
          />
          {!!q && <T onPress={() => setQ('')}>          <Text style={{ color: colors.mute, fontSize: 16 }}>✕</Text></T>}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
          {FILTERS.map((f) => (
            <T key={f} onPress={() => setFilter(f)} activeOpacity={0.85}
               style={[st.chip, filter === f && st.chipOn]}>
              <Text style={[st.chipT, filter === f && { color: colors.onBrand }]}>
                {f === 'All' ? t('records.filter.all') : t(TYPE_KEYS[f] || 'records.type.others')}
              </Text>
            </T>
          ))}
        </ScrollView>

        {/* Quick actions */}
        <View style={st.actions}>
          <T style={st.actBtn} activeOpacity={0.85} onPress={() => setSheet('export')}>
            <Text style={st.actI}>⬇️</Text>
            <View>
              <Text style={st.actT}>{t('records.export')}</Text>
              <Text style={st.actS}>{count ? t('records.exportSelected', { n: count }) : t('records.exportAll')}</Text>
            </View>
          </T>
          <T style={st.actBtn} activeOpacity={0.85} onPress={() => openQR(target.map((r) => r.id))} disabled={qrBusy}>
            <Text style={st.actI}>▦</Text>
            <View>
              <Text style={st.actT}>{t('records.shareQr')}</Text>
              <Text style={st.actS}>{qrBusy ? t('records.creatingLink') : t('records.scanDownload')}</Text>
            </View>
          </T>
        </View>
        <View style={[st.actions, { marginTop: 4 }]}>
          <T style={st.actBtn} activeOpacity={0.85} onPress={() => openDoctorShare(target.map((r) => r.id))} disabled={doctorShareBusy}>
            <Text style={st.actI}>🩺</Text>
            <View>
              <Text style={st.actT}>{t('records.shareWithDoctor')}</Text>
              <Text style={st.actS}>{t('records.shareWithDoctorSub')}</Text>
            </View>
          </T>
        </View>

        {/* Select row */}
        <View style={st.selRow}>
          <T onPress={toggleAll} disabled={!filtered.length}>
            <Text style={[st.selAll, !filtered.length && { opacity: 0.4 }]}>{allSelected ? t('records.clearAll') : t('records.selectAll')}</Text>
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {count > 0 && (
              <T onPress={removeSelected} style={{ marginRight: 14 }}>
                <Text style={{ color: colors.red, fontWeight: '700', fontSize: 13 }}>{t('records.deleteSelected')}</Text>
              </T>
            )}
            <Text style={st.selCount}>{t('records.exportSelected', { n: count })}</Text>
          </View>
        </View>

        {!!err && <Text style={st.err}>{err}</Text>}

        {/* List */}
        <View style={{ paddingHorizontal: 20 }}>
          {loading ? (
            <Text style={st.emptyT}>{t('records.loading')}</Text>
          ) : filtered.length === 0 ? (
            <View style={st.empty}>
              <Text style={{ fontSize: 40 }}>🗂️</Text>
              <Text style={st.emptyT}>{recs.length ? t('records.noMatch') : t('records.empty')}</Text>
              {!recs.length && (
                <>
                  <Text style={st.emptyS}>{t('records.emptySub')}</Text>
                  <T style={[st.uploadBtn, { marginTop: 14, paddingHorizontal: 22 }]} onPress={() => setSheet('upload')}>
                    <Text style={st.uploadT}>{t('records.uploadFirst')}</Text>
                  </T>
                </>
              )}
            </View>
          ) : (
            filtered.map((r) => {
              const on = !!sel[r.id];
              return (
                <T key={r.id} activeOpacity={0.9} onPress={() => toggle(r.id)} style={[st.row, on && st.rowOn]}>
                  <View style={[st.check, on && st.checkOn]}>{on && <Text style={st.tick}>✓</Text>}</View>
                  <View style={st.icBox}><Text style={{ fontSize: 18 }}>{r.i}</Text></View>
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text style={st.rt} numberOfLines={1}>{r.t}</Text>
                    <Text style={st.rd} numberOfLines={1}>
                      {[r.d, t(TYPE_KEYS[r.c] || TYPE_KEYS[r.type] || 'records.type.others')].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <T onPress={() => openRecord(r)} style={st.openBtn} disabled={openingId === r.id}
                     hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: colors.teal, fontSize: 13, fontWeight: '800' }}>{openingId === r.id ? '…' : t('records.open')}</Text>
                  </T>
                  <T onPress={() => openQR([r.id])} style={st.qrBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: colors.teal, fontSize: 16, fontWeight: '800' }}>▦</Text>
                  </T>
                </T>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ---------------- Upload sheet ---------------- */}
      <Sheet visible={sheet === 'upload'} onClose={closeUpload} title={t('records.uploadTitle')}>
        <T style={st.drop} activeOpacity={0.85} onPress={pickFile}>
          <Text style={{ fontSize: 28 }}>{file ? '✅' : '📤'}</Text>
          <Text style={st.dropT} numberOfLines={1}>{file ? file.name : t('records.chooseFile')}</Text>
          <Text style={st.dropS}>{file ? fmtSize(file.size) || t('records.tapChange') : t('records.fileKinds')}</Text>
        </T>

        <Text style={st.lbl}>{t('records.titleLabel')}</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder={t('records.titlePlaceholder')} placeholderTextColor={colors.mute} style={st.input} />

        <Text style={st.lbl}>{t('records.categoryLabel')}</Text>
        <View style={st.typeWrap}>
          {TYPES.map((x) => (
            <T key={x} onPress={() => setType(x)} style={[st.chip, { marginBottom: 8 }, type === x && st.chipOn]}>
              <Text style={[st.chipT, type === x && { color: colors.onBrand }]}>{ICON[x]}  {t(TYPE_KEYS[x] || 'records.type.others')}</Text>
            </T>
          ))}
        </View>

        <T style={[st.primary, saving && { opacity: 0.6 }]} activeOpacity={0.88} onPress={saveUpload} disabled={saving}>
          <Text style={st.primaryT}>{saving ? t('records.uploading') : t('records.saveRecord')}</Text>
        </T>
      </Sheet>

      {/* ---------------- Export sheet ---------------- */}
      <Sheet visible={sheet === 'export'} onClose={() => setSheet(null)} title={t('records.exportTitle')}>
        <Text style={st.hint}>
          {t('records.exportHint', {
            n: target.length,
            mode: count ? t('records.exportModeSelected') : t('records.exportModeShown'),
          })}
        </Text>
        {[
          { k: 'json', i: '{ }', t: 'records.exportJson', s: 'records.exportJsonSub' },
          { k: 'csv', i: '▤', t: 'records.exportCsv', s: 'records.exportCsvSub' },
          { k: 'txt', i: '≡', t: 'records.exportTxt', s: 'records.exportTxtSub' },
        ].map((o) => (
          <T key={o.k} style={st.opt} activeOpacity={0.85} onPress={() => doExport(o.k)}>
            <View style={st.optIc}><Text style={{ color: colors.teal, fontWeight: '800', fontSize: 15 }}>{o.i}</Text></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={st.optT}>{t(o.t)}</Text>
              <Text style={st.optS}>{t(o.s)}</Text>
            </View>
            <Text style={{ color: colors.mute, fontSize: 18 }}>›</Text>
          </T>
        ))}
      </Sheet>

      {/* ---------------- Share with doctor sheet ---------------- */}
      <Sheet visible={sheet === 'doctor-share'} onClose={() => setSheet(null)} title={t('records.shareWithDoctor')}>
        <Text style={st.hint}>{t('records.doctorShareHint')}</Text>
        <Text style={st.lbl}>{t('records.doctorEmail')}</Text>
        <TextInput
          value={doctorEmail}
          onChangeText={setDoctorEmail}
          placeholder={t('common.emailPlaceholder')}
          placeholderTextColor={colors.mute}
          style={st.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <T style={[st.primary, doctorShareBusy && { opacity: 0.6 }]} activeOpacity={0.88} onPress={shareWithDoctor} disabled={doctorShareBusy}>
          <Text style={st.primaryT}>{doctorShareBusy ? t('records.doctorShareSending') : t('records.doctorShareSubmit')}</Text>
        </T>
      </Sheet>

      {/* ---------------- QR sheet ---------------- */}
      <Sheet visible={sheet === 'qr'} onClose={() => setSheet(null)} title={t('records.qrTitle')}>
        <View style={{ alignItems: 'center' }}>
          <View style={[st.qrBox, left === 0 && { opacity: 0.25 }]}>
            <QRCode value={qrLink || 'about:blank'} size={190} color={colors.deepSurface} backgroundColor={colors.white} />
          </View>
          <Text style={st.qrCount}>
            {t('records.qrCount', {
              n: qrRecs.length,
              names: qrRecs.slice(0, 2).map((r) => r.t).join(', '),
              more: qrRecs.length > 2 ? t('records.qrMore', { n: qrRecs.length - 2 }) : '',
            })}
          </Text>
          <Text style={[st.timer, left === 0 && { color: colors.red }]}>
            {left === 0 ? t('records.expired') : t('records.expires', { time: fmtTime(left) })}
          </Text>
          <Text style={st.hint}>{t('records.qrHint')}</Text>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          <T style={[st.primary, st.half, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.teal, marginRight: 8 }]}
             onPress={() => openQR(qrIds)}>
            <Text style={[st.primaryT, { color: colors.teal }]}>{t('records.newCode')}</Text>
          </T>
          <T style={[st.primary, st.half, { marginLeft: 8 }]} disabled={left === 0}
             onPress={() => Share.share({ title: 'SARVAYUH records', message: `Download my health records (valid ${Math.ceil(left / 60)} min): ${qrLink}` })}>
            <Text style={st.primaryT}>{t('records.shareLink')}</Text>
          </T>
        </View>
      </Sheet>

      {/* Toast (own modal, otherwise it renders behind the sheet) */}
      <Modal visible={!!toastMsg} transparent animationType="fade" onRequestClose={() => setToastMsg('')}>
        <View pointerEvents="none" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View style={[st.toast, { opacity: toastA, transform: [{ translateY: toastA.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
            <Text style={st.toastT}>{toastMsg}</Text>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const makeStyles = (c) => S.create({
  screen: { flex: 1, backgroundColor: c.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 44 },
  h1: { fontSize: 24, fontWeight: '800', color: c.deep, flex: 1, marginRight: 10 },
  uploadBtn: { backgroundColor: c.teal, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  uploadT: { color: c.onBrand, fontWeight: '800', fontSize: 13 },

  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, marginHorizontal: 20, marginTop: 18, paddingHorizontal: 14, height: 52 },
  searchIn: { flex: 1, marginLeft: 10, fontSize: 15, color: c.ink, paddingVertical: 0 },

  chips: { paddingHorizontal: 20, paddingVertical: 16 },
  chip: { backgroundColor: c.surface, borderRadius: 999, borderWidth: 1, borderColor: c.line, paddingHorizontal: 18, paddingVertical: 11, marginRight: 10 },
  chipOn: { backgroundColor: c.deepSurface, borderColor: c.deepSurface },
  chipT: { color: c.ink, fontWeight: '700', fontSize: 14 },

  actions: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 6 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 12, marginRight: 10 },
  actI: { fontSize: 20, marginRight: 10, color: c.teal },
  actT: { color: c.ink, fontWeight: '800', fontSize: 13.5 },
  actS: { color: c.mute, fontSize: 11, marginTop: 1 },

  selRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 10, marginBottom: 12 },
  selAll: { color: c.teal, fontWeight: '800', fontSize: 15 },
  selCount: { color: c.mute, fontSize: 14 },
  err: { color: c.red, fontSize: 13, marginHorizontal: 20, marginBottom: 8 },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent', padding: 12, marginBottom: 10, shadowColor: c.deepSurface, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  rowOn: { borderColor: c.teal, backgroundColor: c.tealSoft },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: c.line, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkOn: { backgroundColor: c.teal, borderColor: c.teal },
  tick: { color: c.onBrand, fontSize: 13, fontWeight: '900', marginTop: -1 },
  icBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.tealSoft, alignItems: 'center', justifyContent: 'center' },
  rt: { color: c.ink, fontWeight: '800', fontSize: 14.5 },
  rd: { color: c.mute, fontSize: 12, marginTop: 2 },
  qrBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.tealSoft, alignItems: 'center', justifyContent: 'center' },
  openBtn: { minWidth: 48, height: 36, borderRadius: 10, backgroundColor: c.tealSoft, alignItems: 'center', justifyContent: 'center', marginRight: 6 },

  empty: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 20 },
  emptyT: { color: c.mute, fontSize: 15, marginTop: 10, textAlign: 'center', fontWeight: '600' },
  emptyS: { color: c.mute, fontSize: 13, marginTop: 6, textAlign: 'center' },

  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingBottom: 30, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { color: c.deep, fontSize: 19, fontWeight: '800' },

  drop: { borderWidth: 2, borderStyle: 'dashed', borderColor: c.teal, backgroundColor: c.tealSoft, borderRadius: 18, alignItems: 'center', paddingVertical: 22, paddingHorizontal: 14 },
  dropT: { color: c.ink, fontWeight: '800', marginTop: 6, fontSize: 14, maxWidth: '100%' },
  dropS: { color: c.mute, fontSize: 12, marginTop: 2 },
  lbl: { color: c.mute, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, height: 48, color: c.ink, fontSize: 15, backgroundColor: c.surfaceAlt },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap' },

  primary: { backgroundColor: c.teal, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryT: { color: c.onBrand, fontWeight: '800', fontSize: 15 },
  half: { flex: 1 },

  hint: { color: c.mute, fontSize: 12.5, textAlign: 'center', marginVertical: 8, lineHeight: 18 },
  opt: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 14, marginTop: 10 },
  optIc: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.tealSoft, alignItems: 'center', justifyContent: 'center' },
  optT: { color: c.ink, fontWeight: '800', fontSize: 15 },
  optS: { color: c.mute, fontSize: 12, marginTop: 1 },

  qrBox: { backgroundColor: c.white, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: c.line, shadowColor: c.deepSurface, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  qrCount: { color: c.ink, fontWeight: '700', fontSize: 13, marginTop: 14, textAlign: 'center' },
  timer: { color: c.teal, fontWeight: '800', fontSize: 14, marginTop: 6 },

  toast: { position: 'absolute', left: 24, right: 24, bottom: 36, backgroundColor: c.deepSurface, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  toastT: { color: c.onDeep, fontWeight: '700', fontSize: 13.5 },
});
