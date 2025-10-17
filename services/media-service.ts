import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

export interface ScreenshotAsset {
  id: string;
  filename: string;
  uri: string;
  mediaType: string;
  width: number;
  height: number;
  creationTime: number;
  modificationTime: number;
  duration: number;
}

/**
 * 사진 라이브러리 접근 권한 요청
 */
export async function requestPhotoPermission(): Promise<boolean> {
  try {
    const permission = await MediaLibrary.getPermissionsAsync();

    if (permission.status === 'granted') {
      return true;
    }

    if (permission.status === 'denied' && !permission.canAskAgain) {
      Alert.alert(
        '권한이 필요합니다',
        '사진 앨범에 접근하기 위해 설정에서 권한을 허용해주세요.',
        [{ text: '확인' }],
      );
      return false;
    }

    const response = await MediaLibrary.requestPermissionsAsync();
    return response.status === 'granted';
  } catch (error) {
    console.error('Permission request failed:', error);
    return false;
  }
}

/**
 * Screenshots 앨범 ID 가져오기
 */
export async function getScreenshotsAlbumId(): Promise<string | null> {
  try {
    const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    const screenshotsAlbum = albums.find(
      (album) => album.title === 'Screenshots' || album.title === '스크린샷',
    );
    return screenshotsAlbum?.id || null;
  } catch (error) {
    console.error('Failed to get Screenshots album:', error);
    return null;
  }
}

/**
 * Screenshots 앨범의 모든 사진 가져오기
 */
export async function getScreenshots(): Promise<ScreenshotAsset[]> {
  try {
    // 권한 확인
    const hasPermission = await requestPhotoPermission();
    if (!hasPermission) {
      return [];
    }

    // Screenshots 앨범 찾기
    const screenshotsAlbumId = await getScreenshotsAlbumId();
    if (!screenshotsAlbumId) {
      console.warn('Screenshots album not found');
      return [];
    }

    // 모든 사진 가져오기
    let screenshots: ScreenshotAsset[] = [];
    let after: string | undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const result = await MediaLibrary.getAssetsAsync({
        album: screenshotsAlbumId,
        mediaType: 'photo',
        first: 100,
        after,
      } as any);

      const assets = result.assets.map((asset) => ({
        id: asset.id,
        filename: asset.filename,
        uri: asset.uri,
        mediaType: asset.mediaType,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
        modificationTime: asset.modificationTime,
        duration: asset.duration,
      }));

      screenshots = [...screenshots, ...assets];
      hasNextPage = result.hasNextPage;
      after = result.endCursor;
    }

    console.log(`Found ${screenshots.length} screenshots`);
    return screenshots;
  } catch (error) {
    console.error('Failed to get screenshots:', error);
    return [];
  }
}

/**
 * 특정 사진의 상세 정보 가져오기
 */
export async function getAssetInfo(assetId: string): Promise<ScreenshotAsset | null> {
  try {
    const assets = await MediaLibrary.getAssetsAsync({
      first: 1,
      id: assetId,
    } as any);

    if (assets.assets.length === 0) {
      return null;
    }

    const asset = assets.assets[0];
    return {
      id: asset.id,
      filename: asset.filename,
      uri: asset.uri,
      mediaType: asset.mediaType,
      width: asset.width,
      height: asset.height,
      creationTime: asset.creationTime,
      modificationTime: asset.modificationTime,
      duration: asset.duration,
    };
  } catch (error) {
    console.error('Failed to get asset info:', error);
    return null;
  }
}
