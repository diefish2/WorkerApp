// Easy-to-edit demo data for WorkerApp.
// You can change names, districts, prices, categories, or text here
// without touching the main app screen code.

export const categories = [
  { icon: '⚡', label: '電工' },
  { icon: '🚰', label: '水喉' },
  { icon: '❄️', label: '冷氣' },
  { icon: '🪛', label: '維修' },
  { icon: '🎨', label: '油漆' },
  { icon: '🧹', label: '清潔' },
  { icon: '🪚', label: '裝修' },
  { icon: '🔒', label: '鎖匠' },
];

export const jobs = [
  {
    id: 'job-1',
    title: '廚房水喉漏水',
    district: '中環',
    budget: 'HK$500–800',
    time: '10 分鐘前',
    category: '水喉',
  },
  {
    id: 'job-2',
    title: '睡房冷氣唔凍',
    district: '尖沙咀',
    budget: 'HK$700–1,200',
    time: '25 分鐘前',
    category: '冷氣',
  },
  {
    id: 'job-3',
    title: '安裝兩盞天花燈',
    district: '沙田',
    budget: '客人等報價',
    time: '42 分鐘前',
    category: '電工',
  },
];

export const quotes = [
  {
    id: 'quote-1',
    name: '陳師傅',
    rating: '4.9',
    jobsCompleted: '120',
    price: 'HK$600',
    note: '今日下午可以上門，包基本材料。',
  },
  {
    id: 'quote-2',
    name: '李師傅',
    rating: '4.8',
    jobsCompleted: '86',
    price: 'HK$550',
    note: '最快兩小時內到。',
  },
  {
    id: 'quote-3',
    name: 'Fix Home',
    rating: '4.7',
    jobsCompleted: '204',
    price: 'HK$650',
    note: '有保養，可即日處理。',
  },
];
