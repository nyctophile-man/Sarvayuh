import { StyleSheet as S } from 'react-native';
import type { Colors } from './colors';

/**
 * Shared style sheet used across the app. It is rebuilt from the active
 * palette so every screen follows the light/dark mode.
 */
export const makeSharedStyles = (c: Colors) =>
  S.create({
    full: { flex: 1, backgroundColor: c.bg },
    pad: { padding: 18, paddingBottom: 30 },
    logo: { fontSize: 36, letterSpacing: 6, color: c.onDeep, textAlign: 'center', fontWeight: '600' },
    h1: { fontSize: 24, fontWeight: '700', color: c.deep, marginBottom: 6 },
    h2: { fontSize: 17, fontWeight: '700', color: c.deep, marginTop: 22, marginBottom: 10 },
    lbl: { color: c.ink, fontWeight: '600', marginBottom: 6, marginTop: 6 },
    btn: { backgroundColor: c.teal, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    btnGhost: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.teal },
    btnT: { color: c.onBrand, fontWeight: '700', fontSize: 15 },
    input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 13, marginBottom: 12, color: c.ink },
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 14 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.line, marginHorizontal: 4 },
    cb: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: c.teal, alignItems: 'center', justifyContent: 'center' },
    chp: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, marginRight: 8, marginBottom: 8 },
    face: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden', borderRadius: 20, padding: 16,
      backgroundColor: c.deepSurface, borderWidth: 1, borderColor: c.goldEdge, overflow: 'hidden', elevation: 8,
      shadowColor: c.deepSurface, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
    },
    brand: { color: c.gold, fontWeight: '700', letterSpacing: 2, fontSize: 13 },
    tiny: { color: c.onDeepSoft, fontSize: 8, letterSpacing: 1 },
    ph: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: c.gold, backgroundColor: c.teal, alignItems: 'center', justifyContent: 'center' },
    chip: { width: 34, height: 26, borderRadius: 6, backgroundColor: c.gold, marginTop: 10 },
    xq: { borderWidth: 1, borderColor: c.gold, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, marginTop: 6 },
    pill: { backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9, marginRight: 8 },
    pillK: { color: c.onDeepSoft, fontSize: 10 },
    pillV: { color: c.onDeep, fontWeight: '700', fontSize: 12 },
    strip: { position: 'absolute', left: 0, right: 0, top: 20, height: 34, backgroundColor: 'rgba(0,0,0,.35)' },
    sig: { backgroundColor: c.surface, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, width: 100 },
    act: { flex: 1, marginHorizontal: 4, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
    bar: { height: 6, borderRadius: 3, backgroundColor: c.line, marginTop: 5, overflow: 'hidden' },
    refill: { color: c.red, backgroundColor: c.redSoft, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
    refill2: { color: c.teal, backgroundColor: c.tealSoft, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
    ic: { width: 38, height: 38, borderRadius: 10, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
    msg: { maxWidth: '82%', padding: 11, borderRadius: 14, marginBottom: 8 },
    bot: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
    me: { backgroundColor: c.teal, alignSelf: 'flex-end' },
    send: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.teal, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
    num: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.deepSurface, alignItems: 'center', justifyContent: 'center' },
    li: { justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: c.line },
    nav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 6, paddingBottom: 8 },
    center: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.deepSurface, alignItems: 'center', justifyContent: 'center', marginTop: -28, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, borderWidth: 3, borderColor: c.bg },
    modal: { flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center' },
  });
