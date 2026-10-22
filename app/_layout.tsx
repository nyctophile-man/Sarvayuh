import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { setUnauthorizedHandler } from '@/lib/api';
import { I18nProvider } from '@/lib/i18n/context';
import { ThemeProvider, useTheme } from '@/lib/theme';

function RootStack() {
  const { isDark, colors } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="modal" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const router = useRouter();
  setUnauthorizedHandler(() => router.replace('/(auth)/login' as any));
  return (
    <ThemeProvider>
      <I18nProvider>
        <RootStack />
      </I18nProvider>
    </ThemeProvider>
  );
}
