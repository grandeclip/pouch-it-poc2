export interface IosBackgroundUploaderModuleEvents {
    onProgress: (event: {
        uploadId: string;
        progress: number;
        filename: string;
    }) => void;
    onCompleted: (event: {
        uploadId: string;
        filename: string;
    }) => void;
    onError: (event: {
        uploadId: string;
        filename: string;
        error: string;
    }) => void;
    onCancelled: (event: {
        uploadId: string;
        filename: string;
    }) => void;
    [key: string]: any;
}
