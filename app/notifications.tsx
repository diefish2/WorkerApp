import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../src/lib/supabase';

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  job_id: string | null;
  type: 'new_quote' | 'quote_accepted' | 'new_message';
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initialize() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid || !active) {
        setLoading(false);
        return;
      }

      await loadNotifications();

      channel = supabase
        .channel(`workerapp-notifications-${uid}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${uid}`,
          },
          loadNotifications
        )
        .subscribe();

      if (active) setLoading(false);
    }

    async function loadNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('id,recipient_id,actor_id,job_id,type,title,body,read_at,created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (active) setNotifications((data as NotificationRow[] | null) ?? []);
    }

    initialize();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function markRead(notification: NotificationRow) {
    if (!notification.read_at) {
      const now = new Date().toISOString();
      await supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('id', notification.id);

      setNotifications((current) =>
        current.map((item) => item.id === notification.id ? { ...item, read_at: now } : item)
      );
    }

    if (notification.job_id && (notification.type === 'quote_accepted' || notification.type === 'new_message')) {
      router.push({ pathname: '/chat', params: { jobId: notification.job_id } });
    }
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((item) => !item.read_at).map((item) => item.id);
    if (unreadIds.length === 0) return;

    const now = new Date().toISOString();
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .in('id', unreadIds);

    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>載入通知...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ 返回</Text></Pressable>
        <Text style={styles.headerTitle}>通知</Text>
        <Pressable onPress={markAllRead} disabled={unreadCount === 0}>
          <Text style={[styles.markAll, unreadCount === 0 && styles.disabledText]}>全部已讀</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {unreadCount > 0 ? (
          <Text style={styles.summary}>你有 {unreadCount} 個未讀通知</Text>
        ) : (
          <Text style={styles.summary}>全部通知已讀</Text>
        )}

        {notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>暫時未有通知</Text>
            <Text style={styles.emptyText}>收到新報價、報價被接受或新聊天訊息時，會顯示喺呢度。</Text>
          </View>
        ) : (
          notifications.map((notification) => {
            const unread = !notification.read_at;
            const canOpenChat = !!notification.job_id && (notification.type === 'quote_accepted' || notification.type === 'new_message');
            const icon = notification.type === 'new_quote' ? '💰' : notification.type === 'quote_accepted' ? '✅' : '💬';

            return (
              <Pressable
                key={notification.id}
                style={[styles.card, unread && styles.unreadCard]}
                onPress={() => markRead(notification)}
              >
                <View style={styles.row}>
                  <View style={styles.iconBox}><Text style={styles.icon}>{icon}</Text></View>
                  <View style={styles.textBox}>
                    <View style={styles.titleRow}>
                      <Text style={styles.title}>{notification.title}</Text>
                      {unread ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.body}>{notification.body}</Text>
                    <Text style={styles.time}>
                      {new Date(notification.created_at).toLocaleString('zh-HK')}
                    </Text>
                    {canOpenChat ? <Text style={styles.actionText}>撳入去查看聊天 ›</Text> : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEE9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '800' },
  headerTitle: { fontSize: 19, fontWeight: '900', color: '#17251E' },
  markAll: { color: '#0B8D4A', fontSize: 13, fontWeight: '800' },
  disabledText: { opacity: 0.35 },
  content: { padding: 18, paddingBottom: 40 },
  summary: { color: '#667A70', fontWeight: '700', marginBottom: 13 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E9E4',
    borderRadius: 15,
    padding: 14,
    marginBottom: 10,
  },
  unreadCard: { borderColor: '#A9D8BC', backgroundColor: '#F3FBF6' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EAF8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  icon: { fontSize: 20 },
  textBox: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '900', color: '#22362C' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0FA958' },
  body: { marginTop: 5, color: '#51665B', lineHeight: 20 },
  time: { marginTop: 7, fontSize: 11, color: '#87968E' },
  actionText: { marginTop: 8, color: '#0B8D4A', fontWeight: '800', fontSize: 13 },
  emptyCard: { marginTop: 35, alignItems: 'center', padding: 30, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E1E9E4' },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { marginTop: 10, fontSize: 18, fontWeight: '900', color: '#22362C' },
  emptyText: { marginTop: 7, color: '#718178', textAlign: 'center', lineHeight: 20 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
});
