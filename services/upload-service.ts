import { API_CONFIG } from "@/constants/api-config";
import RNBackgroundUpload from "react-native-background-upload";
import { ScreenshotAsset } from "./media-service";

export interface UploadOptions {
  url: string;
  path: string;
  method?: string;
  type?: "multipart" | "raw";
  field?: string;
  headers?: Record<string, string>;
  notification?: {
    enabled?: boolean;
    autoClear?: boolean;
    title?: string;
    description?: string;
  };
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
 * 단일 파일 업로드
 */
async function uploadFile(
  asset: ScreenshotAsset,
  onProgress: (progress: UploadProgress) => void
): Promise<boolean> {
  const uploadId = `${asset.id}-${Date.now()}`;

  try {
    // 업로드 진행 상황 업데이트
    onProgress({
      uploadId,
      filename: asset.filename,
      progress: 0,
      status: "uploading",
    });

    const options: UploadOptions = {
      url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SCREENSHOTS}`,
      path: asset.uri,
      method: "POST",
      type: "multipart",
      field: "file",
      headers: {
        "X-Guest-Id": API_CONFIG.GUEST_USER_ID,
      },
      notification: {
        enabled: true,
        autoClear: true,
        title: "스크린샷 업로드 중",
        description: asset.filename,
      },
    };

    try {
      // 업로드 시작하고 uploadId 받기
      const generatedUploadId = await (RNBackgroundUpload.startUpload as any)(options);

      return new Promise((resolve) => {
        // 진행률 업데이트
        const progressSubscription = (RNBackgroundUpload.addListener as any)(
          "progress",
          generatedUploadId,
          (data: { progress: number; id: string }) => {
            onProgress({
              uploadId: generatedUploadId,
              filename: asset.filename,
              progress: Math.round(data.progress),
              status: "uploading",
            });
          }
        );

        // 완료
        const completedSubscription = (RNBackgroundUpload.addListener as any)(
          "completed",
          generatedUploadId,
          () => {
            console.log(`✅ Upload completed: ${asset.filename}`);
            onProgress({
              uploadId: generatedUploadId,
              filename: asset.filename,
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
        );

        // 에러
        const errorSubscription = (RNBackgroundUpload.addListener as any)(
          "error",
          generatedUploadId,
          (data: { error: string; id: string }) => {
            console.error(`❌ Upload error: ${asset.filename}`, data.error);
            onProgress({
              uploadId: generatedUploadId,
              filename: asset.filename,
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
        );

        // 취소
        const cancelledSubscription = (RNBackgroundUpload.addListener as any)(
          "cancelled",
          generatedUploadId,
          () => {
            console.warn(`⚠️ Upload cancelled: ${asset.filename}`);

            // 리스너 제거
            progressSubscription?.remove?.();
            completedSubscription?.remove?.();
            errorSubscription?.remove?.();
            cancelledSubscription?.remove?.();
            resolve(false);
          }
        );
      });
    } catch (uploadError) {
      console.error(`❌ Failed to start upload: ${asset.filename}`, uploadError);
      throw uploadError;
    }
  } catch (error) {
    console.error(`❌ Upload failed: ${asset.filename}`, error);
    onProgress({
      uploadId,
      filename: asset.filename,
      progress: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

/**
 * 여러 파일 배치 업로드
 */
export async function uploadScreenshots(
  screenshots: ScreenshotAsset[]
): Promise<void> {
  if (screenshots.length === 0) {
    console.warn("No screenshots to upload");
    return;
  }

  try {
    updateUploadState({
      isUploading: true,
      totalFiles: screenshots.length,
      completedFiles: 0,
      failedFiles: 0,
      uploads: screenshots.map((screenshot) => ({
        uploadId: screenshot.id,
        filename: screenshot.filename,
        progress: 0,
        status: "pending" as const,
      })),
    });

    console.log(`🚀 Starting upload of ${screenshots.length} screenshots`);

    let completedCount = 0;
    let failedCount = 0;

    // 순차적으로 업로드 (동시성 제한)
    const uploadPromises = screenshots.map((screenshot) =>
      uploadFile(screenshot, (progress) => {
        // 업로드 목록 업데이트
        updateUploadState((prevState: UploadState) => ({
          ...prevState,
          uploads: prevState.uploads.map((upload) =>
            upload.uploadId === progress.uploadId ? progress : upload
          ),
        }));

        // 완료/실패 카운트 업데이트
        if (progress.status === "completed") {
          completedCount++;
          updateUploadState({ completedFiles: completedCount });
        } else if (progress.status === "error") {
          failedCount++;
          updateUploadState({ failedFiles: failedCount });
        }
      }).then((success) => success)
    );

    // 모든 업로드 완료 대기
    await Promise.all(uploadPromises);

    console.log(
      `✨ Upload complete: ${completedCount} succeeded, ${failedCount} failed`
    );

    updateUploadState({
      isUploading: false,
    });
  } catch (error) {
    console.error("Batch upload error:", error);
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
      .filter((upload) => upload.status === "uploading" || upload.status === "pending")
      .map((upload) => (RNBackgroundUpload.cancelUpload as any)(upload.uploadId));

    await Promise.all(cancelPromises);
    console.log("Cancelled all uploads");
  } catch (error) {
    console.error("Failed to cancel all uploads:", error);
  }
}
