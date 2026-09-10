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

type AppMode = 'customer' | 'worker';
type CustomerScreen = 'home' | 'post' | 'myJobs' | 'edit';

type JobPost = {
  id: string;
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
  workerName: string;
  price: string;
  message: string;
  createdAt: string;
};

type JobFormData = Omit<JobPost, 'id' | 'status' | 'createdAt' | 'acceptedQuoteId' | 'acceptedWorkerName' | 'acceptedPrice'>;

type DatabaseJob = {
  id: string;
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
  worker_name: string;
  price: string;
  message: string;
  created_at: string;
};

function fromDatabaseJob(job: DatabaseJob): JobPost {
  return {
    id: job.id,
    title: job.title,
    details: job.details ?? '',
    budget: job.budget ?? '',
    district: job.district ?? '香港',
    category: job.category ?? '一般維修',
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
    workerName: quote.worker_name,
    price: quote.price,
    message: quote.message ?? '',
    createdAt: new Date(quote.created_at).toLocaleString('zh-HK'),
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

  const { data, error } = await supabase.storage
    .from(JOB_PHOTOS_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from(JOB_PHOTOS_BUCKET)
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

async function resolvePhotoUrl(uri: string | null) {
  if (!uri) return null;
  if (isRemotePhoto(uri)) return uri;
  return uploadJobPhoto(uri);
}

export default function HomeScreen() {
  const [mode, setMode] = useState<AppMode>('customer');
  const [customerScreen, setCustomerScreen] = useState<CustomerScreen>('home');
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteJob, setQuoteJob] = useState<JobPost | null>(null);

  const editingJob = jobs.find((job) => job.id === editingJobId) ?? null;

  useEffect(() => {
    Promise.all([loadJobs(), loadQuotes()]).finally(() => setLoading(false));

    const jobsChannel = supabase
      .channel('workerapp-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, loadJobs)
      .subscribe();

    const quotesChannel = supabase
      .channel('workerapp-quotes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, loadQuotes)
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(quotesChannel);
    };
  }, []);

  async function loadJobs() {
    const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (!error) setJobs((data as DatabaseJob[]).map(fromDatabaseJob));
  }

  async function loadQuotes() {
    const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
    if (!error) setQuotes((data as DatabaseQuote[]).map(fromDatabaseQuote));
  }

  function switchMode(nextMode: AppMode) {
    setMode(nextMode);
    setCustomerScreen('home');
  }

  async function addJob(data: JobFormData) {
    let photoUrl: string | null = null;
    try {
      photoUrl = await resolvePhotoUrl(data.photoUri);
    } catch (error: any) {
      Alert.alert('相片上載失敗', error?.message ?? '請再試一次。');
      return;
    }

    const { error } = await supabase.from('jobs').insert({
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

    await loadJobs();
    setCustomerScreen('myJobs');
  }

  async function updateJob(data: JobFormData) {
    if (!editingJobId) return;

    let photoUrl: string | null = null;
    try {
      photoUrl = await resolvePhotoUrl(data.photoUri);
    } catch (error: any) {
      Alert.alert('相片上載失敗', error?.message ?? '請再試一次。');
      return;
    }

    const { error } = await supabase
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
      .eq('id', editingJobId);

    if (error) {
      Alert.alert('更新失敗', error.message);
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
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) {
      Alert.alert('刪除失敗', error.message);
      return;
    }
    if (editingJobId === jobId) setEditingJobId(null);
    await Promise.all([loadJobs(), loadQuotes()]);
    Alert.alert('已刪除', '呢個需求已經移除，師傅亦唔會再見到。');
  }

  async function submitQuote(jobId: string, workerName: string, price: string, message: string) {
    if (!price.trim()) {
      Alert.alert('請輸入報價');
      return false;
    }

    const job = jobs.find((item) => item.id === jobId);
    if (job?.acceptedQuoteId) {
      Alert.alert('工作已配對', '客戶已經接受另一個報價。');
      return false;
    }

    const { error } = await supabase.from('quotes').insert({
      job_id: jobId,
      worker_name: workerName.trim() || '師傅',
      price: price.trim(),
      message: message.trim(),
    });

    if (error) {
      Alert.alert('報價失敗', error.message);
      return false;
    }

    await loadQuotes();
    return true;
  }

  function confirmAcceptQuote(job: JobPost, quote: Quote) {
    Alert.alert(
      '接受呢個報價？',
      `${quote.workerName}：HK$${quote.price}\n\n接受後，工作會標記為「已配對」。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '接受報價', onPress: () => acceptQuote(job, quote) },
      ]
    );
  }

  async function acceptQuote(job: JobPost, quote: Quote) {
    if (job.acceptedQuoteId) {
      Alert.alert('已經配對', '呢個需求已經接受咗一個報價。');
      return;
    }

    const { data, error } = await supabase
      .from('jobs')
      .update({
        accepted_quote_id: quote.id,
        accepted_worker_name: quote.workerName,
        accepted_price: quote.price,
        status: '已配對',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .is('accepted_quote_id', null)
      .select('id');

    if (error) {
      Alert.alert('接受失敗', error.message);
      return;
    }

    if (!data || data.length === 0) {
      Alert.alert('已經配對', '呢個需求可能已經接受咗另一個報價。');
      await loadJobs();
      return;
    }

    await loadJobs();
    Alert.alert('配對成功', `你已選擇 ${quote.workerName}，報價 HK$${quote.price}。`);
  }

  function confirmCancelMatch(job: JobPost) {
    if (!job.acceptedQuoteId) return;

    Alert.alert(
      '取消已配對工作？',
      `你確定要取消「${job.title}」嘅配對嗎？\n\n確認後，客戶會重新見到工作為「等待報價」，其他師傅亦可以再次報價。`,
      [
        { text: '保留配對', style: 'cancel' },
        {
          text: '確認取消',
          style: 'destructive',
          onPress: () => cancelMatch(job),
        },
      ]
    );
  }

  async function cancelMatch(job: JobPost) {
    if (!job.acceptedQuoteId) {
      Alert.alert('已取消', '呢個工作目前已經唔係配對狀態。');
      await loadJobs();
      return;
    }

    const { data, error } = await supabase
      .from('jobs')
      .update({
        accepted_quote_id: null,
        accepted_worker_name: null,
        accepted_price: null,
        status: '等待報價',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('accepted_quote_id', job.acceptedQuoteId)
      .select('id');

    if (error) {
      Alert.alert('取消失敗', error.message);
      return;
    }

    if (!data || data.length === 0) {
      Alert.alert('狀態已更新', '呢個工作嘅配對狀態可能已經被更改。');
      await loadJobs();
      return;
    }

    await loadJobs();
    Alert.alert('已取消配對', '工作已重新變成「等待報價」。客戶畫面亦會即時更新。');
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

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>連接 WorkerApp...</Text>
          </View>
        ) : (
          <>
            {mode === 'customer' && customerScreen === 'home' && (
              <CustomerHome myJobCount={jobs.length} onPostJob={() => setCustomerScreen('post')} onMyJobs={() => setCustomerScreen('myJobs')} />
            )}
            {mode === 'customer' && customerScreen === 'post' && (
              <JobFormScreen heading="發佈需求" submitLabel="發佈需求" onBack={() => setCustomerScreen('home')} onSubmit={addJob} />
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
                jobs={jobs}
                quotes={quotes}
                onBack={() => setCustomerScreen('home')}
                onPostAnother={() => setCustomerScreen('post')}
                onEdit={(jobId) => { setEditingJobId(jobId); setCustomerScreen('edit'); }}
                onDelete={confirmDeleteJob}
                onAcceptQuote={confirmAcceptQuote}
              />
            )}
            {mode === 'worker' && <WorkerHome jobs={jobs} onQuote={setQuoteJob} onCancelMatch={confirmCancelMatch} />}
          </>
        )}
      </ScrollView>

      <QuoteModal job={quoteJob} visible={!!quoteJob} onClose={() => setQuoteJob(null)} onSubmit={submitQuote} />
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

function CustomerHome({ myJobCount, onPostJob, onMyJobs }: { myJobCount: number; onPostJob: () => void; onMyJobs: () => void }) {
  return (
    <>
      <Text style={styles.location}>📍 香港</Text>
      <Text style={styles.heroTitle}>屋企有嘢要整？</Text>
      <Text style={styles.heroSubtitle}>出個需求，等附近師傅直接向你報價。</Text>
      <Pressable style={styles.primaryButton} onPress={onPostJob}><Text style={styles.primaryButtonText}>＋ 發佈需求</Text></Pressable>
      <Pressable style={styles.myJobsButton} onPress={onMyJobs}>
        <Text style={styles.myJobsButtonText}>我的需求</Text>
        <View style={styles.countBadge}><Text style={styles.countBadgeText}>{myJobCount}</Text></View>
      </Pressable>
      <Text style={styles.sectionTitle}>服務類別</Text>
      <View style={styles.categoryGrid}>
        {categories.map((category) => (
          <Pressable key={category.label} style={styles.categoryCard} onPress={onPostJob}>
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <Text style={styles.categoryLabel}>{category.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function JobFormScreen({ heading, submitLabel, initialJob, onBack, onSubmit }: { heading: string; submitLabel: string; initialJob?: JobPost; onBack: () => void; onSubmit: (data: JobFormData) => Promise<void> }) {
  const [title, setTitle] = useState(initialJob?.title ?? '');
  const [details, setDetails] = useState(initialJob?.details ?? '');
  const [budget, setBudget] = useState(initialJob?.budget ?? '');
  const [district, setDistrict] = useState(initialJob?.district ?? '香港');
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
    if (!title.trim()) {
      Alert.alert('請輸入需要', '例如：廚房水喉漏水');
      return;
    }
    setSubmitting(true);
    await onSubmit({ title: title.trim(), details: details.trim(), budget: budget.trim(), district: district.trim() || '香港', category: initialJob?.category ?? '一般維修', photoUri });
    setSubmitting(false);
  }

  return (
    <>
      <Pressable onPress={onBack}><Text style={styles.back}>‹ 返回</Text></Pressable>
      <Text style={styles.pageTitle}>{heading}</Text>
      <Text style={styles.label}>你需要咩幫手？</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="例如：廚房水喉漏水" style={styles.input} />
      <Text style={styles.label}>詳細描述</Text>
      <TextInput value={details} onChangeText={setDetails} placeholder="講多少少情況…" multiline style={[styles.input, styles.textArea]} />
      <Text style={styles.label}>地區</Text>
      <TextInput value={district} onChangeText={setDistrict} placeholder="例如：沙田" style={styles.input} />
      <Text style={styles.label}>相片</Text>
      {photoUri ? (
        <View style={styles.photoPreviewCard}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          <View style={styles.photoActions}>
            <Pressable style={styles.secondaryButton} onPress={pickPhoto}><Text style={styles.secondaryText}>更換相片</Text></Pressable>
            <Pressable style={styles.removeButton} onPress={() => setPhotoUri(null)}><Text style={styles.removeText}>移除</Text></Pressable>
          </View>
          <Text style={styles.photoNote}>發佈時會上載到 WorkerApp，師傅亦可以睇到呢張相。</Text>
        </View>
      ) : (
        <Pressable style={styles.photoBox} onPress={pickPhoto}><Text style={styles.photoPlus}>＋</Text><Text style={styles.photoText}>從相簿選擇相片</Text></Pressable>
      )}
      <Text style={styles.label}>你心目中嘅價錢（可選）</Text>
      <TextInput value={budget} onChangeText={setBudget} placeholder="例如 600" keyboardType="numeric" style={styles.input} />
      <Text style={styles.currencyHint}>HKD</Text>
      <Pressable style={[styles.primaryButton, submitting && styles.disabledButton]} onPress={submit} disabled={submitting}>
        <Text style={styles.primaryButtonText}>{submitting ? '上載及處理中...' : submitLabel}</Text>
      </Pressable>
    </>
  );
}

function MyJobsScreen({ jobs, quotes, onBack, onPostAnother, onEdit, onDelete, onAcceptQuote }: { jobs: JobPost[]; quotes: Quote[]; onBack: () => void; onPostAnother: () => void; onEdit: (jobId: string) => void; onDelete: (job: JobPost) => void; onAcceptQuote: (job: JobPost, quote: Quote) => void }) {
  return (
    <>
      <Pressable onPress={onBack}><Text style={styles.back}>‹ 主頁</Text></Pressable>
      <View style={styles.rowBetween}>
        <Text style={styles.pageTitle}>我的需求</Text>
        <Pressable onPress={onPostAnother}><Text style={styles.addAnother}>＋ 新需求</Text></Pressable>
      </View>
      {jobs.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyTitle}>暫時未有需求</Text></View>
      ) : jobs.map((job) => (
        <CustomerJobCard
          key={job.id}
          job={job}
          quotes={quotes.filter((quote) => quote.jobId === job.id)}
          onEdit={() => onEdit(job.id)}
          onDelete={() => onDelete(job)}
          onAcceptQuote={(quote) => onAcceptQuote(job, quote)}
        />
      ))}
    </>
  );
}

function CustomerJobCard({ job, quotes, onEdit, onDelete, onAcceptQuote }: { job: JobPost; quotes: Quote[]; onEdit: () => void; onDelete: () => void; onAcceptQuote: (quote: Quote) => void }) {
  const matched = !!job.acceptedQuoteId;

  return (
    <View style={styles.jobCard}>
      {job.photoUri && <Image source={{ uri: job.photoUri }} style={styles.jobPhoto} />}
      <View style={styles.rowBetween}>
        <Text style={[styles.statusPill, matched && styles.matchedPill]}>{job.status}</Text>
        <Text style={styles.time}>{job.createdAt}</Text>
      </View>
      <Text style={styles.jobTitle}>{job.title}</Text>
      <Text style={styles.jobMeta}>📍 {job.district}</Text>
      {job.details ? <Text style={styles.jobDetails}>{job.details}</Text> : null}
      <Text style={styles.jobBudget}>{job.budget ? `你嘅預算：HK$${job.budget}` : '等師傅報價'}</Text>

      {matched && (
        <View style={styles.matchedCard}>
          <Text style={styles.matchedTitle}>✓ 已配對師傅</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.matchedWorker}>{job.acceptedWorkerName}</Text>
            <Text style={styles.matchedPrice}>HK${job.acceptedPrice}</Text>
          </View>
        </View>
      )}

      <View style={styles.quoteHeader}>
        <Text style={styles.quoteSectionTitle}>收到嘅報價</Text>
        <Text style={styles.quoteCount}>{quotes.length}</Text>
      </View>
      {quotes.length === 0 ? (
        <Text style={styles.noQuotes}>暫時未有師傅報價。</Text>
      ) : quotes.map((quote) => {
        const selected = quote.id === job.acceptedQuoteId;
        return (
          <View key={quote.id} style={[styles.quoteCard, selected && styles.selectedQuoteCard]}>
            <View style={styles.rowBetween}>
              <Text style={styles.workerName}>{quote.workerName}</Text>
              <Text style={styles.quotePrice}>HK${quote.price}</Text>
            </View>
            {quote.message ? <Text style={styles.quoteMessage}>{quote.message}</Text> : null}
            <Text style={styles.time}>{quote.createdAt}</Text>
            {selected ? (
              <Text style={styles.selectedLabel}>✓ 已接受呢個報價</Text>
            ) : !matched ? (
              <Pressable style={styles.acceptQuoteButton} onPress={() => onAcceptQuote(quote)}>
                <Text style={styles.acceptQuoteText}>接受報價</Text>
              </Pressable>
            ) : (
              <Text style={styles.notSelectedLabel}>未獲選</Text>
            )}
          </View>
        );
      })}

      <View style={styles.jobActions}>
        <Pressable style={styles.editButton} onPress={onEdit}><Text style={styles.editButtonText}>✏️ 編輯</Text></Pressable>
        <Pressable style={styles.deleteButton} onPress={onDelete}><Text style={styles.deleteButtonText}>刪除需求</Text></Pressable>
      </View>
    </View>
  );
}

function WorkerHome({ jobs, onQuote, onCancelMatch }: { jobs: JobPost[]; onQuote: (job: JobPost) => void; onCancelMatch: (job: JobPost) => void }) {
  return (
    <>
      <View style={styles.workerHero}>
        <Text style={styles.online}>● Realtime 已連線</Text>
        <Text style={styles.heroTitle}>附近新工作</Text>
        <Text style={styles.heroSubtitle}>客戶接受報價後會顯示「已配對」；如師傅不能接單，可以先確認再取消配對。</Text>
      </View>
      {jobs.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyTitle}>暫時未有新工作</Text></View>
      ) : jobs.map((job) => {
        const matched = !!job.acceptedQuoteId;
        return (
          <View key={job.id} style={styles.jobCard}>
            {job.photoUri && <Image source={{ uri: job.photoUri }} style={styles.jobPhoto} />}
            <View style={styles.rowBetween}>
              <Text style={[styles.newPill, matched && styles.matchedPill]}>{matched ? '已配對' : '新工作'}</Text>
              <Text style={styles.time}>{job.createdAt}</Text>
            </View>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={styles.jobMeta}>📍 {job.district}</Text>
            {job.details ? <Text style={styles.jobDetails}>{job.details}</Text> : null}
            <Text style={styles.jobBudget}>{job.budget ? `客人預算：HK$${job.budget}` : '客人等你報價'}</Text>
            {matched ? (
              <>
                <View style={styles.workerMatchedCard}>
                  <Text style={styles.matchedTitle}>呢個工作已經配對</Text>
                  <Text style={styles.jobDetails}>已接受：{job.acceptedWorkerName} · HK${job.acceptedPrice}</Text>
                </View>
                <Pressable style={styles.cancelMatchButton} onPress={() => onCancelMatch(job)}>
                  <Text style={styles.cancelMatchText}>取消已配對</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.primaryButtonSmall} onPress={() => onQuote(job)}><Text style={styles.primaryButtonText}>立即報價</Text></Pressable>
            )}
          </View>
        );
      })}
    </>
  );
}

function QuoteModal({ job, visible, onClose, onSubmit }: { job: JobPost | null; visible: boolean; onClose: () => void; onSubmit: (jobId: string, workerName: string, price: string, message: string) => Promise<boolean> }) {
  const [workerName, setWorkerName] = useState('陳師傅');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) { setPrice(''); setMessage(''); }
  }, [visible, job?.id]);

  async function submit() {
    if (!job) return;
    setSubmitting(true);
    const ok = await onSubmit(job.id, workerName, price, message);
    setSubmitting(false);
    if (ok) {
      Alert.alert('報價已送出', '客戶會即時喺「我的需求」收到。');
      onClose();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>提交報價</Text>
          <Text style={styles.modalJob}>{job?.title}</Text>
          <Text style={styles.label}>師傅名稱</Text>
          <TextInput value={workerName} onChangeText={setWorkerName} style={styles.input} />
          <Text style={styles.label}>報價（HKD）</Text>
          <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="例如 600" style={styles.input} />
          <Text style={styles.label}>留言（可選）</Text>
          <TextInput value={message} onChangeText={setMessage} placeholder="例如：今日下午可以上門，包基本材料。" multiline style={[styles.input, styles.textAreaSmall]} />
          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}><Text style={styles.secondaryText}>取消</Text></Pressable>
            <Pressable style={[styles.acceptButton, submitting && styles.disabledButton]} onPress={submit} disabled={submitting}>
              <Text style={styles.primaryButtonText}>{submitting ? '送出中...' : '送出報價'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
  content: { padding: 20, paddingBottom: 50 },
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
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  categoryCard: { width: '22.5%', backgroundColor: '#FFFFFF', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E6ECE8' },
  categoryIcon: { fontSize: 24, marginBottom: 6 },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: '#314139' },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#17251E', marginBottom: 22 },
  label: { fontSize: 15, fontWeight: '700', color: '#32443B', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  textAreaSmall: { minHeight: 80, textAlignVertical: 'top' },
  photoBox: { height: 105, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9DB5A8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  photoPlus: { fontSize: 28, color: '#0FA958' },
  photoText: { color: '#597066', marginTop: 4, fontWeight: '600' },
  photoPreviewCard: { backgroundColor: '#FFFFFF', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E1E9E4' },
  photoPreview: { width: '100%', height: 210, borderRadius: 10 },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  photoNote: { marginTop: 8, fontSize: 12, color: '#72847A' },
  secondaryButton: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: '#EDF3EF' },
  secondaryText: { color: '#315243', fontWeight: '800' },
  removeButton: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: '#FFF0F0' },
  removeText: { color: '#B33A3A', fontWeight: '800' },
  currencyHint: { color: '#778980', marginTop: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addAnother: { color: '#0B8D4A', fontWeight: '800', marginBottom: 22 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E4EBE7' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#22362C' },
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
  quoteHeader: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quoteSectionTitle: { fontSize: 17, fontWeight: '800', color: '#22362C' },
  quoteCount: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: '#0FA958', color: '#FFFFFF', textAlign: 'center', paddingTop: 3, fontWeight: '800', overflow: 'hidden' },
  noQuotes: { marginTop: 10, color: '#7A8B82' },
  quoteCard: { marginTop: 10, backgroundColor: '#F7FAF8', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E1E9E4' },
  selectedQuoteCard: { borderColor: '#7AC79A', backgroundColor: '#F1FBF5' },
  workerName: { fontSize: 16, fontWeight: '800', color: '#22362C' },
  quotePrice: { fontSize: 18, fontWeight: '900', color: '#0B7A45' },
  quoteMessage: { marginTop: 8, marginBottom: 6, color: '#455A50', lineHeight: 20 },
  acceptQuoteButton: { marginTop: 10, backgroundColor: '#0FA958', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  acceptQuoteText: { color: '#FFFFFF', fontWeight: '800' },
  selectedLabel: { marginTop: 10, color: '#0B7A45', fontWeight: '800' },
  notSelectedLabel: { marginTop: 10, color: '#89968F', fontWeight: '700' },
  matchedCard: { marginTop: 14, backgroundColor: '#EAF8F0', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#B9DFC8' },
  matchedTitle: { color: '#0B7A45', fontWeight: '900', marginBottom: 8 },
  matchedWorker: { fontSize: 17, fontWeight: '900', color: '#22362C' },
  matchedPrice: { fontSize: 18, fontWeight: '900', color: '#0B7A45' },
  workerMatchedCard: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#F1F5F3' },
  cancelMatchButton: { marginTop: 10, borderWidth: 1, borderColor: '#E7A6A6', backgroundColor: '#FFF5F5', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelMatchText: { color: '#B33A3A', fontWeight: '800', fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', padding: 20, paddingBottom: 34, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#17251E' },
  modalJob: { marginTop: 6, marginBottom: 8, color: '#667A70' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
