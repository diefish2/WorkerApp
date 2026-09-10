import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../src/lib/supabase';

type ChatJob = {
  id: string;
  title: string;
  district: string;
  customer_id: string | null;
  accepted_quote_id: string | null;
  accepted_worker_name: string | null;
  accepted_price: string | null;
};

type OwnQuote = {
  id: string;
  job_id: string;
  worker_id: string | null;
};

export default function ChatsScreen() {
  const [jobs, setJobs] = useState<ChatJob[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);

    if (!uid) {
      setJobs([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [{ data: matchedJobs }, { data: ownQuotes }] = await Promise.all([
      supabase
        .from('jobs')
        .select('id,title,district,customer_id,accepted_quote_id,accepted_worker_name,accepted_price')
        .not('accepted_quote_id', 'is', null)
        .order('updated_at', { ascending: false }),
      supabase
        .from('quotes')
        .select('id,job_id,worker_id')
        .eq('worker_id', uid),
    ]);

    const workerQuoteIds = new Set((ownQuotes as OwnQuote[] | null)?.map((quote) => quote.id) ?? []);
    const participantJobs = ((matchedJobs as ChatJob[] | null) ?? []).filter(
      (job) => job.customer_id === uid || (!!job.accepted_quote_id && workerQuoteIds.has(job.accepted_quote_id))
    );

    setJobs(participantJobs);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadChats();

    const jobsChannel = supabase
      .channel('workerapp-chat-list-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, loadChats)
      .subscribe();

    const quotesChannel = supabase
      .channel('workerapp-chat-list-quotes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, loadChats)
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(quotesChannel);
    };
  }, [loadChats]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.title}>聊天</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>載入聊天...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadChats(); }} />
          }
        >
          <Text style={styles.subtitle}>已配對後，客戶同獲選師傅可以直接對話。</Text>

          {jobs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>暫時未有聊天</Text>
              <Text style={styles.emptyText}>當你有已配對工作，聊天會顯示喺呢度。</Text>
            </View>
          ) : (
            jobs.map((job) => {
              const isCustomer = job.customer_id === userId;
              return (
                <Pressable
                  key={job.id}
                  style={styles.chatCard}
                  onPress={() => router.push({ pathname: '/chat', params: { jobId: job.id } })}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.rolePill}>{isCustomer ? '客戶' : '師傅'}</Text>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                  <Text style={styles.jobTitle}>{job.title}</Text>
                  <Text style={styles.meta}>📍 {job.district || '香港'}</Text>
                  <Text style={styles.meta}>
                    {isCustomer
                      ? `已配對：${job.accepted_worker_name ?? '師傅'}${job.accepted_price ? ` · HK$${job.accepted_price}` : ''}`
                      : `你已獲選${job.accepted_price ? ` · HK$${job.accepted_price}` : ''}`}
                  </Text>
                  <Text style={styles.openText}>打開聊天</Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEE9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '900', color: '#17251E' },
  headerSpacer: { width: 45 },
  content: { padding: 20, paddingBottom: 50 },
  subtitle: { color: '#667A70', lineHeight: 21, marginBottom: 18 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E9E4',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#22362C', marginTop: 10 },
  emptyText: { color: '#74847C', marginTop: 7, textAlign: 'center', lineHeight: 20 },
  chatCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E9E4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rolePill: {
    backgroundColor: '#EAF8F0',
    color: '#0B7A45',
    fontWeight: '800',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 12,
  },
  chevron: { fontSize: 26, color: '#91A098' },
  jobTitle: { fontSize: 18, fontWeight: '900', color: '#1C3026', marginTop: 8 },
  meta: { marginTop: 7, color: '#667A70' },
  openText: { marginTop: 13, color: '#0B8D4A', fontWeight: '900' },
});
