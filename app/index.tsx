import { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const categories = [
  ['⚡', '電工'],
  ['🚰', '水喉'],
  ['❄️', '冷氣'],
  ['🪛', '維修'],
  ['🎨', '油漆'],
  ['🧹', '清潔'],
  ['🪚', '裝修'],
  ['🔒', '鎖匠'],
];

const jobs = [
  {
    title: '廚房水喉漏水',
    district: '中環',
    budget: 'HK$500–800',
    time: '10 分鐘前',
    category: '水喉',
  },
  {
    title: '睡房冷氣唔凍',
    district: '尖沙咀',
    budget: 'HK$700–1,200',
    time: '25 分鐘前',
    category: '冷氣',
  },
  {
    title: '安裝兩盞天花燈',
    district: '沙田',
    budget: '客人等報價',
    time: '42 分鐘前',
    category: '電工',
  },
];

const quotes = [
  { name: '陳師傅', rating: '4.9', jobs: '120', price: 'HK$600', note: '今日下午可以上門，包基本材料。' },
  { name: '李師傅', rating: '4.8', jobs: '86', price: 'HK$550', note: '最快兩小時內到。' },
  { name: 'Fix Home', rating: '4.7', jobs: '204', price: 'HK$650', note: '有保養，可即日處理。' },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<'customer' | 'worker'>('customer');
  const [screen, setScreen] = useState<'home' | 'post' | 'quotes'>('home');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [budget, setBudget] = useState('');

  const postJob = () => {
    if (!title.trim()) {
      Alert.alert('請輸入需要', '例如：廚房水喉漏水');
      return;
    }
    setScreen('quotes');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>WorkerApp</Text>
          <Text style={styles.tagline}>香港本地幫手平台</Text>
        </View>
        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => { setMode('customer'); setScreen('home'); }}
            style={[styles.modeButton, mode === 'customer' && styles.modeActive]}
          >
            <Text style={[styles.modeText, mode === 'customer' && styles.modeTextActive]}>客戶</Text>
          </Pressable>
          <Pressable
            onPress={() => { setMode('worker'); setScreen('home'); }}
            style={[styles.modeButton, mode === 'worker' && styles.modeActive]}
          >
            <Text style={[styles.modeText, mode === 'worker' && styles.modeTextActive]}>師傅</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {mode === 'customer' && screen === 'home' && (
          <>
            <Text style={styles.location}>📍 香港</Text>
            <Text style={styles.heroTitle}>屋企有嘢要整？</Text>
            <Text style={styles.heroSubtitle}>出個需求，等附近師傅直接向你報價。</Text>

            <Pressable style={styles.primaryButton} onPress={() => setScreen('post')}>
              <Text style={styles.primaryButtonText}>＋ 發佈需求</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>服務類別</Text>
            <View style={styles.categoryGrid}>
              {categories.map(([icon, label]) => (
                <Pressable key={label} style={styles.categoryCard} onPress={() => setScreen('post')}>
                  <Text style={styles.categoryIcon}>{icon}</Text>
                  <Text style={styles.categoryLabel}>{label}</Text>
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
        )}

        {mode === 'customer' && screen === 'post' && (
          <>
            <Pressable onPress={() => setScreen('home')}><Text style={styles.back}>‹ 返回</Text></Pressable>
            <Text style={styles.pageTitle}>發佈需求</Text>
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
            <Text style={styles.label}>相片</Text>
            <Pressable style={styles.photoBox} onPress={() => Alert.alert('Prototype', '下一版會接手機相簿及相機。')}>
              <Text style={styles.photoPlus}>＋</Text>
              <Text style={styles.photoText}>上載相片</Text>
            </Pressable>
            <Text style={styles.label}>你心目中嘅價錢（可選）</Text>
            <TextInput
              value={budget}
              onChangeText={setBudget}
              placeholder="例如 600"
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.currencyHint}>HKD</Text>
            <Pressable style={styles.primaryButton} onPress={postJob}>
              <Text style={styles.primaryButtonText}>發佈需求</Text>
            </Pressable>
          </>
        )}

        {mode === 'customer' && screen === 'quotes' && (
          <>
            <Pressable onPress={() => setScreen('home')}><Text style={styles.back}>‹ 主頁</Text></Pressable>
            <Text style={styles.pageTitle}>收到嘅報價</Text>
            <View style={styles.jobSummary}>
              <Text style={styles.jobTitle}>{title || '廚房水喉漏水'}</Text>
              <Text style={styles.jobMeta}>📍 香港 · {budget ? `你嘅預算 HK$${budget}` : '等待報價'}</Text>
            </View>
            {quotes.map((quote) => (
              <View key={quote.name} style={styles.quoteCard}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.workerName}>{quote.name}</Text>
                    <Text style={styles.rating}>⭐ {quote.rating} · {quote.jobs} 單</Text>
                  </View>
                  <Text style={styles.price}>{quote.price}</Text>
                </View>
                <Text style={styles.quoteNote}>{quote.note}</Text>
                <View style={styles.quoteActions}>
                  <Pressable style={styles.secondaryButton}><Text style={styles.secondaryText}>傾一傾</Text></Pressable>
                  <Pressable style={styles.acceptButton} onPress={() => Alert.alert('已選擇師傅', `${quote.name} · ${quote.price}`)}>
                    <Text style={styles.primaryButtonText}>揀佢</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {mode === 'worker' && (
          <>
            <View style={styles.workerHero}>
              <View>
                <Text style={styles.online}>● 在線接單</Text>
                <Text style={styles.heroTitle}>附近新工作</Text>
                <Text style={styles.heroSubtitle}>睇需求，再由你決定報幾多錢。</Text>
              </View>
            </View>

            {jobs.map((job) => (
              <View key={job.title} style={styles.jobCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.categoryPill}>{job.category}</Text>
                  <Text style={styles.time}>{job.time}</Text>
                </View>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <Text style={styles.jobMeta}>📍 {job.district}</Text>
                <Text style={styles.jobBudget}>{job.budget}</Text>
                <Pressable
                  style={styles.primaryButtonSmall}
                  onPress={() => Alert.alert('提交報價', `${job.title}\n你可以輸入價錢及可上門時間。`)}
                >
                  <Text style={styles.primaryButtonText}>立即報價</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7FAF8' },
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
  modeActive: { backgroundColor: '#0FA958' },
  modeText: { color: '#587066', fontWeight: '700' },
  modeTextActive: { color: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 40 },
  location: { color: '#60776D', fontWeight: '600', marginBottom: 16 },
  heroTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#17251E' },
  heroSubtitle: { fontSize: 16, lineHeight: 23, color: '#617168', marginTop: 8, marginBottom: 18 },
  primaryButton: { backgroundColor: '#0FA958', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginVertical: 10 },
  primaryButtonSmall: { backgroundColor: '#0FA958', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  sectionTitle: { marginTop: 26, marginBottom: 14, fontSize: 20, fontWeight: '800', color: '#17251E' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  categoryCard: { width: '22.5%', backgroundColor: '#FFFFFF', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E6ECE8' },
  categoryIcon: { fontSize: 24, marginBottom: 6 },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: '#314139' },
  infoCard: { marginTop: 24, padding: 18, backgroundColor: '#EAF8F0', borderRadius: 16 },
  infoTitle: { fontSize: 18, fontWeight: '800', color: '#145F3D', marginBottom: 10 },
  infoText: { fontSize: 14, lineHeight: 24, color: '#3B5C4C' },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#17251E', marginBottom: 22 },
  label: { fontSize: 15, fontWeight: '700', color: '#32443B', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  photoBox: { height: 105, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9DB5A8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  photoPlus: { fontSize: 28, color: '#0FA958' },
  photoText: { color: '#597066', marginTop: 4, fontWeight: '600' },
  currencyHint: { color: '#778980', marginTop: 6, marginBottom: 4 },
  jobSummary: { backgroundColor: '#EAF8F0', padding: 16, borderRadius: 14, marginBottom: 16 },
  quoteCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E4EBE7' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workerName: { fontSize: 18, fontWeight: '800', color: '#1E3027' },
  rating: { marginTop: 5, color: '#667A70' },
  price: { fontSize: 20, fontWeight: '900', color: '#0B7A45' },
  quoteNote: { marginTop: 14, color: '#4F6259', lineHeight: 21 },
  quoteActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondaryButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#EDF3EF' },
  secondaryText: { color: '#315243', fontWeight: '800' },
  acceptButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#0FA958' },
  workerHero: { padding: 18, borderRadius: 18, backgroundColor: '#EAF8F0', marginBottom: 18 },
  online: { color: '#0B8D4A', fontWeight: '800', marginBottom: 10 },
  jobCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E4EBE7' },
  categoryPill: { backgroundColor: '#EAF8F0', color: '#0B7A45', fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, overflow: 'hidden' },
  time: { color: '#87968E', fontSize: 12 },
  jobTitle: { fontSize: 19, fontWeight: '800', color: '#1C3026', marginTop: 12 },
  jobMeta: { marginTop: 7, color: '#667A70' },
  jobBudget: { marginTop: 12, fontSize: 18, fontWeight: '900', color: '#17251E' },
});
