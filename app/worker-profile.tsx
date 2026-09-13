import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../src/lib/supabase';

type WorkerReview = {
  id: string;
  job_id: string;
  worker_id: string;
  rating: number;
  comment: string | null;
  photo_url: string | null;
  created_at: string;
};

type CompletedJob = {
  id: string;
  category: string;
  title: string;
  completion_photo_url: string | null;
  completed_at: string | null;
};

type PublicWorkerProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function WorkerProfileScreen() {
  const params = useLocalSearchParams<{ workerId?: string; name?: string }>();
  const [workerId, setWorkerId] = useState<string | null>(params.workerId ?? null);
  const [displayName, setDisplayName] = useState(params.name ?? '師傅');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [reviews, setReviews] = useState<WorkerReview[]>([]);
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      let id = params.workerId ?? null;

      if (!id) {
        const { data: userData } = await supabase.auth.getUser();
        id = userData.user?.id ?? null;
        if (!active) return;
        setWorkerId(id);
      }

      if (!id) {
        if (active) setLoading(false);
        return;
      }

      const [profileResult, reviewResult] = await Promise.all([
        supabase
          .from('worker_public_profiles')
          .select('id, display_name, avatar_url')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('worker_reviews')
          .select('id, job_id, worker_id, rating, comment, photo_url, created_at')
          .eq('worker_id', id)
          .order('created_at', { ascending: false }),
      ]);

      if (!active) return;

      const publicProfile = profileResult.data as PublicWorkerProfile | null;
      if (publicProfile?.display_name) setDisplayName(publicProfile.display_name);
      setAvatarUrl(publicProfile?.avatar_url ?? null);

      const rows = (reviewResult.data as WorkerReview[] | null) ?? [];
      const jobIds = rows.map((review) => review.job_id);

      let completedJobs: CompletedJob[] = [];
      if (jobIds.length > 0) {
        const { data: jobRows } = await supabase
          .from('jobs')
          .select('id, category, title, completion_photo_url, completed_at')
          .in('id', jobIds);
        completedJobs = (jobRows as CompletedJob[] | null) ?? [];
      }

      if (!active) return;
      setReviews(rows);
      setJobs(completedJobs);
      setLoading(false);
    }

    load();
    return () => { active = false; };
  }, [params.workerId, params.name]);

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length;
  }, [reviews]);

  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>載入師傅 Profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>

        <View style={styles.heroCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}><Text style={styles.avatarText}>👷</Text></View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          {workerId ? <Text style={styles.verified}>✓ WorkerApp 師傅</Text> : null}
          <Text style={styles.rating}>{reviews.length > 0 ? `★ ${average.toFixed(1)}` : '暫未有評分'}</Text>
          <Text style={styles.reviewCount}>{reviews.length} 個評價</Text>
        </View>

        <Text style={styles.sectionTitle}>客戶評價</Text>

        {reviews.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>暫未有評價</Text>
            <Text style={styles.emptyText}>完成工作後，客戶嘅星級、評語同完成相片會顯示喺呢度。</Text>
          </View>
        ) : (
          reviews.map((review) => {
            const job = jobById.get(review.job_id);
            const photo = review.photo_url || job?.completion_photo_url || null;
            return (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.stars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
                  <Text style={styles.date}>{new Date(review.created_at).toLocaleDateString('zh-HK')}</Text>
                </View>
                {job ? <Text style={styles.jobMeta}>🧰 {job.category} · {job.title}</Text> : null}
                {review.comment ? <Text style={styles.comment}>「{review.comment}」</Text> : null}
                {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  content: { padding: 20, paddingBottom: 80 },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '800', marginBottom: 16 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#E1E9E4' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#EAF8F0', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { fontSize: 40 },
  name: { marginTop: 12, fontSize: 24, fontWeight: '900', color: '#17251E' },
  verified: { marginTop: 4, color: '#0B8D4A', fontWeight: '800', fontSize: 12 },
  rating: { marginTop: 12, fontSize: 22, fontWeight: '900', color: '#A87800' },
  reviewCount: { marginTop: 3, color: '#7A8981', fontWeight: '700' },
  sectionTitle: { marginTop: 24, marginBottom: 12, fontSize: 20, fontWeight: '900', color: '#17251E' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22, borderWidth: 1, borderColor: '#E1E9E4' },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: '#22362C' },
  emptyText: { marginTop: 6, color: '#718178', lineHeight: 20 },
  reviewCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#E1E9E4' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stars: { color: '#D89B00', fontSize: 20, fontWeight: '900' },
  date: { color: '#8A9690', fontSize: 12 },
  jobMeta: { marginTop: 8, color: '#60746A', fontWeight: '700', fontSize: 13 },
  comment: { marginTop: 10, color: '#344A3F', fontSize: 15, lineHeight: 22 },
  photo: { width: '100%', height: 210, borderRadius: 12, marginTop: 12 },
});
