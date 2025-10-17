import { Image } from 'expo-image';
import { Platform, StyleSheet, ScrollView, View, Text } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { useUploadContext } from '@/contexts/upload-context';

export default function HomeScreen() {
  const { uploadState } = useUploadContext();

  const uploadProgress =
    uploadState && uploadState.totalFiles > 0
      ? Math.round((uploadState.completedFiles / uploadState.totalFiles) * 100)
      : 0;

  const hasActiveUploads =
    uploadState && (uploadState.isUploading || uploadState.uploads.some((u) => u.status !== 'completed' && u.status !== 'error'));

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>

      {/* 스크린샷 업로드 상태 표시 */}
      {uploadState && (
        <ThemedView style={styles.uploadStatusContainer}>
          <ThemedText type="subtitle">Screenshot Upload Status</ThemedText>

          {uploadState.totalFiles > 0 ? (
            <>
              <ThemedText style={styles.statusText}>
                Progress: {uploadState.completedFiles}/{uploadState.totalFiles} ({uploadProgress}%)
              </ThemedText>

              {/* 진행률 바 */}
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${uploadProgress}%`,
                      backgroundColor:
                        uploadState.failedFiles > 0 ? '#FF6B6B' : '#4CAF50',
                    },
                  ]}
                />
              </View>

              {/* 상태 요약 */}
              {uploadState.failedFiles > 0 && (
                <ThemedText style={styles.failureText}>
                  ⚠️ Failed: {uploadState.failedFiles}
                </ThemedText>
              )}

              {uploadState.isUploading && (
                <ThemedText style={styles.uploadingText}>
                  Uploading in background...
                </ThemedText>
              )}

              {uploadProgress === 100 && uploadState.failedFiles === 0 && (
                <ThemedText style={styles.successText}>
                  ✅ All screenshots uploaded successfully!
                </ThemedText>
              )}

              {/* 업로드 목록 (최근 5개) */}
              {uploadState.uploads.length > 0 && (
                <View style={styles.uploadListContainer}>
                  <ThemedText style={styles.uploadListTitle}>Recent uploads:</ThemedText>
                  <ScrollView style={styles.uploadList}>
                    {uploadState.uploads.slice(-5).map((upload) => (
                      <View key={upload.uploadId} style={styles.uploadItem}>
                        <ThemedText style={styles.uploadFilename} numberOfLines={1}>
                          {upload.filename}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.uploadItemStatus,
                            {
                              color:
                                upload.status === 'completed'
                                  ? '#4CAF50'
                                  : upload.status === 'error'
                                    ? '#FF6B6B'
                                    : '#FFA726',
                            },
                          ]}>
                          {upload.status === 'uploading' && `${upload.progress}%`}
                          {upload.status === 'completed' && '✅'}
                          {upload.status === 'error' && `❌ ${upload.error || 'Failed'}`}
                          {upload.status === 'pending' && '⏳'}
                        </ThemedText>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          ) : (
            <ThemedText style={styles.noUploadText}>
              No uploads yet. Screenshots will be uploaded when detected.
            </ThemedText>
          )}
        </ThemedView>
      )}

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
          Press{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </ThemedText>{' '}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">Step 2: Explore</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  uploadStatusContainer: {
    gap: 12,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  failureText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  uploadingText: {
    fontSize: 12,
    color: '#FFA726',
    fontWeight: '600',
  },
  successText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  noUploadText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  uploadListContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    paddingTop: 8,
  },
  uploadListTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  uploadList: {
    maxHeight: 150,
  },
  uploadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  uploadFilename: {
    fontSize: 11,
    flex: 1,
    marginRight: 8,
  },
  uploadItemStatus: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },
});
