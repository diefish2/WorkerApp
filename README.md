# WorkerApp

A beginner-friendly React Native + Expo prototype for a Hong Kong people-to-people home services marketplace.

## What this demo currently does

### Customer mode
- Browse service categories
- Post a job request
- Enter a description
- Enter an optional budget in HKD
- Open a placeholder photo-upload action
- View sample worker quotes
- Select a worker

### Worker mode
- See nearby sample jobs
- View district and budget
- Open a quote action

## Where to edit things

### 1. Edit service categories, jobs, worker names and prices
Open:

`src/data/mockData.ts`

This is the easiest file to edit.

Example:

```ts
{
  id: 'job-1',
  title: '廚房水喉漏水',
  district: '中環',
  budget: 'HK$500–800',
  time: '10 分鐘前',
  category: '水喉',
}
```

Change any text between the quote marks.

### 2. Edit the main screens and wording
Open:

`app/index.tsx`

The important sections are named clearly:

- `CustomerHome`
- `PostJobScreen`
- `QuotesScreen`
- `WorkerHome`

### 3. Edit colours and spacing
At the bottom of `app/index.tsx`, find:

```ts
const styles = StyleSheet.create({
```

The main WorkerApp green colours are currently:

- Dark green: `#0B7A45`
- Main green: `#0FA958`
- Light green: `#EAF8F0`

## Run the app on your phone

Install Node.js on your computer first.

Then in Terminal:

```bash
git clone https://github.com/diefish2/WorkerApp.git
cd WorkerApp
npm install
npx expo start
```

Install **Expo Go** on your iPhone or Android phone.

When Expo shows a QR code:

- iPhone: scan it with the Camera app
- Android: scan it from Expo Go

If your phone cannot connect, try:

```bash
npx expo start --tunnel
```

## Project structure

```text
WorkerApp/
├── app/
│   ├── _layout.tsx        # Expo navigation setup
│   └── index.tsx          # Main app screens and UI
├── src/
│   └── data/
│       └── mockData.ts    # Easy-to-edit demo data
├── app.json               # iOS / Android Expo configuration
├── package.json           # Dependencies and run commands
├── tsconfig.json          # TypeScript settings
└── README.md              # This guide
```

## Important

This is still a prototype. It does not yet have a real database, login, payments, live messaging, push notifications, or real photo uploads.

Those features can be added step by step later.
