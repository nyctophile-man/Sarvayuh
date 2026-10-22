// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity as T, ScrollView, Linking, StyleSheet as S } from 'react-native';
import { Row } from '@/components/ui';
import { getAiInit, postAiChat } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';
import { useTheme } from '@/lib/theme';

const AI = () => {
  const { t, lang } = useI18n();
  const { colors, styles: s } = useTheme();
  const st = makeStyles(colors);
  // Used until the backend answers, and if it cannot be reached at all.
  const fallback = useMemo(
    () => ({
      botName: 'SARVAYUH AI',
      tagline: t('ai.tagline'),
      greeting: t('ai.greeting'),
      quickReplies: [
        t('ai.quick.summarize'),
        t('ai.quick.explain'),
        t('ai.quick.reminders'),
        t('ai.quick.tips'),
      ],
      inputPlaceholder: t('ai.placeholder'),
      disclaimer: t('ai.disclaimer'),
    }),
    [t],
  );

  const [server, setServer] = useState(null);
  const [m, setM] = useState([{ b: 1, t: '', style: 'normal', fb: true }]);
  const [chips, setChips] = useState(fallback.quickReplies);
  const [actions, setActions] = useState([]);
  const [v, setV] = useState('');
  const [sending, setSending] = useState(false);
  const sid = useRef(null);
  const scroller = useRef(null);

  // The backend ships English copy; only use it when the app itself is in
  // English so Hindi screens stay fully localized.
  const init = useMemo(() => {
    const base = { ...fallback };
    if (server && lang === 'en') {
      if (server.tagline) base.tagline = server.tagline;
      if (server.inputPlaceholder) base.inputPlaceholder = server.inputPlaceholder;
      if (server.disclaimer) base.disclaimer = server.disclaimer;
      if (server.greeting) base.greeting = server.greeting;
      if (server.botName) base.botName = server.botName;
    }
    return base;
  }, [fallback, server, lang]);

  useEffect(() => {
    let alive = true;
    getAiInit()
      .then((r) => {
        if (!alive || !r || !r.greeting) return;
        setServer(r);
        const serverChips = lang === 'en' ? r.quickReplies : null;
        setChips(serverChips?.length ? serverChips : fallback.quickReplies);
        const greeting = lang === 'en' ? r.greeting : fallback.greeting;
        setM([{ b: 1, t: greeting, style: 'normal', fb: false }]);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [fallback, lang]);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [m.length, sending]);

  const ask = async (text) => {
    const value = String(text || '').trim();
    if (!value || sending) return;
    setM((x) => [...x, { b: 0, t: value, style: 'normal' }]);
    setV('');
    setSending(true);
    try {
      const res = await postAiChat({ message: value, sessionId: sid.current || undefined });
      sid.current = res.sessionId;
      const replies = (res.messages || []).map((x) => ({ b: 1, t: x.text, style: x.style || 'normal' }));
      setM((x) => [...x, ...replies]);
      if (res.quickReplies?.length && lang === 'en') setChips(res.quickReplies);
      setActions(res.actions || []);
    } catch (e) {
      setM((x) => [...x, {
        b: 1,
        t: e.message === 'Login required' ? t('ai.err.login') : t('ai.err.unavailable'),
        style: 'notice',
      }]);
    } finally {
      setSending(false);
    }
  };

  const act = (a) => {
    if (a.type === 'call_emergency') Linking.openURL('tel:' + (a.number || '112')).catch(() => {});
  };

  const bubble = (x) => {
    const text = x.fb ? init.greeting : x.t;
    if (!x.b) return <View style={[s.msg, s.me]}><Text style={{ color: colors.onBrand }}>{text}</Text></View>;
    if (x.style === 'emergency') return <View style={[s.msg, st.alert]}><Text style={st.alertT}>{text}</Text></View>;
    if (x.style === 'notice') return <View style={[s.msg, st.notice]}><Text style={st.noticeT}>{text}</Text></View>;
    return <View style={[s.msg, s.bot]}><Text style={{ color: colors.ink }}>{text}</Text></View>;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        ref={scroller}
        contentContainerStyle={s.pad}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
      >
        <Row style={{ marginBottom: 14 }}>
          <View style={[s.ph, { backgroundColor: colors.teal, width: 40, height: 40, borderRadius: 20, borderWidth: 0 }]}>
            <Text>🪷</Text>
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={{ fontWeight: '700', color: colors.deep, fontSize: 16 }}>{init.botName}</Text>
            <Text style={{ color: colors.mute, fontSize: 12 }}>{init.tagline}</Text>
          </View>
        </Row>

        {m.map((x, i) => <View key={i}>{bubble(x)}</View>)}

        {sending && <Text style={{ color: colors.mute, fontSize: 12, marginTop: 2 }}>{t('ai.typing')}</Text>}

        {actions.length > 0 && (
          <Row style={{ marginTop: 4, marginBottom: 4 }}>
            {actions.map((a, i) =>
              a.type === 'call_emergency' ? (
                <T key={i} onPress={() => act(a)} style={[s.act, { borderColor: colors.red }]} activeOpacity={0.85}>
                    <Text style={{ color: colors.red, fontWeight: '700', fontSize: 13 }}>{t('ai.call', { number: a.number || '112' })}</Text>
                </T>
              ) : (
                  <T key={i} onPress={() => ask(t('ai.askConsult'))} style={[s.act, { borderColor: colors.teal }]} activeOpacity={0.85}>
                    <Text style={{ color: colors.teal, fontWeight: '700', fontSize: 13 }}>{t('ai.consult')}</Text>
                </T>
              )
            )}
          </Row>
        )}

        <Row style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {chips.map((k) => (
            <T key={k} onPress={() => ask(k)} style={s.chp} disabled={sending}>
              <Text style={{ color: colors.teal, fontWeight: '600', fontSize: 12 }}>✨ {k}</Text>
            </T>
          ))}
        </Row>
      </ScrollView>

      <Row style={{ padding: 12 }}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder={init.inputPlaceholder}
          placeholderTextColor={colors.mute}
          value={v}
          onChangeText={setV}
          onSubmitEditing={() => ask(v)}
          editable={!sending}
        />
        <T onPress={() => ask(v)} disabled={sending} style={[s.send, sending && { opacity: 0.6 }]}>
          <Text style={{ color: colors.onBrand, fontSize: 18 }}>➤</Text>
        </T>
      </Row>
      <Text style={{ textAlign: 'center', color: colors.mute, fontSize: 10, paddingBottom: 6, paddingHorizontal: 16 }}>
        {init.disclaimer}
      </Text>
    </View>
  );
};

const makeStyles = (colors) => S.create({
  alert: { backgroundColor: colors.redSoft, borderWidth: 1, borderColor: colors.red },
  alertT: { color: colors.red, fontSize: 13, lineHeight: 19 },
  notice: { backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: colors.amber },
  noticeT: { color: colors.amber, fontSize: 13, lineHeight: 19 },
});

export default AI;
