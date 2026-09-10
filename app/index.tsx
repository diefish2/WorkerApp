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
import { categories, jobs, quotes } from '../src/data/mockData';

// Main app screen.
// Demo content such as service names, worker names and prices lives in:
// src/data/mockData.ts

export default function HomeScreen() {
  const [mode, setMode] = useState<'customer' | 'worker'>('customer');
  const [screen, setScreen] = useState<'home' | 'post' | 'quotes'>('home');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [budget, setBudget] = useState('');

  function switchMode(nextMode: 'customer' | 'worker') {
    setMode(nextMode);
    setScreen('home');
  }

  function postJob() {
    if (!title.trim()) {
      Alert.alert('請輸入需要', '例如：廚房水喉漏水');
      return;
    }

    // Later this will save the job and its uploaded photo to a real database.
    setScreen('quotes');
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
        {mode === 'customer' && screen === 'home' && (
          <CustomerHome onPostJob={() => setScreen('post')} />
        )}

        {mode === 'customer' && screen === 'post' && (
          <PostJobScreen
            title={title}
            details={details}
            budget={budget}
            onTitleChange={setTitle}
            onDetailsChange={setDetails}
            onBudgetChange={setBudget}
            onBack={() => setScreen('home')}
            onSubmit={postJob}
          />
        )}

        {mode === 'customer' && screen === 'quotes' && (
          <QuotesScreen
            jobTitle={title || '廚房水喉漏水'}
            budget={budget}
            onBack={() => setScreen('home')}
          />
        )}

        {mode === 'worker' && <WorkerHome />}
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

function CustomerHome({ onPostJob }: { onPostJob: () => void }) {
  return (
    <>
      <Text style={styles.location}>📍 香港</Text>
      <Text style={styles.heroTitle}>屋企有嘢要整？</Text>
      <Text style={styles.heroSubtitle}>出個需求，等附近師傅直接向你報價。</Text>

      <Pressable style={styles.primaryButton} onPress={onPostJob}>
        <Text style={styles.primaryButtonText}>＋ 發佈需求</Text>
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

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>點樣運作？</Text>
        <Text style={styles.infoText}>1. 講低問題＋上載相片</Text>
        <Text style={styles.infoText}>2. 可以自訂預算，亦可以等師傅報價</Text>
        <Text style={styles.infoText}>3. 比較價錢、評分同時間，再揀師傅</Text>
      </View>
    </>
  );
}

function PostJobScreen({
  title,
  details,
  budget,
  onTitleChange,
  onDetailsChange,
  onBudgetChange,
  onBack,
  onSubmit,
}: {
  title: string;
  details: string;
  budget: string;
  onTitleChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
  onBudgetChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  // This stores the local file URI selected from the user's photo library.
  // The next step will upload this file to cloud storage (Supabase Storage).
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        '需要相簿權限',
        '請允許 WorkerApp 存取相片，先可以上載維修問題圖片。'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  return (
    <>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>‹ 返回</Text>
      </Pressable>

      <Text style={styles.pageTitle}>發佈需求</Text>

      <Text style={styles.label}>你需要咩幫手？</Text>
      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder="例如：廚房水喉漏水"
        style={styles.input}
      />

      <Text style={styles.label}>詳細描述</Text>
      <TextInput
        value={details}
        onChangeText={onDetailsChange}
        placeholder="講多少少情況，例如幾時開始漏水…"
        multiline
        style={[styles.input, styles.textArea]}
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
          <Text style={styles.photoStatus}>✓ 已選擇相片（目前只存在手機本機）</Text>
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
        onChangeText={onBudgetChange}
        placeholder="例如 600"
        keyboardType="numeric"
        style={styles.input}
      />
      <Text style={styles.currencyHint}>HKD</Text>

      <Pressable style={styles.primaryButton} onPress={onSubmit}>
        <Text style={styles.primaryButtonText}>發佈需求</Text>
      </Pressable>
    </>
  );
}

function QuotesScreen({
  jobTitle,
  budget,
  onBack,
}: {
  jobTitle: string;
  budget: string;
  onBack: () => void;
}) {
  return (
    <>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>‹ 主頁</Text>
      </Pressable>

      <Text style={styles.pageTitle}>收到嘅報價</Text>

      <View style={styles.jobSummary}>
        <Text style={styles.jobTitle}>{jobTitle}</Text>
        <Text style={styles.jobMeta}>
          📍 香港 · {budget ? `你嘅預算 HK$${budget}` : '等待報價'}
        </Text>
      </View>

      {quotes.map((quote) => (
        <View key={quote.id} style={styles.quoteCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.workerName}>{quote.name}</Text>
              <Text style={styles.rating}>
                ⭐ {quote.rating} · {quote.jobsCompleted} 單
              </Text>
            </View>
            <Text style={styles.price}>{quote.price}</Text>
          </View>

          <Text style={styles.quoteNote}>{quote.note}</Text>

          <View style={styles.quoteActions}>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>傾一傾</Text>
            </Pressable>

            <Pressable
              style={styles.acceptButton}
              onPress={() => Alert.alert('已選擇師傅', `${quote.name} · ${quote.price}`)}
            >
              <Text style={styles.primaryButtonText}>揀佢</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </>
  );
}

function WorkerHome() {
  return (
    <>
      <View style={styles.workerHero}>
        <Text style={styles.online}>● 在線接單</Text>
        <Text style={styles.heroTitle}>附近新工作</Text>
        <Text style={styles.heroSubtitle}>睇需求，再由你決定報幾多錢。</Text>
      </View>

      {jobs.map((job) => (
        <View key={job.id} style={styles.jobCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.categoryPill}>{job.category}</Text>
            <Text style={styles.time}>{job.time}</Text>
          </View>

          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobMeta}>📍 {job.district}</Text>
          <Text style={styles.jobBudget}>{job.budget}</Text>

          <Pressable
            style={styles.primaryButtonSmall}
            onPress={() =>
              Alert.alert('提交報價', `${job.title}\n你可以輸入價錢及可上門時間。`)
            }
          >
            <Text style={styles.primaryButtonText}>立即報價</Text>
          </Pressable>
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
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#EEF4F0',
    padding: 3,
    borderRadius: 12,
  },
  modeButton: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9 },
  modeButtonActive: { backgroundColor: '#0FA958' },
  modeText: { color: '#587066', fontWeight: '700' },
  modeTextActive: { color: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 40 },
  location: { color: '#60776D', fontWeight: '600', marginBottom: 16 },
  heroTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#17251E' },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: '#617168',
    marginTop: 8,
    marginBottom: 18,
  },
  primaryButton: {
    backgroundColor: '#0FA958',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginVertical: 10,
  },
  primaryButtonSmall: {
    backgroundColor: '#0FA958',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 14,
    fontSize: 20,
    fontWeight: '800',
    color: '#17251E',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryCard: {
    width: '22.5%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6ECE8',
  },
  categoryIcon: { fontSize: 24, marginBottom: 6 },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: '#314139' },
  infoCard: { marginTop: 24, padding: 18, backgroundColor: '#EAF8F0', borderRadius: 16 },
  infoTitle: { fontSize: 18, fontWeight: '800', color: '#145F3D', marginBottom: 10 },
  infoText: { fontSize: 14, lineHeight: 24, color: '#3B5C4C' },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#17251E', marginBottom: 22 },
  label: { fontSize: 15, fontWeight: '700', color: '#32443B', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5DF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  photoBox: {
    height: 120,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#9DB5A8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlus: { fontSize: 28, color: '#0FA958' },
  photoText: { color: '#597066', marginTop: 4, fontWeight: '600' },
  photoPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#DCE5DF',
  },
  photoPreview: { width: '100%', height: 220, borderRadius: 10 },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  photoStatus: { marginTop: 10, color: '#0B7A45', fontSize: 13, fontWeight: '600' },
  removeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FDECEC',
  },
  removeText: { color: '#B42318', fontWeight: '800' },
  currencyHint: { color: '#778980', marginTop: 6, marginBottom: 4 },
  jobSummary: { backgroundColor: '#EAF8F0', padding: 16, borderRadius: 14, marginBottom: 16 },
  quoteCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E4EBE7',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workerName: { fontSize: 18, fontWeight: '800', color: '#1E3027' },
  rating: { marginTop: 5, color: '#667A70' },
  price: { fontSize: 20, fontWeight: '900', color: '#0B7A45' },
  quoteNote: { marginTop: 14, color: '#4F6259', lineHeight: 21 },
  quoteActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#EDF3EF',
  },
  secondaryText: { color: '#315243', fontWeight: '800' },
  acceptButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#0FA958',
  },
  workerHero: { padding: 18, borderRadius: 18, backgroundColor: '#EAF8F0', marginBottom: 18 },
  online: { color: '#0B8D4A', fontWeight: '800', marginBottom: 10 },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E4EBE7',
  },
  categoryPill: {
    backgroundColor: '#EAF8F0',
    color: '#0B7A45',
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    overflow: 'hidden',
  },
  time: { color: '#87968E', fontSize: 12 },
  jobTitle: { fontSize: 19, fontWeight: '800', color: '#1C3026', marginTop: 12 },
  jobMeta: { marginTop: 7, color: '#667A70' },
  jobBudget: { marginTop: 12, fontSize: 18, fontWeight: '900', color: '#17251E' },
});
