import { useState } from 'react';
import {
  Alert,
  Image,
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
import { categories, jobs as demoJobs } from '../src/data/mockData';

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
  status: '等待報價';
  createdAt: string;
};

type JobFormData = Omit<JobPost, 'id' | 'status' | 'createdAt'>;

export default function HomeScreen() {
  const [mode, setMode] = useState<AppMode>('customer');
  const [customerScreen, setCustomerScreen] = useState<CustomerScreen>('home');
  const [myJobs, setMyJobs] = useState<JobPost[]>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  const editingJob = myJobs.find((job) => job.id === editingJobId) ?? null;

  function switchMode(nextMode: AppMode) {
    setMode(nextMode);
    setCustomerScreen('home');
  }

  function addJob(data: JobFormData) {
    const newJob: JobPost = {
      ...data,
      id: `job-${Date.now()}`,
      status: '等待報價',
      createdAt: '剛剛',
    };

    setMyJobs((current) => [newJob, ...current]);
    setCustomerScreen('myJobs');
  }

  function startEditing(jobId: string) {
    setEditingJobId(jobId);
    setCustomerScreen('edit');
  }

  function updateJob(data: JobFormData) {
    if (!editingJobId) return;

    setMyJobs((current) =>
      current.map((job) =>
        job.id === editingJobId
          ? { ...job, ...data }
          : job
      )
    );

    setEditingJobId(null);
    setCustomerScreen('myJobs');
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
          <ModeButton
            label="客戶"
            active={mode === 'customer'}
            onPress={() => switchMode('customer')}
          />
          <ModeButton
            label="師傅"
            active={mode === 'worker'}
            onPress={() => switchMode('worker')}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {mode === 'customer' && customerScreen === 'home' && (
          <CustomerHome
            myJobCount={myJobs.length}
            onPostJob={() => setCustomerScreen('post')}
            onMyJobs={() => setCustomerScreen('myJobs')}
          />
        )}

        {mode === 'customer' && customerScreen === 'post' && (
          <JobFormScreen
            heading="發佈需求"
            submitLabel="發佈需求"
            onBack={() => setCustomerScreen('home')}
            onSubmit={addJob}
          />
        )}

        {mode === 'customer' && customerScreen === 'edit' && editingJob && (
          <JobFormScreen
            heading="編輯需求"
            submitLabel="儲存更改"
            initialJob={editingJob}
            onBack={() => {
              setEditingJobId(null);
              setCustomerScreen('myJobs');
            }}
            onSubmit={updateJob}
          />
        )}

        {mode === 'customer' && customerScreen === 'myJobs' && (
          <MyJobsScreen
            jobs={myJobs}
            onBack={() => setCustomerScreen('home')}
            onPostAnother={() => setCustomerScreen('post')}
            onEdit={startEditing}
          />
        )}

        {mode === 'worker' && <WorkerHome customerJobs={myJobs} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeButton, active && styles.modeButtonActive]}
    >
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function CustomerHome({
  myJobCount,
  onPostJob,
  onMyJobs,
}: {
  myJobCount: number;
  onPostJob: () => void;
  onMyJobs: () => void;
}) {
  return (
    <>
      <Text style={styles.location}>📍 香港</Text>
      <Text style={styles.heroTitle}>屋企有嘢要整？</Text>
      <Text style={styles.heroSubtitle}>出個需求，等附近師傅直接向你報價。</Text>

      <Pressable style={styles.primaryButton} onPress={onPostJob}>
        <Text style={styles.primaryButtonText}>＋ 發佈需求</Text>
      </Pressable>

      <Pressable style={styles.myJobsButton} onPress={onMyJobs}>
        <Text style={styles.myJobsButtonText}>我的需求</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{myJobCount}</Text>
        </View>
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

function JobFormScreen({
  heading,
  submitLabel,
  initialJob,
  onBack,
  onSubmit,
}: {
  heading: string;
  submitLabel: string;
  initialJob?: JobPost;
  onBack: () => void;
  onSubmit: (data: JobFormData) => void;
}) {
  const [title, setTitle] = useState(initialJob?.title ?? '');
  const [details, setDetails] = useState(initialJob?.details ?? '');
  const [budget, setBudget] = useState(initialJob?.budget ?? '');
  const [district, setDistrict] = useState(initialJob?.district ?? '香港');
  const [photoUri, setPhotoUri] = useState<string | null>(initialJob?.photoUri ?? null);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('需要相簿權限', '請允許 WorkerApp 存取相片。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function submit() {
    if (!title.trim()) {
      Alert.alert('請輸入需要', '例如：廚房水喉漏水');
      return;
    }

    onSubmit({
      title: title.trim(),
      details: details.trim(),
      budget: budget.trim(),
      district: district.trim() || '香港',
      category: initialJob?.category ?? '一般維修',
      photoUri,
    });
  }

  return (
    <>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>‹ 返回</Text>
      </Pressable>

      <Text style={styles.pageTitle}>{heading}</Text>

      <Text style={styles.label}>你需要咩幫手？</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="例如：廚房水喉漏水"
        style={styles.input}
      />

      <Text style={styles.label}>詳細描述</Text>
      <TextInput
        value={details}
        onChangeText={setDetails}
        placeholder="講多少少情況，例如幾時開始漏水…"
        multiline
        style={[styles.input, styles.textArea]}
      />

      <Text style={styles.label}>地區</Text>
      <TextInput
        value={district}
        onChangeText={setDistrict}
        placeholder="例如：沙田"
        style={styles.input}
      />

      <Text style={styles.label}>相片</Text>
      {photoUri ? (
        <View style={styles.photoPreviewCard}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          <View style={styles.photoActions}>
            <Pressable style={styles.secondaryButton} onPress={pickPhoto}>
              <Text style={styles.secondaryText}>更換相片</Text>
            </Pressable>
            <Pressable style={styles.removeButton} onPress={() => setPhotoUri(null)}>
              <Text style={styles.removeText}>移除</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.photoBox} onPress={pickPhoto}>
          <Text style={styles.photoPlus}>＋</Text>
          <Text style={styles.photoText}>從相簿選擇相片</Text>
        </Pressable>
      )}

      <Text style={styles.label}>你心目中嘅價錢（可選）</Text>
      <TextInput
        value={budget}
        onChangeText={setBudget}
        placeholder="例如 600"
        keyboardType="numeric"
        style={styles.input}
      />
      <Text style={styles.currencyHint}>HKD</Text>

      <Pressable style={styles.primaryButton} onPress={submit}>
        <Text style={styles.primaryButtonText}>{submitLabel}</Text>
      </Pressable>
    </>
  );
}

function MyJobsScreen({
  jobs,
  onBack,
  onPostAnother,
  onEdit,
}: {
  jobs: JobPost[];
  onBack: () => void;
  onPostAnother: () => void;
  onEdit: (jobId: string) => void;
}) {
  return (
    <>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>‹ 主頁</Text>
      </Pressable>

      <View style={styles.rowBetween}>
        <Text style={styles.pageTitle}>我的需求</Text>
        <Pressable onPress={onPostAnother}>
          <Text style={styles.addAnother}>＋ 新需求</Text>
        </Pressable>
      </View>

      {jobs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>暫時未有需求</Text>
          <Text style={styles.emptyText}>發佈第一個工作後，就會喺呢度見到。</Text>
        </View>
      ) : (
        jobs.map((job) => (
          <CustomerJobCard key={job.id} job={job} onEdit={() => onEdit(job.id)} />
        ))
      )}
    </>
  );
}

function CustomerJobCard({ job, onEdit }: { job: JobPost; onEdit: () => void }) {
  return (
    <View style={styles.jobCard}>
      {job.photoUri && <Image source={{ uri: job.photoUri }} style={styles.jobPhoto} />}

      <View style={styles.rowBetween}>
        <Text style={styles.statusPill}>{job.status}</Text>
        <Text style={styles.time}>{job.createdAt}</Text>
      </View>

      <Text style={styles.jobTitle}>{job.title}</Text>
      <Text style={styles.jobMeta}>📍 {job.district}</Text>
      {job.details ? <Text style={styles.jobDetails}>{job.details}</Text> : null}

      <Text style={styles.jobBudget}>
        {job.budget ? `你嘅預算：HK$${job.budget}` : '未設定預算 · 等師傅報價'}
      </Text>

      <Pressable style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editButtonText}>✏️ 編輯需求</Text>
      </Pressable>
    </View>
  );
}

function WorkerHome({ customerJobs }: { customerJobs: JobPost[] }) {
  return (
    <>
      <View style={styles.workerHero}>
        <Text style={styles.online}>● 在線接單</Text>
        <Text style={styles.heroTitle}>附近新工作</Text>
        <Text style={styles.heroSubtitle}>客戶更新需求後，呢度會即時顯示最新內容。</Text>
      </View>

      {customerJobs.map((job) => (
        <View key={job.id} style={styles.jobCard}>
          {job.photoUri && <Image source={{ uri: job.photoUri }} style={styles.jobPhoto} />}

          <View style={styles.rowBetween}>
            <Text style={styles.newPill}>新工作</Text>
            <Text style={styles.time}>{job.createdAt}</Text>
          </View>

          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobMeta}>📍 {job.district}</Text>
          {job.details ? <Text style={styles.jobDetails}>{job.details}</Text> : null}
          <Text style={styles.jobBudget}>
            {job.budget ? `客人預算 HK$${job.budget}` : '客人等你報價'}
          </Text>

          <Pressable
            style={styles.primaryButtonSmall}
            onPress={() => Alert.alert('下一步：報價功能', `你正在查看：${job.title}`)}
          >
            <Text style={styles.primaryButtonText}>立即報價</Text>
          </Pressable>
        </View>
      ))}

      {demoJobs.map((job) => (
        <View key={job.id} style={styles.jobCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.categoryPill}>{job.category}</Text>
            <Text style={styles.time}>{job.time}</Text>
          </View>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobMeta}>📍 {job.district}</Text>
          <Text style={styles.jobBudget}>{job.budget}</Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEE9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { fontSize: 24, fontWeight: '800', color: '#0B7A45' },
  tagline: { fontSize: 12, color: '#688076', marginTop: 2 },
  modeSwitch: { flexDirection: 'row', backgroundColor: '#EEF4F0', padding: 3, borderRadius: 12 },
  modeButton: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9 },
  modeButtonActive: { backgroundColor: '#0FA958' },
  modeText: { color: '#587066', fontWeight: '700' },
  modeTextActive: { color: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 50 },
  location: { color: '#60776D', fontWeight: '600', marginBottom: 16 },
  heroTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#17251E' },
  heroSubtitle: { fontSize: 16, lineHeight: 23, color: '#617168', marginTop: 8, marginBottom: 18 },
  primaryButton: { backgroundColor: '#0FA958', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginVertical: 10 },
  primaryButtonSmall: { backgroundColor: '#0FA958', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
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
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#22362C' },
  emptyText: { color: '#718179', marginTop: 8, textAlign: 'center' },
  jobCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E4EBE7' },
  jobPhoto: { width: '100%', height: 185, borderRadius: 12, marginBottom: 14 },
  statusPill: { backgroundColor: '#FFF7D6', color: '#806A00', fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, overflow: 'hidden' },
  newPill: { backgroundColor: '#EAF8F0', color: '#0B7A45', fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, overflow: 'hidden' },
  categoryPill: { backgroundColor: '#EAF8F0', color: '#0B7A45', fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, overflow: 'hidden' },
  time: { color: '#87968E', fontSize: 12 },
  jobTitle: { fontSize: 19, fontWeight: '800', color: '#1C3026', marginTop: 12 },
  jobMeta: { marginTop: 7, color: '#667A70' },
  jobDetails: { marginTop: 10, color: '#455A50', lineHeight: 21 },
  jobBudget: { marginTop: 12, fontSize: 17, fontWeight: '900', color: '#17251E' },
  editButton: { marginTop: 14, borderWidth: 1, borderColor: '#B9D8C6', backgroundColor: '#F3FBF6', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  editButtonText: { color: '#0B7A45', fontWeight: '800', fontSize: 15 },
  workerHero: { padding: 18, borderRadius: 18, backgroundColor: '#EAF8F0', marginBottom: 18 },
  online: { color: '#0B8D4A', fontWeight: '800', marginBottom: 10 },
});
