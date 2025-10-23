import { NativeModule } from 'expo';
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
declare const IosBackgroundUploader: IosBackgroundUploaderModule;
export declare function startUpload(options: UploadOptions): Promise<string>;
export declare function cancelUpload(uploadId: string): Promise<void>;
export declare function addListener(eventName: 'onProgress' | 'onCompleted' | 'onError' | 'onCancelled', listener: (event: any) => void): () => void;
export default IosBackgroundUploader;
