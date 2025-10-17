import React, { createContext, useContext, useEffect, useState } from 'react';
import { UploadState, onUploadStateChange } from '@/services/upload-service';

interface UploadContextType {
  uploadState: UploadState | null;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploadState, setUploadState] = useState<UploadState | null>(null);

  useEffect(() => {
    // 업로드 상태 변경 구독
    const unsubscribe = onUploadStateChange((newState) => {
      setUploadState(newState);
    });

    return unsubscribe;
  }, []);

  return (
    <UploadContext.Provider value={{ uploadState }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUploadContext() {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUploadContext must be used within UploadProvider');
  }
  return context;
}
