import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../src/lib/supabase';

type MessageRow = {
  id: string;
  job_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type JobRow = {
  id: string;
  title: string;
  customer_id: string | null;
  accepted_quote_id: string | null;
  accepted_worker_name: string | null;
};

type QuoteRow = {
  id: string;
  worker_id: string | null;
};

export default function ChatScreen() {
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = useMemo(
    () => (Array.isArray(params.jobId) ? params.jobId[0] : params.jobId) ?? '',
    [params.jobId]
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [job, setJob] = useState<JobRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initialize() {
      if (!jobId) {
        if (active) setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      if (!active) return;
      setUserId(uid);

      if (!uid) {
        setLoading(false);
        return;
      }

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id,title,customer_id,accepted_quote_id,accepted_worker_name')
        .eq('id', jobId)
        .single();

      if (!active) return;
      if (jobError || !jobData || !jobData.accepted_quote_id) {
        setLoading(false);
        return;
      }

      const typedJob = jobData as JobRow;
      setJob(typedJob);

      let canChat = typedJob.customer_id === uid;
      if (!canChat) {
        const { data: quoteData } = await supabase
          .from('quotes')
          .select('id,worker_id')
          .eq('id', typedJob.accepted_quote_id)
          .maybeSingle();

        canChat = (quoteData as QuoteRow | null)?.worker_id === uid;
      }

      if (!active) return;
      setAuthorized(canChat);

      if (!canChat) {
        setLoading(false);
        return;
      }

      await loadMessages();
      await markChatNotificationsRead(uid);

      channel = supabase
        .channel(`workerapp-chat-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `job_id=eq.${jobId}`,
          },
          async (payload) => {
            const incoming = payload.new as MessageRow;
            setMessages((current) => {
              if (current.some((message) => message.id === incoming.id)) return current;
              return [...current, incoming];
            });

            if (incoming.sender_id !== uid) {
              await markChatNotificationsRead(uid);
            }
          }
        )
        .subscribe();

      setLoading(false);
    }

    async function markChatNotificationsRead(uid: string) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', uid)
        .eq('job_id', jobId)
        .eq('type', 'new_message')
        .eq('is_read', false);
    }

    async function loadMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('id,job_id,sender_id,body,created_at')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (!active) return;
      if (error) {
        Alert.alert('未能載入聊天', error.message);
        return;
      }
      setMessages((data as MessageRow[] | null) ?? []);
    }

    initialize();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [jobId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  async function sendMessage() {
    const body = text.trim();
    if (!body || !jobId || !userId || sending) return;

    setSending(true);
    const { data, error } = await supabase
      .from('messages')
      .insert({ job_id: jobId, sender_id: userId, body })
      .select('id,job_id,sender_id,body,created_at')
      .single();
    setSending(false);

    if (error) {
      Alert.alert('訊息未能送出', error.message);
      return;
    }

    setText('');
    if (data) {
      const sent = data as MessageRow;
      setMessages((current) => {
        if (current.some((message) => message.id === sent.id)) return current;
        return [...current, sent];
      });
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>載入聊天...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!authorized || !job) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ 返回</Text></Pressable>
          <Text style={styles.headerTitle}>聊天</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.unavailableBox}>
          <Text style={styles.unavailableIcon}>🔒</Text>
          <Text style={styles.unavailableTitle}>目前未能使用聊天</Text>
          <Text style={styles.unavailableText}>只有已配對工作嘅客戶同獲選師傅先可以進入呢個對話。</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ 返回</Text></Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>聊天</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{job.title}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messagesArea}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View style={styles.notice}>
            <Text style={styles.noticeText}>✓ 已配對 · 對話只限客戶同獲選師傅</Text>
          </View>

          {messages.length === 0 ? (
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatIcon}>👋</Text>
              <Text style={styles.emptyChatTitle}>開始傾啦</Text>
              <Text style={styles.emptyChatText}>可以確認上門時間、地址細節或工作安排。</Text>
            </View>
          ) : (
            messages.map((message) => {
              const mine = message.sender_id === userId;
              return (
                <View key={message.id} style={[styles.messageRow, mine ? styles.mineRow : styles.theirRow]}>
                  <View style={[styles.bubble, mine ? styles.mineBubble : styles.theirBubble]}>
                    <Text style={[styles.messageText, mine && styles.mineText]}>{message.body}</Text>
                    <Text style={[styles.time, mine && styles.mineTime]}>
                      {new Date(message.created_at).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="輸入訊息…"
            multiline
            maxLength={2000}
            style={styles.input}
          />
          <Pressable
            style={[styles.sendButton, (!text.trim() || sending) && styles.disabledButton]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
          >
            <Text style={styles.sendText}>{sending ? '…' : '送出'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  keyboardView: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEE9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '800' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#17251E' },
  headerSubtitle: { marginTop: 2, fontSize: 12, color: '#718178', maxWidth: 230 },
  headerSpacer: { width: 45 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
  messagesArea: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 24 },
  notice: { alignSelf: 'center', backgroundColor: '#EAF8F0', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16 },
  noticeText: { color: '#0B7A45', fontSize: 12, fontWeight: '800' },
  emptyChat: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 25 },
  emptyChatIcon: { fontSize: 34 },
  emptyChatTitle: { fontSize: 18, fontWeight: '900', color: '#22362C', marginTop: 10 },
  emptyChatText: { color: '#74847C', textAlign: 'center', lineHeight: 20, marginTop: 7 },
  messageRow: { width: '100%', marginBottom: 9 },
  mineRow: { alignItems: 'flex-end' },
  theirRow: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 17, paddingHorizontal: 13, paddingVertical: 9 },
  mineBubble: { backgroundColor: '#0FA958', borderBottomRightRadius: 5 },
  theirBubble: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9E4', borderBottomLeftRadius: 5 },
  messageText: { fontSize: 16, lineHeight: 21, color: '#263A30' },
  mineText: { color: '#FFFFFF' },
  time: { fontSize: 10, color: '#84928B', marginTop: 5, textAlign: 'right' },
  mineTime: { color: '#D9F4E5' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, padding: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E8EEE9' },
  input: { flex: 1, maxHeight: 110, minHeight: 44, borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 18, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 10, fontSize: 16, backgroundColor: '#F9FBFA' },
  sendButton: { backgroundColor: '#0FA958', minWidth: 60, height: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  sendText: { color: '#FFFFFF', fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  unavailableBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  unavailableIcon: { fontSize: 38 },
  unavailableTitle: { fontSize: 20, fontWeight: '900', color: '#22362C', marginTop: 12 },
  unavailableText: { color: '#718178', textAlign: 'center', lineHeight: 21, marginTop: 8 },
});
