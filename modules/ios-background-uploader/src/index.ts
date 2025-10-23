import { NativeModule, requireNativeModule } from 'expo';

import { IosBackgroundUploaderModuleEvents } from './IosBackgroundUploaderModule.types';

declare class IosBackgroundUploaderModule extends NativeModule<IosBackgroundUploaderModuleEvents> {
  startUpload(options: UploadOptions): Promise<string>;
  cancelUpload(uploadId: string): Promise<void>;
}

export interface UploadOptions {
  url: string;
  path: string;
  field: string;
  headers?: Record<string, string>;
  notification?: {
    title: string;
    description: string;
  };
}

export interface UploadProgress {
  uploadId: string;
  progress: number;
  filename: string;
}

export interface UploadEvent {
  uploadId: string;
  filename: string;
}

export interface UploadErrorEvent extends UploadEvent {
  error: string;
}

const IosBackgroundUploader = requireNativeModule('IosBackgroundUploader') as IosBackgroundUploaderModule;

export function startUpload(options: UploadOptions): Promise<string> {
  return IosBackgroundUploader.startUpload(options);
}

export function cancelUpload(uploadId: string): Promise<void> {
  return IosBackgroundUploader.cancelUpload(uploadId);
}

export function addListener(
  eventName: 'onProgress' | 'onCompleted' | 'onError' | 'onCancelled',
  listener: (event: any) => void
): () => void {
  const subscription = IosBackgroundUploader.addListener(eventName, listener);
  return () => subscription.remove();
}

export default IosBackgroundUploader;
