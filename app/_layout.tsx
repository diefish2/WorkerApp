import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      initialRouteName="login"
      screenOptions={{
        headerTitleAlign: 'center',
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="index" />
    </Stack>
  );
}
