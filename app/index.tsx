import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { categories } from '../src/data/mockData';
import { supabase } from '../src/lib/supabase';

const JOB_PHOTOS_BUCKET = 'job-photos';
const MAX_QUOTE_ATTEMPTS = 5;
const HK_DISTRICTS = [
  '中西區', '灣仔', '東區', '南區', '油尖旺', '深水埗', '九龍城', '黃大仙', '觀塘',
  '葵青', '荃灣', '屯門', '元朗', '北區', '大埔', '沙田', '西貢', '離島',
] as const;

const SERVICE_LABELS = categories.map((category) => category.label);

type AppMode = 'customer' | 'worker';
type CustomerScreen = 'home' | 'post' | 'myJobs' | 'edit';
type DistrictFilter = '全部地區' | (typeof HK_DISTRICTS)[number];
type CategoryFilter = '全部類別' | string;
type QuoteCloseReason = 'superseded' | 'match_cancelled' | 'declined' | null;

type JobPost = {
  id: string;
  customerId: string | null;
  title: string;
  details: string;
  budget: string;
  district: string;
  category: string;
  photoUri: string | null;
  status: string;
  createdAt: string;
  acceptedQuoteId: string | null;
  acceptedWorkerName: string | null;
  acceptedPrice: string | null;
};

type Quote = {
  id: string;
  jobId: string;
  workerId: string | null;
  workerName: string;
  price: string;
  message: string;
  createdAt: string;
  isActive: boolean;
  attemptNo: number;
  closedAt: string | null;
  closeReason: QuoteCloseReason;
};

type JobFormData = Omit<
  JobPost,
  'id' | 'customerId' | 'status' | 'createdAt' | 'acceptedQuoteId' | 'acceptedWorkerName' | 'acceptedPrice'
>;

type DatabaseJob = {
  id: string;
  customer_id: string | null;
  title: string;
  details: string;
  budget: string;
  district: string;
  category: string;
  photo_url: string | null;
  status: string;
  created_at: string;
  accepted_quote_id: string | null;
  accepted_worker_name: string | null;
  accepted_price: string | null;
};

type DatabaseQuote = {
  id: string;
  job_id: string;
  worker_id: string | null;
  worker_name: string;
  price: string;
  message: string;
  created_at: string;
  is_active: boolean;
  attempt_no: number;
  closed_at: string | null;
  close_reason: QuoteCloseReason;
};

function fromDatabaseJob(job: DatabaseJob): JobPost {
  return {
    id: job.id,
    customerId: job.customer_id ?? null,
    title: job.title,
    details: job.details ?? '',
    budget: job.budget ?? '',
    district: job.district ?? '香港',
    category: job.category ?? '其他',
    photoUri: job.photo_url,
    status: job.status ?? '等待報價',
    createdAt: new Date(job.created_at).toLocaleString('zh-HK'),
    acceptedQuoteId: job.accepted_quote_id ?? null,
    acceptedWorkerName: job.accepted_worker_name ?? null,
    acceptedPrice: job.accepted_price ?? null,
  };
}

function fromDatabaseQuote(quote: DatabaseQuote): Quote {
  return {
    id: quote.id,
    jobId: quote.job_id,
    workerId: quote.worker_id ?? null,
    workerName: quote.worker_name,
    price: quote.price,
    message: quote.message ?? '',
    createdAt: new Date(quote.created_at).toLocaleString('zh-HK'),
    isActive: quote.is_active ?? true,
    attemptNo: quote.attempt_no ?? 1,
    closedAt: quote.closed_at ?? null,
    closeReason: quote.close_reason ?? null,
  };
}

function isRemotePhoto(uri: string) {
  return /^https?:\/\//i.test(uri);
}

function photoFileInfo(uri: string) {
  const cleanUri = uri.split('?')[0].toLowerCase();
  if (cleanUri.endsWith('.png')) return { ext: 'png', contentType: 'image/png' };
  if (cleanUri.endsWith('.webp')) return { ext: 'webp', contentType: 'image/webp' };
  if (cleanUri.endsWith('.heic')) return { ext: 'heic', contentType: 'image/heic' };
  if (cleanUri.endsWith('.heif')) return { ext: 'heif', contentType: 'image/heif' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

async function uploadJobPhoto(uri: string) {
  const { ext, contentType } = photoFileInfo(uri);
  const arrayBuffer = await fetch(uri).then((response) => response.arrayBuffer());
  const filePath = `jobs/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { data, error } = await supabase.storage.from(JOB_PHOTOS_BUCKET).upload(filePath, arrayBuffer, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(JOB_PHOTOS_BUCKET).getPublicUrl(data.path).data.publicUrl;
}

async function resolvePhotoUrl(uri: string | null) {
  if (!uri) return null;
  if (isRemotePhoto(uri)) return uri;
  return uploadJobPhoto(uri);
}

function isHongKongDistrict(value: string) {
  return HK_DISTRICTS.includes(value as (typeof HK_DISTRICTS)[number]);
}

function maxAttempt(quotes: Quote[]) {
  return quotes.reduce((highest, quote) => Math.max(highest, quote.attemptNo), 0);
}

export default function HomeScreen() {
  const [mode, setMode] = useState<AppMode>('customer');
  const [customerScreen, setCustomerScreen] = useState<CustomerScreen>('home');
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [presetCategory, setPresetCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteJob, setQuoteJob] = useState<JobPost | null>(null);

  const myJobs = currentUserId ? jobs.filter((job) => job.customerId === currentUserId) : [];
  const editingJob = myJobs.find((job) => job.id === editingJobId) ?? null;

  useEffect(() => {
    let mounted = true;

    async function initialise() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setCurrentUserId(data.session?.user.id ?? null);
      await Promise.all([loadJobs(), loadQuotes()]);
      if (mounted) setLoading(false);
    }

    initialise();

    const jobsChannel = supabase
      .channel('workerapp-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, loadJobs)
      .subscribe();
    const quotesChannel = supabase
      .channel('workerapp-quotes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, loadQuotes)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(quotesChannel);
    };
  }, []);

  async function loadJobs() {
    const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (!error) setJobs(((data as DatabaseJob[] | null) ?? []).map(fromDatabaseJob));
  }

  async function loadQuotes() {
    const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
    if (!error) setQuotes(((data as DatabaseQuote[] | null) ?? []).map(fromDatabaseQuote));
  }

  function openPost(category?: string) {
    setPresetCategory(category ?? null);
    setCustomerScreen('post');
  }

  function switchMode(nextMode: AppMode) {
    setMode(nextMode);
    setCustomerScreen('home');
    setPresetCategory(null);
  }

  async function addJob(data: JobFormData) {
    if (!currentUserId) {
      Alert.alert('登入已失效', '請重新登入後再發佈需求。');
      return;
    }

    let photoUrl: string | null = null;
    try {
      photoUrl = await resolvePhotoUrl(data.photoUri);
    } catch (error: any) {
      Alert.alert('相片上載失敗', error?.message ?? '請再試一次。');
      return;
    }

    const { error } = await supabase.from('jobs').insert({
      customer_id: currentUserId,
      title: data.title,
      details: data.details,
      budget: data.budget,
      district: data.district,
      category: data.category,
      photo_url: photoUrl,
      status: '等待報價',
    });

    if (error) {
      Alert.alert('發佈失敗', error.message);
      return;
    }

    setPresetCategory(null);
    await loadJobs();
    setCustomerScreen('myJobs');
  }

  async function updateJob(data: JobFormData) {
    if (!editingJobId || !currentUserId) return;
    let photoUrl: string | null = null;
    try {
      photoUrl = await resolvePhotoUrl(data.photoUri);
    } catch (error: any) {
      Alert.alert('相片上載失敗', error?.message ?? '請再試一次。');
      return;
    }

    const { data: updatedRows, error } = await supabase
      .from('jobs')
      .update({
        title: data.title,
        details: data.details,
        budget: data.budget,
        district: data.district,
        category: data.category,
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingJobId)
      .eq('customer_id', currentUserId)
      .select('id');

    if (error) {
      Alert.alert('更新失敗', error.message);
      return;
    }
    if (!updatedRows || updatedRows.length === 0) {
      Alert.alert('無法更新', '你只可以編輯自己發佈嘅需求。');
      await loadJobs();
      setCustomerScreen('myJobs');
      return;
    }

    setEditingJobId(null);
    await loadJobs();
    setCustomerScreen('myJobs');
  }

  function confirmDeleteJob(job: JobPost) {
    Alert.alert('刪除需求？', `確定唔再需要「${job.title}」？刪除後所有相關報價都會一齊刪除。`, [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deleteJob(job.id) },
    ]);
  }

  async function deleteJob(jobId: string) {
    if (!currentUserId) return;
    const { data, error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId)
      .eq('customer_id', currentUserId)
      .select('id');
    if (error) {
      Alert.alert('刪除失敗', error.message);
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('無法刪除', '你只可以刪除自己發佈嘅需求。');
      return;
    }
    await Promise.all([loadJobs(), loadQuotes()]);
  }

  async function submitQuote(jobId: string, workerName: string, price: string, message: string) {
    const cleanPrice = price.replace(/\D/g, '');
    if (!cleanPrice) {
      Alert.alert('請輸入報價');
      return false;
    }

    if (!currentUserId) {
      Alert.alert('登入已失效', '請重新登入後再報價。');
      return false;
    }

    const job = jobs.find((item) => item.id === jobId);
    if (!job) return false;

    if (job.customerId === currentUserId) {
      Alert.alert('不能報價', '你唔可以對自己發佈嘅工作報價。');
      return false;
    }

    if (job.acceptedQuoteId) {
      Alert.alert('工作已配對', '客戶已經接受另一個報價。');
      return false;
    }

    const myJobQuotes = quotes.filter(
      (quote) => quote.jobId === jobId && quote.workerId === currentUserId
    );

    if (maxAttempt(myJobQuotes) >= MAX_QUOTE_ATTEMPTS) {
      Alert.alert('已達上限', '你對呢個工作已經用完 5 次報價機會。');
      return false;
    }

    const { error } = await supabase.rpc('submit_job_quote', {
      p_job_id: jobId,
      p_worker_name: workerName.trim() || '師傅',
      p_price: cleanPrice,
      p_message: message.trim(),
    });

    if (error) {
      const limitReached = /attempt limit/i.test(error.message);
      const ownJob = /own job/i.test(error.message);
      const matched = /already matched/i.test(error.message);
      Alert.alert(
        '報價失敗',
        limitReached
          ? '你對呢個工作已經用完 5 次報價機會。'
          : ownJob
            ? '你唔可以對自己發佈嘅工作報價。'
            : matched
              ? '呢個工作已經配對，暫時唔接受新報價。'
              : error.message
      );
      return false;
    }

    await loadQuotes();
    return true;
  }

  function confirmAcceptQuote(job: JobPost, quote: Quote) {
    if (!quote.isActive) {
      Alert.alert('歷史報價', '呢個報價已經失效，不能再接受。');
      return;
    }

    Alert.alert('接受呢個報價？', `${quote.workerName}：HK$${quote.price}\n\n接受後，工作會標記為「已配對」。`, [
      { text: '取消', style: 'cancel' },
      { text: '接受報價', onPress: () => acceptQuote(job, quote) },
    ]);
  }

  async function acceptQuote(job: JobPost, quote: Quote) {
    if (job.acceptedQuoteId || !quote.isActive) return;

    const { data, error } = await supabase.rpc('accept_job_quote', {
      p_job_id: job.id,
      p_quote_id: quote.id,
    });

    if (error) {
      const inactive = /no longer active/i.test(error.message);
      Alert.alert('接受失敗', inactive ? '呢個係歷史報價，已經不能接受。' : error.message);
      await Promise.all([loadJobs(), loadQuotes()]);
      return;
    }

    if (!data) {
      Alert.alert('已經配對', '呢個需求可能已經接受咗另一個報價。');
      await loadJobs();
      return;
    }

    await Promise.all([loadJobs(), loadQuotes()]);
    Alert.alert('配對成功', `你已選擇 ${quote.workerName}，報價 HK$${quote.price}。`);
  }

  function confirmDeclineQuote(job: JobPost, quote: Quote) {
    if (!quote.isActive || job.acceptedQuoteId) return;
    Alert.alert(
      '拒絕呢個報價？',
      `${quote.workerName}：HK$${quote.price}\n\n拒絕後會保留喺歷史報價，師傅如果仲有次數可以再次報價。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '拒絕報價', style: 'destructive', onPress: () => declineQuote(job, quote) },
      ]
    );
  }

  async function declineQuote(job: JobPost, quote: Quote) {
    const { data, error } = await supabase.rpc('decline_job_quote', {
      p_job_id: job.id,
      p_quote_id: quote.id,
    });

    if (error) {
      Alert.alert('拒絕失敗', error.message);
      await loadQuotes();
      return;
    }

    if (!data) {
      Alert.alert('狀態已更新', '呢個報價已經唔係可處理狀態。');
    }

    await loadQuotes();
  }

  function confirmCancelMatch(job: JobPost) {
    if (!job.acceptedQuoteId) return;
    Alert.alert('取消已配對工作？', `你確定要取消「${job.title}」嘅配對嗎？\n\n取消後，今輪報價會保留為歷史，工作會重新開放畀所有師傅報價。`, [
      { text: '保留配對', style: 'cancel' },
      { text: '確認取消', style: 'destructive', onPress: () => cancelMatch(job) },
    ]);
  }

  async function cancelMatch(job: JobPost) {
    if (!job.acceptedQuoteId) return;

    const { data, error } = await supabase.rpc('cancel_job_match', {
      p_job_id: job.id,
    });

    if (error) {
      const notAllowed = /not allowed/i.test(error.message);
      Alert.alert(
        '取消失敗',
        notAllowed ? '只有發佈呢個需求嘅 Customer 或已配對嘅師傅可以取消。' : error.message
      );
      return;
    }

    if (!data) {
      Alert.alert('狀態已更新', '呢個工作目前已經唔係配對狀態。');
      await loadJobs();
      return;
    }

    await Promise.all([loadJobs(), loadQuotes()]);
    Alert.alert('配對已取消', '舊報價已保留為歷史，工作已重新開放報價。');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>WorkerApp</Text>
          <Text style={styles.tagline}>香港本地幫手平台</Text>
        </View>
        <View style={styles.modeSwitch}>
          <ModeButton label="客戶" active={mode === 'customer'} onPress={() => switchMode('customer')} />
          <ModeButton label="師傅" active={mode === 'worker'} onPress={() => switchMode('worker')} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>連接 WorkerApp...</Text>
          </View>
        ) : (
          <>
            {mode === 'customer' && customerScreen === 'home' && (
              <CustomerHome myJobCount={myJobs.length} onPostJob={openPost} onMyJobs={() => setCustomerScreen('myJobs')} />
            )}
            {mode === 'customer' && customerScreen === 'post' && (
              <JobFormScreen
                heading="發佈需求"
                submitLabel="發佈需求"
                presetCategory={presetCategory}
                onBack={() => { setPresetCategory(null); setCustomerScreen('home'); }}
                onSubmit={addJob}
              />
            )}
            {mode === 'customer' && customerScreen === 'edit' && editingJob && (
              <JobFormScreen
                heading="編輯需求"
                submitLabel="儲存更改"
                initialJob={editingJob}
                onBack={() => { setEditingJobId(null); setCustomerScreen('myJobs'); }}
                onSubmit={updateJob}
              />
            )}
            {mode === 'customer' && customerScreen === 'myJobs' && (
              <MyJobsScreen
                jobs={myJobs}
                quotes={quotes}
                onBack={() => setCustomerScreen('home')}
                onPostAnother={() => openPost()}
                onEdit={(jobId) => { setEditingJobId(jobId); setCustomerScreen('edit'); }}
                onDelete={confirmDeleteJob}
                onAcceptQuote={confirmAcceptQuote}
                onDeclineQuote={confirmDeclineQuote}
                onCancelMatch={confirmCancelMatch}
              />
            )}
            {mode === 'worker' && (
              <WorkerHome
                jobs={jobs}
                quotes={quotes}
                currentUserId={currentUserId}
                onQuote={setQuoteJob}
                onCancelMatch={confirmCancelMatch}
              />
            )}
          </>
        )}
      </ScrollView>

      <QuoteModal
        job={quoteJob}
        quotes={quotes}
        currentUserId={currentUserId}
        visible={!!quoteJob}
        onClose={() => setQuoteJob(null)}
        onSubmit={submitQuote}
      />
    </SafeAreaView>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function CustomerHome({ myJobCount, onPostJob, onMyJobs }: {
  myJobCount: number;
  onPostJob: (category?: string) => void;
  onMyJobs: () => void;
}) {
  return (
    <>
      <Text style={styles.location}>📍 香港</Text>
      <Text style={styles.heroTitle}>屋企有嘢要整？</Text>
      <Text style={styles.heroSubtitle}>出個需求，等附近師傅直接向你報價。</Text>
      <Pressable style={styles.primaryButton} onPress={() => onPostJob()}>
        <Text style={styles.primaryButtonText}>＋ 發佈需求</Text>
      </Pressable>
      <Pressable style={styles.myJobsButton} onPress={onMyJobs}>
        <Text style={styles.myJobsButtonText}>我的需求</Text>
        <View style={styles.countBadge}><Text style={styles.countBadgeText}>{myJobCount}</Text></View>
      </Pressable>
      <Text style={styles.sectionTitle}>服務類別</Text>
      <View style={styles.categoryGrid}>
        {categories.map((category) => (
          <Pressable key={category.label} style={styles.categoryCard} onPress={() => onPostJob(category.label)}>
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <Text style={styles.categoryLabel}>{category.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function JobFormScreen({ heading, submitLabel, initialJob, presetCategory, onBack, onSubmit }: {
  heading: string;
  submitLabel: string;
  initialJob?: JobPost;
  presetCategory?: string | null;
  onBack: () => void;
  onSubmit: (data: JobFormData) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialJob?.title ?? '');
  const [details, setDetails] = useState(initialJob?.details ?? '');
  const [budget, setBudget] = useState(initialJob?.budget ?? '');
  const [district, setDistrict] = useState(initialJob?.district && isHongKongDistrict(initialJob.district) ? initialJob.district : '');
  const [category, setCategory] = useState(initialJob?.category ?? presetCategory ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(initialJob?.photoUri ?? null);
  const [submitting, setSubmitting] = useState(false);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相簿權限', '請允許 WorkerApp 存取相片。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) setPhotoUri(result.assets[0].uri);
  }

  async function submit() {
    if (!category) {
      Alert.alert('請選擇服務類別', '例如電工、水喉、冷氣，或者其他。');
      return;
    }
    if (!title.trim()) {
      Alert.alert('請輸入需要', '例如：廚房水喉漏水');
      return;
    }
    if (!district) {
      Alert.alert('請選擇地區', '請選擇工作所在嘅香港地區。');
      return;
    }
    setSubmitting(true);
    await onSubmit({ title: title.trim(), details: details.trim(), budget: budget.trim(), district, category, photoUri });
    setSubmitting(false);
  }

  return (
    <>
      <Pressable onPress={onBack}><Text style={styles.back}>‹ 返回</Text></Pressable>
      <Text style={styles.pageTitle}>{heading}</Text>

      <Text style={styles.label}>服務類別</Text>
      <Text style={styles.fieldHint}>先揀最接近你需要嘅類別</Text>
      <View style={styles.choiceGrid}>
        {categories.map((item) => {
          const selected = category === item.label;
          return (
            <Pressable key={item.label} style={[styles.choiceChip, selected && styles.choiceChipActive]} onPress={() => setCategory(item.label)}>
              <Text style={styles.choiceIcon}>{item.icon}</Text>
              <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>你需要咩幫手？</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="例如：廚房水喉漏水" style={styles.input} />
      <Text style={styles.label}>詳細描述</Text>
      <TextInput value={details} onChangeText={setDetails} placeholder="講多少少情況…" multiline style={[styles.input, styles.textArea]} />

      <Text style={styles.label}>地區</Text>
      <Text style={styles.fieldHint}>選擇工作所在嘅香港地區</Text>
      <View style={styles.districtGrid}>
        {HK_DISTRICTS.map((item) => {
          const selected = district === item;
          return (
            <Pressable key={item} style={[styles.districtChip, selected && styles.districtChipActive]} onPress={() => setDistrict(item)}>
              <Text style={[styles.districtChipText, selected && styles.districtChipTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>相片</Text>
      {photoUri ? (
        <View style={styles.photoPreviewCard}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          <View style={styles.photoActions}>
            <Pressable style={styles.secondaryButton} onPress={pickPhoto}><Text style={styles.secondaryText}>更換相片</Text></Pressable>
            <Pressable style={styles.removeButton} onPress={() => setPhotoUri(null)}><Text style={styles.removeText}>移除</Text></Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.photoBox} onPress={pickPhoto}>
          <Text style={styles.photoPlus}>＋</Text><Text style={styles.photoText}>從相簿選擇相片</Text>
        </Pressable>
      )}

      <Text style={styles.label}>你心目中嘅價錢（可選）</Text>
      <TextInput value={budget} onChangeText={(value) => setBudget(value.replace(/\D/g, ''))} placeholder="例如 600" keyboardType="numeric" style={styles.input} />
      <Text style={styles.currencyHint}>HKD</Text>
      <Pressable style={[styles.primaryButton, submitting && styles.disabledButton]} onPress={submit} disabled={submitting}>
        <Text style={styles.primaryButtonText}>{submitting ? '上載及處理中...' : submitLabel}</Text>
      </Pressable>
    </>
  );
}

function MyJobsScreen({ jobs, quotes, onBack, onPostAnother, onEdit, onDelete, onAcceptQuote, onDeclineQuote, onCancelMatch }: {
  jobs: JobPost[];
  quotes: Quote[];
  onBack: () => void;
  onPostAnother: () => void;
  onEdit: (jobId: string) => void;
  onDelete: (job: JobPost) => void;
  onAcceptQuote: (job: JobPost, quote: Quote) => void;
  onDeclineQuote: (job: JobPost, quote: Quote) => void;
  onCancelMatch: (job: JobPost) => void;
}) {
  return (
    <>
      <Pressable onPress={onBack}><Text style={styles.back}>‹ 主頁</Text></Pressable>
      <View style={styles.rowBetween}>
        <Text style={styles.pageTitle}>我的需求</Text>
        <Pressable onPress={onPostAnother}><Text style={styles.addAnother}>＋ 新需求</Text></Pressable>
      </View>
      {jobs.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>暫時未有需求</Text></View> : jobs.map((job) => (
        <CustomerJobCard
          key={job.id}
          job={job}
          quotes={quotes.filter((quote) => quote.jobId === job.id)}
          onEdit={() => onEdit(job.id)}
          onDelete={() => onDelete(job)}
          onAcceptQuote={(quote) => onAcceptQuote(job, quote)}
          onDeclineQuote={(quote) => onDeclineQuote(job, quote)}
          onCancelMatch={() => onCancelMatch(job)}
        />
      ))}
    </>
  );
}

function CustomerJobCard({ job, quotes, onEdit, onDelete, onAcceptQuote, onDeclineQuote, onCancelMatch }: {
  job: JobPost;
  quotes: Quote[];
  onEdit: () => void;
  onDelete: () => void;
  onAcceptQuote: (quote: Quote) => void;
  onDeclineQuote: (quote: Quote) => void;
  onCancelMatch: () => void;
}) {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const matched = !!job.acceptedQuoteId;
  const activeQuotes = quotes.filter((quote) => quote.isActive);
  const historyQuotes = quotes
    .filter((quote) => !quote.isActive)
    .sort((a, b) => b.attemptNo - a.attemptNo);

  return (
    <View style={styles.jobCard}>
      {job.photoUri && <Image source={{ uri: job.photoUri }} style={styles.jobPhoto} />}
      <View style={styles.rowBetween}>
        <Text style={[styles.statusPill, matched && styles.matchedPill]}>{job.status}</Text>
        <Text style={styles.time}>{job.createdAt}</Text>
      </View>
      <Text style={styles.jobTitle}>{job.title}</Text>
      <Text style={styles.jobMeta}>🧰 {job.category}　📍 {job.district}</Text>
      {job.details ? <Text style={styles.jobDetails}>{job.details}</Text> : null}
      <Text style={styles.jobBudget}>{job.budget ? `你嘅預算：HK$${job.budget}` : '等師傅報價'}</Text>

      {matched && (
        <View style={styles.matchedCard}>
          <Text style={styles.matchedTitle}>✓ 已配對師傅</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.matchedWorker}>{job.acceptedWorkerName}</Text>
            <Text style={styles.matchedPrice}>HK${job.acceptedPrice}</Text>
          </View>
          <Pressable style={styles.cancelMatchButton} onPress={onCancelMatch}><Text style={styles.cancelMatchText}>取消已配對</Text></Pressable>
        </View>
      )}

      <View style={styles.quoteHeader}>
        <Text style={styles.quoteSectionTitle}>目前報價</Text>
        <Text style={styles.quoteCount}>{activeQuotes.length}</Text>
      </View>

      {activeQuotes.length === 0 ? (
        <Text style={styles.noQuotes}>暫時未有可處理嘅報價。</Text>
      ) : activeQuotes.map((quote) => {
        const selected = quote.id === job.acceptedQuoteId;
        return (
          <View key={quote.id} style={[styles.quoteCard, selected && styles.selectedQuoteCard]}>
            <View style={styles.rowBetween}>
              <Text style={styles.workerName}>{quote.workerName}</Text>
              <Text style={styles.quotePrice}>HK${quote.price}</Text>
            </View>
            <Text style={styles.quoteAttempt}>第 {quote.attemptNo} 次報價</Text>
            {quote.message ? <Text style={styles.quoteMessage}>{quote.message}</Text> : null}
            <Text style={styles.time}>{quote.createdAt}</Text>
            {selected ? (
              <Text style={styles.selectedLabel}>✓ 已接受呢個報價</Text>
            ) : !matched ? (
              <View style={styles.quoteActionRow}>
                <Pressable style={styles.acceptQuoteButtonInline} onPress={() => onAcceptQuote(quote)}>
                  <Text style={styles.acceptQuoteText}>接受報價</Text>
                </Pressable>
                <Pressable style={styles.declineQuoteButton} onPress={() => onDeclineQuote(quote)}>
                  <Text style={styles.declineQuoteText}>拒絕</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.notSelectedLabel}>未獲選</Text>
            )}
          </View>
        );
      })}

      {historyQuotes.length > 0 && (
        <View style={styles.historyList}>
          <Pressable style={styles.historyListHeader} onPress={() => setHistoryExpanded((expanded) => !expanded)}>
            <Text style={styles.historyListTitle}>歷史報價</Text>
            <View style={styles.historyHeaderRight}>
              <Text style={styles.historyListCount}>{historyQuotes.length}</Text>
              <Text style={styles.historyChevron}>{historyExpanded ? '▲' : '▼'}</Text>
            </View>
          </Pressable>
          {historyExpanded && (
            <>
              {historyQuotes.map((quote) => {
                const historyStatus = quote.closeReason === 'declined'
                  ? '已拒絕'
                  : quote.closeReason === 'match_cancelled'
                    ? '配對已取消'
                    : '師傅已更新報價';
                return (
                  <View key={quote.id} style={styles.historyRow}>
                    <View style={styles.historyMain}>
                      <Text style={styles.historyName} numberOfLines={1}>{quote.workerName}</Text>
                      <Text style={styles.historyMeta}>第 {quote.attemptNo} 次 · {historyStatus}</Text>
                    </View>
                    <Text style={styles.historyPrice}>HK${quote.price}</Text>
                  </View>
                );
              })}
              <Text style={styles.historyFootnote}>歷史報價只供查看，不能再接受。</Text>
            </>
          )}
        </View>
      )}

      <View style={styles.jobActions}>
        <Pressable style={styles.editButton} onPress={onEdit}><Text style={styles.editButtonText}>✏️ 編輯</Text></Pressable>
        <Pressable style={styles.deleteButton} onPress={onDelete}><Text style={styles.deleteButtonText}>刪除需求</Text></Pressable>
      </View>
    </View>
  );
}

function WorkerHome({ jobs, quotes, currentUserId, onQuote, onCancelMatch }: {
  jobs: JobPost[];
  quotes: Quote[];
  currentUserId: string | null;
  onQuote: (job: JobPost) => void;
  onCancelMatch: (job: JobPost) => void;
}) {
  const [districtFilter, setDistrictFilter] = useState<DistrictFilter>('全部地區');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('全部類別');

  const filteredJobs = jobs.filter((job) => {
    const districtMatches = districtFilter === '全部地區' || job.district === districtFilter;
    const categoryMatches = categoryFilter === '全部類別' || job.category === categoryFilter;
    return districtMatches && categoryMatches;
  });

  return (
    <>
      <View style={styles.workerHero}>
        <Text style={styles.online}>● Realtime 已連線</Text>
        <Text style={styles.heroTitle}>附近新工作</Text>
        <Text style={styles.heroSubtitle}>可以按服務類別同地區篩選工作。</Text>
      </View>

      <Text style={styles.filterLabel}>服務類別</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['全部類別', ...SERVICE_LABELS] as CategoryFilter[]).map((item) => {
          const selected = categoryFilter === item;
          return (
            <Pressable key={item} style={[styles.filterChip, selected && styles.filterChipActive]} onPress={() => setCategoryFilter(item)}>
              <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.filterLabel, { marginTop: 16 }]}>工作地區</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['全部地區', ...HK_DISTRICTS] as DistrictFilter[]).map((item) => {
          const selected = districtFilter === item;
          return (
            <Pressable key={item} style={[styles.filterChip, selected && styles.filterChipActive]} onPress={() => setDistrictFilter(item)}>
              <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.filterSummary}>符合條件：{filteredJobs.length} 個工作</Text>
      {filteredJobs.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>暫時未有符合條件嘅工作</Text></View> : filteredJobs.map((job) => {
        const matched = !!job.acceptedQuoteId;
        const acceptedQuote = matched ? quotes.find((quote) => quote.id === job.acceptedQuoteId) : null;
        const isAcceptedWorker = !!currentUserId && acceptedQuote?.workerId === currentUserId;
        const isOwnJob = !!currentUserId && job.customerId === currentUserId;
        const myQuotes = currentUserId
          ? quotes.filter((quote) => quote.jobId === job.id && quote.workerId === currentUserId)
          : [];
        const activeMyQuote = myQuotes.find((quote) => quote.isActive);
        const usedAttempts = maxAttempt(myQuotes);
        const remainingAttempts = Math.max(0, MAX_QUOTE_ATTEMPTS - usedAttempts);

        return (
          <View key={job.id} style={styles.jobCard}>
            {job.photoUri && <Image source={{ uri: job.photoUri }} style={styles.jobPhoto} />}
            <View style={styles.rowBetween}>
              <Text style={[styles.newPill, matched && styles.matchedPill]}>{matched ? '已配對' : '新工作'}</Text>
              <Text style={styles.time}>{job.createdAt}</Text>
            </View>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={styles.jobMeta}>🧰 {job.category}　📍 {job.district}</Text>
            {job.details ? <Text style={styles.jobDetails}>{job.details}</Text> : null}
            <Text style={styles.jobBudget}>{job.budget ? `客人預算：HK$${job.budget}` : '客人等你報價'}</Text>

            {matched ? (
              <View style={styles.workerMatchedCard}>
                <Text style={styles.matchedTitle}>{isAcceptedWorker ? '✓ 你已獲客戶接受' : '🔒 已配對 / Deal sealed'}</Text>
                {isAcceptedWorker ? (
                  <>
                    <Text style={styles.jobDetails}>已接受：{job.acceptedWorkerName} · HK${job.acceptedPrice}</Text>
                    <Text style={styles.attemptInfo}>如果配對取消，今次報價會保留為歷史。</Text>
                    <Pressable style={styles.cancelMatchButton} onPress={() => onCancelMatch(job)}>
                      <Text style={styles.cancelMatchText}>取消已配對</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.jobDetails}>客戶已經選擇師傅，暫時唔再接受報價。</Text>
                )}
              </View>
            ) : isOwnJob ? (
              <View style={styles.ownJobCard}>
                <Text style={styles.ownJobTitle}>你發佈的工作</Text>
                <Text style={styles.jobDetails}>你唔可以對自己嘅工作報價。</Text>
              </View>
            ) : (
              <>
                <Text style={styles.attemptInfo}>
                  報價機會：剩餘 {remainingAttempts} 次（最多 {MAX_QUOTE_ATTEMPTS} 次）
                </Text>
                {activeMyQuote ? (
                  <>
                    <Text style={styles.currentQuoteInfo}>目前報價：HK${activeMyQuote.price} · 第 {activeMyQuote.attemptNo} 次</Text>
                    <Text style={styles.fieldHint}>再次提交新價會使用 1 次報價機會。</Text>
                    {remainingAttempts > 0 ? (
                      <Pressable style={styles.primaryButtonSmall} onPress={() => onQuote(job)}>
                        <Text style={styles.primaryButtonText}>重新報價</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.limitCard}>
                        <Text style={styles.limitText}>已用完 5 次報價機會</Text>
                      </View>
                    )}
                  </>
                ) : remainingAttempts > 0 ? (
                  <Pressable style={styles.primaryButtonSmall} onPress={() => onQuote(job)}>
                    <Text style={styles.primaryButtonText}>{usedAttempts > 0 ? '再次報價' : '立即報價'}</Text>
                  </Pressable>
                ) : (
                  <View style={styles.limitCard}>
                    <Text style={styles.limitText}>已用完 5 次報價機會</Text>
                  </View>
                )}
              </>
            )}
          </View>
        );
      })}
    </>
  );
}

function QuoteModal({ job, quotes, currentUserId, visible, onClose, onSubmit }: {
  job: JobPost | null;
  quotes: Quote[];
  currentUserId: string | null;
  visible: boolean;
  onClose: () => void;
  onSubmit: (jobId: string, workerName: string, price: string, message: string) => Promise<boolean>;
}) {
  const [workerName, setWorkerName] = useState('師傅');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function prepareQuote() {
      if (!visible || !job) return;

      const activeQuote = currentUserId
        ? quotes.find((quote) => quote.jobId === job.id && quote.workerId === currentUserId && quote.isActive)
        : null;

      setPrice(activeQuote?.price ?? '');
      setMessage(activeQuote?.message ?? '');

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid || !active) {
        if (active) setWorkerName(activeQuote?.workerName || '師傅');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', uid)
        .maybeSingle();

      if (active) setWorkerName(profile?.display_name?.trim() || activeQuote?.workerName || '師傅');
    }

    prepareQuote();

    return () => {
      active = false;
    };
  }, [visible, job?.id, currentUserId, quotes]);

  async function submit() {
    if (!job) return;
    setSubmitting(true);
    const ok = await onSubmit(job.id, workerName, price, message);
    setSubmitting(false);
    if (ok) {
      Alert.alert('報價已送出', '客戶會即時喺「我的需求」收到最新報價。');
      onClose();
    }
  }

  const myJobQuotes = job && currentUserId
    ? quotes.filter((quote) => quote.jobId === job.id && quote.workerId === currentUserId)
    : [];
  const activeQuote = myJobQuotes.find((quote) => quote.isActive) ?? null;
  const usedAttempts = maxAttempt(myJobQuotes);
  const remainingAttempts = Math.max(0, MAX_QUOTE_ATTEMPTS - usedAttempts);
  const nextAttempt = Math.min(MAX_QUOTE_ATTEMPTS, usedAttempts + 1);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}>
        <Text style={styles.modalTitle}>{activeQuote ? '重新報價' : usedAttempts > 0 ? '再次報價' : '提交報價'}</Text>
        <Text style={styles.modalJob}>{job?.category} · {job?.title}</Text>
        <Text style={styles.attemptInfo}>
          {remainingAttempts > 0
            ? `今次會係第 ${nextAttempt} 次報價；提交後剩餘 ${Math.max(0, remainingAttempts - 1)} 次。`
            : '你已經用完 5 次報價機會。'}
        </Text>
        <Text style={styles.label}>師傅名稱</Text>
        <TextInput value={workerName} onChangeText={setWorkerName} style={styles.input} />
        <Text style={styles.fieldHint}>預設名稱可以喺「帳戶」修改。</Text>
        <Text style={styles.label}>報價（HKD）</Text>
        <TextInput
          value={price}
          onChangeText={(value) => setPrice(value.replace(/\D/g, ''))}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="例如 600"
          style={styles.input}
        />
        <Text style={styles.label}>留言（可選）</Text>
        <TextInput value={message} onChangeText={setMessage} placeholder="例如：今日下午可以上門，包基本材料。" multiline style={[styles.input, styles.textAreaSmall]} />
        <View style={styles.modalActions}>
          <Pressable style={styles.secondaryButton} onPress={onClose}><Text style={styles.secondaryText}>取消</Text></Pressable>
          <Pressable
            style={[styles.acceptButton, (submitting || remainingAttempts === 0) && styles.disabledButton]}
            onPress={submit}
            disabled={submitting || remainingAttempts === 0}
          >
            <Text style={styles.primaryButtonText}>{submitting ? '送出中...' : '送出報價'}</Text>
          </Pressable>
        </View>
      </View></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8EEE9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: 24, fontWeight: '800', color: '#0B7A45' },
  tagline: { fontSize: 12, color: '#688076', marginTop: 2 },
  modeSwitch: { flexDirection: 'row', backgroundColor: '#EEF4F0', padding: 3, borderRadius: 12 },
  modeButton: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9 },
  modeButtonActive: { backgroundColor: '#0FA958' },
  modeText: { color: '#587066', fontWeight: '700' },
  modeTextActive: { color: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 120 },
  loadingBox: { paddingVertical: 80, alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
  location: { color: '#60776D', fontWeight: '600', marginBottom: 16 },
  heroTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#17251E' },
  heroSubtitle: { fontSize: 16, lineHeight: 23, color: '#617168', marginTop: 8, marginBottom: 18 },
  primaryButton: { backgroundColor: '#0FA958', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginVertical: 10 },
  primaryButtonSmall: { backgroundColor: '#0FA958', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  acceptButton: { flex: 1, backgroundColor: '#0FA958', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  disabledButton: { opacity: 0.55 },
  myJobsButton: { marginTop: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8E1', borderRadius: 14, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myJobsButtonText: { fontSize: 16, color: '#294338', fontWeight: '800' },
  countBadge: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: '#EAF8F0', alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { color: '#0B7A45', fontWeight: '800' },
  sectionTitle: { marginTop: 26, marginBottom: 14, fontSize: 20, fontWeight: '800', color: '#17251E' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '30%', backgroundColor: '#FFFFFF', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E6ECE8' },
  categoryIcon: { fontSize: 24, marginBottom: 6 },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: '#314139' },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#17251E', marginBottom: 22 },
  label: { fontSize: 15, fontWeight: '700', color: '#32443B', marginBottom: 8, marginTop: 12 },
  fieldHint: { marginTop: -3, marginBottom: 10, color: '#7A8B82', fontSize: 12 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  textAreaSmall: { minHeight: 80, textAlignVertical: 'top' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  choiceChip: { minWidth: '30%', flexGrow: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E2DB', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11 },
  choiceChipActive: { backgroundColor: '#0FA958', borderColor: '#0FA958' },
  choiceIcon: { fontSize: 17 },
  choiceText: { color: '#4D6559', fontWeight: '800', fontSize: 13 },
  choiceTextActive: { color: '#FFFFFF' },
  districtGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  districtChip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E2DB', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 },
  districtChipActive: { backgroundColor: '#0FA958', borderColor: '#0FA958' },
  districtChipText: { color: '#4D6559', fontWeight: '700', fontSize: 13 },
  districtChipTextActive: { color: '#FFFFFF' },
  photoBox: { height: 105, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9DB5A8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  photoPlus: { fontSize: 28, color: '#0FA958' },
  photoText: { color: '#597066', marginTop: 4, fontWeight: '600' },
  photoPreviewCard: { backgroundColor: '#FFFFFF', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E1E9E4' },
  photoPreview: { width: '100%', height: 210, borderRadius: 10 },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondaryButton: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: '#EDF3EF' },
  secondaryText: { color: '#315243', fontWeight: '800' },
  removeButton: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: '#FFF0F0' },
  removeText: { color: '#B33A3A', fontWeight: '800' },
  currencyHint: { color: '#778980', marginTop: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addAnother: { color: '#0B8D4A', fontWeight: '800', marginBottom: 22 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E4EBE7' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#22362C', textAlign: 'center' },
  jobCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E4EBE7' },
  jobPhoto: { width: '100%', height: 185, borderRadius: 12, marginBottom: 14 },
  statusPill: { backgroundColor: '#FFF7D6', color: '#806A00', fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, overflow: 'hidden' },
  newPill: { backgroundColor: '#EAF8F0', color: '#0B7A45', fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, overflow: 'hidden' },
  matchedPill: { backgroundColor: '#E5F4FF', color: '#176A9A' },
  time: { color: '#87968E', fontSize: 12 },
  jobTitle: { fontSize: 19, fontWeight: '800', color: '#1C3026', marginTop: 12 },
  jobMeta: { marginTop: 7, color: '#667A70' },
  jobDetails: { marginTop: 10, color: '#455A50', lineHeight: 21 },
  jobBudget: { marginTop: 12, fontSize: 17, fontWeight: '900', color: '#17251E' },
  jobActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  editButton: { flex: 1, borderWidth: 1, borderColor: '#B9D8C6', backgroundColor: '#F3FBF6', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  editButtonText: { color: '#0B7A45', fontWeight: '800', fontSize: 15 },
  deleteButton: { flex: 1, borderWidth: 1, borderColor: '#F1B8B8', backgroundColor: '#FFF5F5', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  deleteButtonText: { color: '#B33A3A', fontWeight: '800', fontSize: 15 },
  workerHero: { padding: 18, borderRadius: 18, backgroundColor: '#EAF8F0', marginBottom: 18 },
  online: { color: '#0B8D4A', fontWeight: '800', marginBottom: 10 },
  filterLabel: { fontSize: 15, fontWeight: '900', color: '#263A30', marginBottom: 10 },
  filterRow: { gap: 8, paddingRight: 10 },
  filterChip: { borderWidth: 1, borderColor: '#D7E2DB', backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  filterChipActive: { backgroundColor: '#0FA958', borderColor: '#0FA958' },
  filterChipText: { color: '#4D6559', fontWeight: '700', fontSize: 13 },
  filterChipTextActive: { color: '#FFFFFF' },
  filterSummary: { color: '#718178', fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 14 },
  quoteHeader: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quoteSectionTitle: { fontSize: 17, fontWeight: '800', color: '#22362C' },
  quoteCount: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: '#0FA958', color: '#FFFFFF', textAlign: 'center', paddingTop: 3, fontWeight: '800', overflow: 'hidden' },
  noQuotes: { marginTop: 10, color: '#7A8B82' },
  quoteCard: { marginTop: 10, backgroundColor: '#F7FAF8', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E1E9E4' },
  selectedQuoteCard: { borderColor: '#7AC79A', backgroundColor: '#F1FBF5' },
  workerName: { fontSize: 16, fontWeight: '800', color: '#22362C' },
  quotePrice: { fontSize: 18, fontWeight: '900', color: '#0B7A45' },
  quoteAttempt: { marginTop: 6, color: '#0B7A45', fontSize: 12, fontWeight: '800' },
  quoteMessage: { marginTop: 8, marginBottom: 6, color: '#455A50', lineHeight: 20 },
  quoteActionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  acceptQuoteButtonInline: { flex: 1.35, backgroundColor: '#0FA958', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  declineQuoteButton: { flex: 0.8, backgroundColor: '#FFF3F3', borderWidth: 1, borderColor: '#E8B8B8', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  declineQuoteText: { color: '#B33A3A', fontWeight: '800' },
  acceptQuoteText: { color: '#FFFFFF', fontWeight: '800' },
  selectedLabel: { marginTop: 10, color: '#0B7A45', fontWeight: '800' },
  notSelectedLabel: { marginTop: 10, color: '#89968F', fontWeight: '700' },
  historyList: { marginTop: 14, backgroundColor: '#F6F7F6', borderRadius: 12, borderWidth: 1, borderColor: '#E2E6E3', paddingHorizontal: 12, paddingVertical: 10 },
  historyListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyListTitle: { color: '#56665E', fontWeight: '900', fontSize: 13 },
  historyHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyListCount: { color: '#7D8983', fontWeight: '800', fontSize: 12 },
  historyChevron: { color: '#7D8983', fontWeight: '900', fontSize: 11 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E8ECE9' },
  historyMain: { flex: 1, paddingRight: 12 },
  historyName: { color: '#42534A', fontWeight: '800', fontSize: 13 },
  historyMeta: { color: '#8A958F', fontSize: 11, marginTop: 2 },
  historyPrice: { color: '#637168', fontWeight: '900', fontSize: 13 },
  historyFootnote: { color: '#929C97', fontSize: 10, marginTop: 3 },
  matchedCard: { marginTop: 14, backgroundColor: '#EAF8F0', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#B9DFC8' },
  matchedTitle: { color: '#0B7A45', fontWeight: '900', marginBottom: 8 },
  matchedWorker: { fontSize: 17, fontWeight: '900', color: '#22362C' },
  matchedPrice: { fontSize: 18, fontWeight: '900', color: '#0B7A45' },
  workerMatchedCard: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#F1F5F3' },
  attemptInfo: { marginTop: 12, color: '#52675C', fontWeight: '800', fontSize: 13 },
  currentQuoteInfo: { marginTop: 7, color: '#0B7A45', fontWeight: '900', fontSize: 14 },
  ownJobCard: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#F3F5F4', borderWidth: 1, borderColor: '#DDE3DF' },
  ownJobTitle: { color: '#526158', fontWeight: '900' },
  limitCard: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#F3F5F4', alignItems: 'center' },
  limitText: { color: '#7A8680', fontWeight: '900' },
  cancelMatchButton: { marginTop: 10, borderWidth: 1, borderColor: '#E7A6A6', backgroundColor: '#FFF5F5', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelMatchText: { color: '#B33A3A', fontWeight: '800', fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', padding: 20, paddingBottom: 34, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#17251E' },
  modalJob: { marginTop: 6, marginBottom: 8, color: '#667A70' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
