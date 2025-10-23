"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startUpload = startUpload;
exports.cancelUpload = cancelUpload;
exports.addListener = addListener;
const expo_1 = require("expo");
const IosBackgroundUploader = (0, expo_1.requireNativeModule)('IosBackgroundUploader');
function startUpload(options) {
    return IosBackgroundUploader.startUpload(options);
}
function cancelUpload(uploadId) {
    return IosBackgroundUploader.cancelUpload(uploadId);
}
function addListener(eventName, listener) {
    const subscription = IosBackgroundUploader.addListener(eventName, listener);
    return () => subscription.remove();
}
exports.default = IosBackgroundUploader;
