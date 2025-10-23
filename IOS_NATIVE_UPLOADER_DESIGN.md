# iOS 네이티브 백그라운드 업로더 설계 및 구현

## 📋 개요

이 문서는 `pouch-it-poc2` 프로젝트에 iOS 네이티브 백그라운드 업로더를 구현한 설계 및 구현 결과를 기술합니다.

### 목표
- react-native-background-upload 라이브러리를 iOS에서 URLSession 기반 네이티브 구현으로 대체
- 압축 로직은 기존 expo-image-manipulator 유지 (RN 레벨)
- Android는 기존 react-native-background-upload 라이브러리 계속 사용

---

## 🏗️ 아키텍처

### 모듈 구조

```
modules/
  ios-background-uploader/
    ├── android/                          # Android placeholder
    ├── ios/
    │   ├── IosBackgroundUploaderModule.swift    # Expo Module 엔트리포인트
    │   ├── BackgroundUploadManager.swift        # URLSession 관리
    │   └── MultipartFormDataBuilder.swift       # Multipart form-data 생성
    ├── src/
    │   ├── index.ts                             # TypeScript 공개 API
    │   └── IosBackgroundUploaderModule.types.ts # 타입 정의
    ├── package.json                     # 모듈 패키지 정의
    └── tsconfig.json                    # TypeScript 설정
```

### 플랫폼별 구현

#### iOS (네이티브 URLSession)
```swift
// URLSessionConfiguration.background를 사용한 백그라운드 세션
// Multipart/form-data 수동 구성
// 진행률 추적 및 이벤트 발송
// React Native로의 이벤트 전송
```

#### Android (기존 라이브러리)
```typescript
// react-native-background-upload 라이브러리 유지
// 기존 코드 호환성 유지
```

---

## 📱 iOS 구현 상세

### 1. IosBackgroundUploaderModule.swift

**역할**: Expo Module의 진입점, React Native와의 브리지

**주요 함수**:
- `startUpload(options)`: 새로운 업로드 시작
- `cancelUpload(uploadId)`: 특정 업로드 취소

**이벤트 발송**:
- `onProgress`: 업로드 진행률 업데이트
- `onCompleted`: 업로드 완료
- `onError`: 에러 발생
- `onCancelled`: 업로드 취소

### 2. BackgroundUploadManager.swift

**역할**: URLSession 관리 및 업로드 로직 처리

**핵심 기능**:

1. **백그라운드 세션 설정**
   ```swift
   URLSessionConfiguration.background(withIdentifier: "com.pouchit.background-upload")
   ```
   - 앱 종료 후에도 업로드 계속
   - 시스템 수준의 네트워크 최적화

2. **진행률 추적**
   ```swift
   func urlSession(_:task:didSendBodyData:totalBytesSent:totalBytesExpectedToSend:)
   ```
   - 바이트 단위의 정확한 진행률 계산
   - 실시간 JavaScript 콜백

3. **업로드 상태 관리**
   - 메타데이터 저장 (URL, 파일 경로, 필드명 등)
   - 콜백 함수 저장 (progress, completion, error, cancelled)
   - Cleanup 자동화

4. **알림 통합**
   ```swift
   UNUserNotificationCenter
   ```
   - 업로드 시작 시 사용자 알림
   - 제목, 설명 커스터마이징 가능

### 3. MultipartFormDataBuilder.swift

**역할**: Multipart/form-data 바디 생성

**기능**:
- 파일 읽기
- Boundary 생성
- Multipart 형식 구성
- MIME 타입 자동 감지

**구성 예시**:
```
--boundary
Content-Disposition: form-data; name="screenshots"; filename="Screenshot.jpg"
Content-Type: image/jpeg

[파일 데이터]
--boundary--
```

---

## 🔌 TypeScript API

### 공개 인터페이스

```typescript
interface UploadOptions {
  url: string;
  path: string;           // 압축된 파일 경로 (file://)
  field: string;          // 필드명 (예: "screenshots")
  headers?: Record<string, string>;
  notification?: {
    title: string;
    description: string;
  };
}

// 함수
startUpload(options: UploadOptions): Promise<string>
cancelUpload(uploadId: string): Promise<void>

// 이벤트 리스너
addListener(
  eventName: 'onProgress' | 'onCompleted' | 'onError' | 'onCancelled',
  listener: (event: any) => void
): () => void
```

---

## 🔄 통합 방식

### upload-service.ts 수정 사항

**플랫폼별 업로더 선택**:
```typescript
const Uploader = Platform.select({
  ios: IosBackgroundUploader,      // 네이티브 URLSession
  android: RNBackgroundUpload,      // 기존 라이브러리
  default: RNBackgroundUpload,
});
```

**이벤트 네임 매핑**:
```typescript
// iOS: onProgress, onCompleted, onError, onCancelled
// Android: progress, completed, error, cancelled
Platform.select({
  ios: "onProgress",
  android: "progress",
})
```

**API 호환성 유지**:
- 기존 upload-service.ts의 인터페이스 유지
- 플랫폼별 이벤트 네임만 매핑

---

## 📊 성능 이점

### iOS에서의 개선 사항

1. **시스템 레벨 최적화**
   - URLSession의 Native 구현
   - 시스템 네트워크 스택 활용
   - 기본 제공 오류 복구

2. **백그라운드 업로드 지원**
   - 앱 종료 후에도 계속 업로드
   - 배터리 효율적인 처리
   - Cellular/WiFi 자동 선택

3. **메모리 효율**
   - 스트리밍 방식의 파일 업로드
   - 중간 버퍼링 최소화

4. **네트워크 안정성**
   - URLSession의 자동 재시도
   - 네트워크 전환 시 자동 복구
   - HTTP/2 지원

---

## ⚙️ 설정 및 사용

### 필수 권한 (Info.plist)

현재 구현에서 필요한 권한:
- 없음 (URLSession은 기본 권한으로 처리)

선택적:
- 알림 권한: `NSUserNotificationUsageDescription` (선택)

### 빌드 및 실행

```bash
# 의존성 설치
npm install

# iOS 프로젝트 생성/업데이트
npx expo prebuild --clean --platform ios

# iOS 빌드 및 실행
npm run ios
```

---

## 🧪 테스트 포인트

### 단위 테스트 권장사항

1. **파일 준비 단계**
   - 다양한 이미지 포맷 (JPEG, PNG, GIF)
   - 대용량 파일 처리
   - URI 변환 정확성

2. **업로드 진행**
   - 진행률 이벤트 발송 정확도
   - 다중 파일 동시 업로드
   - 취소 기능 동작

3. **에러 처리**
   - 네트워크 오류 (타임아웃, 연결 실패)
   - HTTP 오류 (4xx, 5xx)
   - 파일 읽기 오류

4. **백그라운드 동작**
   - 앱 백그라운드 진입 후 계속 업로드
   - 앱 종료 후 계속 업로드
   - 네트워크 전환 (WiFi ↔ Cellular)

---

## 🚀 향후 개선 사항

### Phase 2 (선택적)
1. **이미지 압축 네이티브 구현**
   - UIImage를 네이티브에서 직접 처리
   - 메모리 효율 개선
   - 속도 향상

2. **Android 네이티브 구현**
   - WorkManager + OkHttp 사용
   - iOS와 동일한 기능

3. **성능 모니터링**
   - 업로드 속도 측정
   - 메모리 사용량 추적
   - 배터리 영향 분석

### Phase 3 (선택적)
1. **고급 기능**
   - 자동 재시도 로직
   - 배치 업로드 최적화
   - 대역폭 제한 설정

2. **모니터링**
   - Sentry 통합
   - 분석 데이터 수집
   - 성능 프로파일링

---

## 📝 주요 코드 변경 사항

### Before (react-native-background-upload)
```typescript
import RNBackgroundUpload from "react-native-background-upload";

const uploadId = await RNBackgroundUpload.startUpload({
  url: "...",
  path: "...",
  type: "multipart",
  field: "screenshots",
});

RNBackgroundUpload.addListener("progress", uploadId, (data) => {
  // progress handling
});
```

### After (Platform.select)
```typescript
import * as IosBackgroundUploader from "ios-background-uploader";
import RNBackgroundUpload from "react-native-background-upload";

const Uploader = Platform.select({
  ios: IosBackgroundUploader,
  android: RNBackgroundUpload,
});

const uploadId = await Uploader.startUpload({
  url: "...",
  path: "...",
  field: "screenshots",
});

Uploader.addListener(
  Platform.select({ ios: "onProgress", android: "progress" }),
  (data) => {
    // progress handling
  }
);
```

---

## 🔧 문제 해결

### 일반적인 문제

1. **"Module ios-background-uploader not found"**
   - 해결: `npx expo prebuild --clean --platform ios` 재실행

2. **CocoaPods 오류**
   - 해결: `rm -rf ios && npx expo prebuild --platform ios`

3. **URLSession 세션 식별자 중복**
   - 현재 설정: `com.pouchit.background-upload`
   - 필요시 변경: BackgroundUploadManager.swift의 identifier 수정

---

## 📚 참고 자료

### Apple 공식 문서
- [URLSession](https://developer.apple.com/documentation/foundation/urlsession)
- [URLSessionUploadTask](https://developer.apple.com/documentation/foundation/urlsessionuploadtask)
- [Background Sessions](https://developer.apple.com/documentation/foundation/url_loading_system/downloading_files_in_the_background)

### Expo 관련
- [Expo Modules API](https://docs.expo.dev/modules/get-started/)
- [Local Modules](https://docs.expo.fyi/expo-module-local-autolinking.md)

---

## 📞 연락처 및 지원

구현 관련 문의사항이나 버그 리포트는 프로젝트 이슈 트래커를 통해 작성해주세요.

---

**마지막 업데이트**: 2025-10-23
**버전**: 1.0.0
