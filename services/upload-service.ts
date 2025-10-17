import { API_CONFIG } from "@/constants/api-config";
import RNBackgroundUpload from "react-native-background-upload";
import * as MediaLibrary from "expo-media-library";
import * as ImageManipulator from "expo-image-manipulator";
import { ScreenshotAsset } from "./media-service";

export interface CompressedFile {
  id: string;
  filename: string;
  compressedUri: string;
  originalUri: string;
  compressTime: number;
  uriConvertTime: number;
}

export interface UploadProgress {
  uploadId: string;
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

export interface UploadState {
  isUploading: boolean;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  uploads: UploadProgress[];
}

// 업로드 상태를 저장할 전역 변수
let uploadState: UploadState = {
  isUploading: false,
  totalFiles: 0,
  completedFiles: 0,
  failedFiles: 0,
  uploads: [],
};

// 이벤트 리스너 콜백
type UploadStateChangeCallback = (state: UploadState) => void;
const stateChangeCallbacks: UploadStateChangeCallback[] = [];

/**
 * 업로드 상태 변경 리스너 등록
 */
export function onUploadStateChange(
  callback: UploadStateChangeCallback
): () => void {
  stateChangeCallbacks.push(callback);
  // 구독 해제 함수 반환
  return () => {
    const index = stateChangeCallbacks.indexOf(callback);
    if (index > -1) {
      stateChangeCallbacks.splice(index, 1);
    }
  };
}

/**
 * 업로드 상태 업데이트 및 리스너 호출
 */
function updateUploadState(
  newState:
    | Partial<UploadState>
    | ((state: UploadState) => Partial<UploadState>)
) {
  const updates =
    typeof newState === "function" ? newState(uploadState) : newState;
  uploadState = { ...uploadState, ...updates };
  stateChangeCallbacks.forEach((callback) => callback(uploadState));
}

/**
 * 현재 업로드 상태 조회
 */
export function getUploadState(): UploadState {
  return { ...uploadState };
}

/**
 * 파일 압축 및 준비 (ph:// URI를 file:// URI로 변환 및 압축)
 */
async function compressAndPrepareFile(file: {
  id: string;
  uri: string;
  filename: string;
}): Promise<
  | CompressedFile
  | { error: string; file: { id: string; uri: string; filename: string } }
> {
  try {
    let uploadUri = file.uri;

    // iOS Photos URI 변환
    const uriConvertStart = Date.now();
    if (uploadUri.startsWith("ph://") || uploadUri.startsWith("ph-upload://")) {
      try {
        const asset = await MediaLibrary.getAssetInfoAsync(file.id);
        if (asset.localUri) {
          uploadUri = asset.localUri;
        }
      } catch (error) {
        console.error(`URI 변환 실패: ${file.filename}`, error);
      }
    }
    const uriConvertTime = Date.now() - uriConvertStart;

    // 이미지 압축 (0.7 품질)
    const compressStart = Date.now();
    const compressedImage = await ImageManipulator.manipulateAsync(
      uploadUri,
      [], // 리사이즈 없이 압축만
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    const compressTime = Date.now() - compressStart;

    return {
      id: file.id,
      filename: file.filename,
      compressedUri: compressedImage.uri,
      originalUri: file.uri,
      compressTime,
      uriConvertTime,
    };
  } catch (error) {
    console.error(`❌ File preparation failed: ${file.filename}`, error);
    return {
      error: error instanceof Error ? error.message : "압축 실패",
      file,
    };
  }
}

/**
 * 단일 파일 업로드 (multipart/form-data로 개별 파일 업로드)
 */
async function uploadFile(
  fileIndex: number,
  screenshot: ScreenshotAsset,
  totalFiles: number,
  onProgress: (progress: UploadProgress) => void
): Promise<boolean> {
  const uploadId = `file-${fileIndex}-${Date.now()}`;
  const fileNumber = fileIndex + 1;
  const fileStartTime = Date.now();

  try {
    // 파일 압축 및 준비
    const prepareStart = Date.now();
    const preparedFile = await compressAndPrepareFile({
      id: screenshot.id,
      uri: screenshot.uri,
      filename: screenshot.filename,
    });
    const prepareTime = Date.now() - prepareStart;

    // 압축 실패 시 에러 처리
    if ("error" in preparedFile) {
      console.error(
        `❌ File ${fileNumber}/${totalFiles} preparation failed:`,
        preparedFile.error
      );
      onProgress({
        uploadId,
        filename: screenshot.filename,
        progress: 0,
        status: "error",
        error: preparedFile.error,
      });
      return false;
    }

    // 업로드 옵션 (multipart/form-data로 개별 파일 업로드)
    const options: any = {
      url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SCREENSHOTS}`,
      path: preparedFile.compressedUri, // 압축된 file:// 경로 사용
      method: "POST",
      type: "multipart", // multipart/form-data 형식
      field: "screenshots", // 필드명: screenshots (변경 불가)
      headers: {
        "X-Guest-Id": API_CONFIG.GUEST_USER_ID,
      },
      notification: {
        enabled: true,
        autoClear: true,
        title: `스크린샷 업로드 중 [${fileNumber}/${totalFiles}]`,
        description: `${screenshot.filename}`,
      },
    };

    try {
      // 업로드 시작
      const generatedUploadId = await (RNBackgroundUpload.startUpload as any)(
        options
      );

      return new Promise((resolve) => {
        let completed = false;

        // 진행률 업데이트
        const progressSubscription = (RNBackgroundUpload.addListener as any)(
          "progress",
          generatedUploadId,
          (data: { progress: number; id: string }) => {
            if (!completed) {
              onProgress({
                uploadId: generatedUploadId,
                filename: screenshot.filename,
                progress: Math.round(data.progress),
                status: "uploading",
              });
            }
          }
        );

        // 완료
        const completedSubscription = (RNBackgroundUpload.addListener as any)(
          "completed",
          generatedUploadId,
          () => {
            if (!completed) {
              completed = true;
              const uploadTime = Date.now() - fileStartTime;
              const uploadNetworkTime = uploadTime - prepareTime;
              const seconds = (uploadTime / 1000).toFixed(2);

              console.log(
                `⏱️ File ${fileNumber}/${totalFiles}: 준비 ${prepareTime}ms | 업로드 ${uploadNetworkTime}ms | 총 ${seconds}s`
              );

              onProgress({
                uploadId: generatedUploadId,
                filename: screenshot.filename,
                progress: 100,
                status: "completed",
              });

              // 리스너 제거
              progressSubscription?.remove?.();
              completedSubscription?.remove?.();
              errorSubscription?.remove?.();
              cancelledSubscription?.remove?.();

              resolve(true);
            }
          }
        );

        // 에러
        const errorSubscription = (RNBackgroundUpload.addListener as any)(
          "error",
          generatedUploadId,
          (data: { error: string; id: string }) => {
            if (!completed) {
              completed = true;
              console.error(
                `❌ File ${fileNumber}/${totalFiles} error: ${screenshot.filename}`,
                data.error
              );
              onProgress({
                uploadId: generatedUploadId,
                filename: screenshot.filename,
                progress: 0,
                status: "error",
                error: data.error || "Unknown error",
              });

              // 리스너 제거
              progressSubscription?.remove?.();
              completedSubscription?.remove?.();
              errorSubscription?.remove?.();
              cancelledSubscription?.remove?.();

              resolve(false);
            }
          }
        );

        // 취소
        const cancelledSubscription = (RNBackgroundUpload.addListener as any)(
          "cancelled",
          generatedUploadId,
          () => {
            if (!completed) {
              completed = true;
              console.warn(
                `⚠️ File ${fileNumber}/${totalFiles} cancelled: ${screenshot.filename}`
              );

              // 리스너 제거
              progressSubscription?.remove?.();
              completedSubscription?.remove?.();
              errorSubscription?.remove?.();
              cancelledSubscription?.remove?.();

              resolve(false);
            }
          }
        );
      });
    } catch (uploadError) {
      console.error(
        `❌ Failed to start file upload ${fileNumber}/${totalFiles}: ${screenshot.filename}`,
        uploadError
      );
      throw uploadError;
    }
  } catch (error) {
    console.error(
      `❌ File ${fileNumber}/${totalFiles} failed: ${screenshot.filename}`,
      error
    );
    onProgress({
      uploadId,
      filename: screenshot.filename,
      progress: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

/**
 * 여러 파일 개별 업로드
 */
export async function uploadScreenshots(
  screenshots: ScreenshotAsset[]
): Promise<void> {
  if (screenshots.length === 0) {
    console.warn("No screenshots to upload");
    return;
  }

  try {
    const totalFiles = screenshots.length;
    const uploadStartTime = Date.now();

    updateUploadState({
      isUploading: true,
      totalFiles: totalFiles,
      completedFiles: 0,
      failedFiles: 0,
      uploads: screenshots.map((screenshot, index) => ({
        uploadId: `file-${index}`,
        filename: screenshot.filename,
        progress: 0,
        status: "pending" as const,
      })),
    });

    let completedCount = 0;
    let failedCount = 0;

    // 파일 순차 업로드
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      let fileCompleted = false;
      let fileFailed = false;

      const success = await uploadFile(i, screenshot, totalFiles, (progress) => {
        // 업로드 목록 업데이트
        updateUploadState((prevState: UploadState) => ({
          ...prevState,
          uploads: prevState.uploads.map((upload) =>
            upload.uploadId === `file-${i}`
              ? { ...upload, ...progress }
              : upload
          ),
        }));

        // 완료/실패 카운트 업데이트
        if (progress.status === "completed" && !fileCompleted) {
          fileCompleted = true;
          completedCount += 1;
          updateUploadState({ completedFiles: completedCount });
        } else if (progress.status === "error" && !fileFailed) {
          fileFailed = true;
          failedCount += 1;
          updateUploadState({ failedFiles: failedCount });
        }
      });

      // 만약 success가 false이고 아직 fileFailed가 false라면 (예상치 못한 실패)
      if (!success && !fileFailed) {
        fileFailed = true;
        failedCount += 1;
        updateUploadState({ failedFiles: failedCount });
      }
    }

    const totalTime = Date.now() - uploadStartTime;
    const totalSeconds = (totalTime / 1000).toFixed(2);
    const averageSeconds = (totalTime / totalFiles / 1000).toFixed(2);

    console.log(
      `⏱️ 전체 업로드 완료: ${completedCount}/${totalFiles} 파일 | 총 소요시간: ${totalSeconds}s | 평균: ${averageSeconds}s/파일`
    );

    updateUploadState({
      isUploading: false,
    });
  } catch (error) {
    console.error("Upload error:", error);
    updateUploadState({
      isUploading: false,
    });
  }
}

/**
 * 특정 업로드 취소
 */
export async function cancelUpload(uploadId: string): Promise<void> {
  try {
    await (RNBackgroundUpload.cancelUpload as any)(uploadId);
    console.log(`Cancelled upload: ${uploadId}`);
  } catch (error) {
    console.error("Failed to cancel upload:", error);
  }
}

/**
 * 모든 업로드 취소
 */
export async function cancelAllUploads(): Promise<void> {
  try {
    const cancelPromises = uploadState.uploads
      .filter(
        (upload) => upload.status === "uploading" || upload.status === "pending"
      )
      .map((upload) =>
        (RNBackgroundUpload.cancelUpload as any)(upload.uploadId)
      );

    await Promise.all(cancelPromises);
    console.log("Cancelled all uploads");
  } catch (error) {
    console.error("Failed to cancel all uploads:", error);
  }
}
