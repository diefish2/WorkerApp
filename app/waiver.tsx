import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function WaiverScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>

        <Text style={styles.title}>免責聲明及使用條款</Text>
        <Text style={styles.version}>版本：2026-10-10-v1</Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>重要提示</Text>
          <Text style={styles.noticeText}>
            呢份內容係 WorkerApp 測試版條款草稿。正式公開營運前，應由合資格律師按實際營運地區、保險安排及商業模式審閱。
          </Text>
        </View>

        <Text style={styles.heading}>1. 平台角色</Text>
        <Text style={styles.paragraph}>
          WorkerApp 只提供平台協助 Customer 與獨立服務提供者（師傅）互相聯絡、刊登工作、報價及溝通。除非另有明確書面說明，WorkerApp 並非相關服務嘅承辦商、僱主或代理。
        </Text>

        <Text style={styles.heading}>2. 師傅屬獨立服務提供者</Text>
        <Text style={styles.paragraph}>
          師傅自行決定是否接工作、報價、工作方法、工具及所需牌照或資格。Customer 應自行判斷師傅是否適合相關工作，並可要求查看牌照、保險、資格或過往工作資料。
        </Text>

        <Text style={styles.heading}>3. 報價與服務協議</Text>
        <Text style={styles.paragraph}>
          報價、工作範圍、時間、材料、保養及額外收費應由 Customer 與師傅自行確認。WorkerApp 唔保證價錢、服務質素、完成時間或結果。
        </Text>

        <Text style={styles.heading}>4. 風險與責任</Text>
        <Text style={styles.paragraph}>
          家居維修、電力、水喉、冷氣、裝修、鎖匠及其他現場服務可能涉及財物損壞、人身受傷或其他風險。用戶應採取合理安全措施，並在需要時尋求合資格專業人士協助。
        </Text>

        <Text style={styles.heading}>5. 非緊急服務</Text>
        <Text style={styles.paragraph}>
          WorkerApp 並非緊急事故服務。涉及火警、漏煤氣、嚴重漏電、重大水浸、人身危險或其他緊急情況時，應聯絡當地緊急服務或合資格專業人員。
        </Text>

        <Text style={styles.heading}>6. 用戶提供資料</Text>
        <Text style={styles.paragraph}>
          用戶應提供真實、準確及適當資料，並避免上載無權分享嘅個人資料、相片或第三方內容。
        </Text>

        <Text style={styles.heading}>7. 評分及內容</Text>
        <Text style={styles.paragraph}>
          評分、評論及相片應基於真實服務經驗，不應包含誹謗、威脅、騷擾、虛假或違法內容。WorkerApp 可按平台規則移除不適當內容或限制帳戶使用。
        </Text>

        <Text style={styles.heading}>8. 平台可用性</Text>
        <Text style={styles.paragraph}>
          WorkerApp 會盡合理努力維持服務，但唔保證平台、通知、訊息、相片、資料或其他功能永遠無中斷、無錯誤或即時送達。
        </Text>

        <Text style={styles.heading}>9. 接受條款</Text>
        <Text style={styles.paragraph}>
          勾選「我已閱讀並同意」並繼續取得 OTP，即表示你接受當時顯示版本嘅條款。系統會保存接受時間及條款版本作帳戶紀錄。
        </Text>

        <Text style={styles.footer}>
          正式推出前，亦應另行準備完整 Privacy Policy、Terms of Service 及適用嘅爭議處理政策。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  content: { padding: 20, paddingBottom: 60 },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '800', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', color: '#17251E' },
  version: { color: '#7A8981', fontSize: 12, marginTop: 7, marginBottom: 18 },
  notice: { backgroundColor: '#FFF9E8', borderWidth: 1, borderColor: '#EADCA7', borderRadius: 12, padding: 14, marginBottom: 18 },
  noticeTitle: { fontWeight: '900', color: '#6E5E25', marginBottom: 5 },
  noticeText: { color: '#6E5E25', lineHeight: 19, fontSize: 13 },
  heading: { fontSize: 17, fontWeight: '900', color: '#263A30', marginTop: 18, marginBottom: 7 },
  paragraph: { fontSize: 14, lineHeight: 22, color: '#52675C' },
  footer: { marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#DDE7E0', color: '#7A8981', fontSize: 12, lineHeight: 19 },
});
