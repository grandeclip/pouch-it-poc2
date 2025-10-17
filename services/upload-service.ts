import { API_CONFIG } from "@/constants/api-config";
import RNBackgroundUpload from "react-native-background-upload";
import { ScreenshotAsset } from "./media-service";

const BATCH_SIZE = 20;

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
 * 배치 업로드 (JSON 바디로 20장씩)
 */
async function uploadBatch(
  batchIndex: number,
  screenshots: ScreenshotAsset[],
  totalBatches: number,
  onProgress: (progress: UploadProgress) => void
): Promise<boolean> {
  const uploadId = `batch-${batchIndex}-${Date.now()}`;
  const batchNumber = batchIndex + 1;

  try {
    // 스크린샷 URI 배열 생성
    const screenshotUris = screenshots.map((s) => s.uri);

    // JSON 페이로드 생성
    const payload = {
      screenshots: screenshotUris,
    };

    console.log(
      `📦 Batch ${batchNumber}/${totalBatches}: Uploading ${screenshots.length} screenshots`
    );

    // JSON 문자열로 변환
    const jsonString = JSON.stringify(payload);
    console.log(
      `📤 Payload size: ${jsonString.length} bytes, Screenshots: ${screenshotUris.length}`
    );

    // 업로드 옵션
    const options: any = {
      url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SCREENSHOTS}`,
      path: `data:application/json;base64,${Buffer.from(jsonString).toString("base64")}`,
      method: "POST",
      type: "raw",
      headers: {
        "Content-Type": "application/json",
        "X-Guest-Id": API_CONFIG.GUEST_USER_ID,
      },
      notification: {
        enabled: true,
        autoClear: true,
        title: `스크린샷 업로드 중 [${batchNumber}/${totalBatches}]`,
        description: `${screenshots.length}개 파일 처리 중...`,
      },
    };

    try {
      // 업로드 시작
      const generatedUploadId = await (RNBackgroundUpload.startUpload as any)(options);

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
                filename: `Batch ${batchNumber}/${totalBatches} (${screenshots.length} files)`,
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
              console.log(
                `✅ Batch ${batchNumber}/${totalBatches} completed: ${screenshots.length} files`
              );
              onProgress({
                uploadId: generatedUploadId,
                filename: `Batch ${batchNumber}/${totalBatches} (${screenshots.length} files)`,
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
              console.error(`❌ Batch ${batchNumber}/${totalBatches} error:`, data.error);
              onProgress({
                uploadId: generatedUploadId,
                filename: `Batch ${batchNumber}/${totalBatches} (${screenshots.length} files)`,
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
              console.warn(`⚠️ Batch ${batchNumber}/${totalBatches} cancelled`);

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
      console.error(`❌ Failed to start batch ${batchNumber}/${totalBatches}:`, uploadError);
      throw uploadError;
    }
  } catch (error) {
    console.error(`❌ Batch ${batchNumber}/${totalBatches} failed:`, error);
    onProgress({
      uploadId,
      filename: `Batch ${batchNumber}/${totalBatches} (${screenshots.length} files)`,
      progress: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

/**
 * 여러 파일 배치 업로드 (20장씩 분할)
 */
export async function uploadScreenshots(
  screenshots: ScreenshotAsset[]
): Promise<void> {
  if (screenshots.length === 0) {
    console.warn("No screenshots to upload");
    return;
  }

  try {
    // 배치로 나누기
    const batches: ScreenshotAsset[][] = [];
    for (let i = 0; i < screenshots.length; i += BATCH_SIZE) {
      batches.push(screenshots.slice(i, i + BATCH_SIZE));
    }

    const totalBatches = batches.length;

    updateUploadState({
      isUploading: true,
      totalFiles: screenshots.length,
      completedFiles: 0,
      failedFiles: 0,
      uploads: batches.map((batch, index) => ({
        uploadId: `batch-${index}`,
        filename: `Batch ${index + 1}/${totalBatches} (${batch.length} files)`,
        progress: 0,
        status: "pending" as const,
      })),
    });

    console.log(
      `🚀 Starting upload of ${screenshots.length} screenshots in ${totalBatches} batches (${BATCH_SIZE} per batch)`
    );

    let completedCount = 0;
    let failedCount = 0;

    // 배치 순차 업로드
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const success = await uploadBatch(i, batch, totalBatches, (progress) => {
        // 업로드 목록 업데이트
        updateUploadState((prevState: UploadState) => ({
          ...prevState,
          uploads: prevState.uploads.map((upload) =>
            upload.uploadId === `batch-${i}` ? { ...upload, ...progress } : upload
          ),
        }));

        // 완료/실패 카운트 업데이트
        if (progress.status === "completed" && completedCount < i + 1) {
          completedCount = i + 1;
          updateUploadState({ completedFiles: completedCount });
        } else if (progress.status === "error") {
          failedCount++;
          updateUploadState({ failedFiles: failedCount });
        }
      });

      if (!success) {
        failedCount++;
      }
    }

    console.log(
      `✨ Upload complete: ${completedCount} batches succeeded, ${failedCount} batches failed`
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
