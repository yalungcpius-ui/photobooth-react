import { RefObject, useCallback, useEffect, useState } from 'react';
import type { CameraDeviceOption } from '../types';

interface UseCameraResult {
  isReady: boolean;
  error: string | null;
  devices: CameraDeviceOption[];
  selectedDeviceId: string;
  facingMode: 'user' | 'environment';
  setSelectedDeviceId: (deviceId: string) => void;
  setFacingMode: (mode: 'user' | 'environment') => void;
  refreshDevices: () => Promise<void>;
  startCamera: (deviceId?: string, mode?: 'user' | 'environment') => Promise<void>;
  stopCamera: () => void;
}

function mapDevices(devices: MediaDeviceInfo[]): CameraDeviceOption[] {
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${index + 1}`
    }));
}

export function useCamera(videoRef: RefObject<HTMLVideoElement | null>): UseCameraResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsReady(false);
  }, [stream, videoRef]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const nextDevices = mapDevices(allDevices);
    setDevices(nextDevices);

    if (!selectedDeviceId && nextDevices.length > 0) {
      setSelectedDeviceId(nextDevices[0].deviceId);
    }
  }, [selectedDeviceId]);

  const startCamera = useCallback(
    async (overrideDeviceId?: string, overrideFacingMode?: 'user' | 'environment') => {
      try {
        setError(null);
        stopCamera();

        const resolvedDeviceId = overrideDeviceId || selectedDeviceId;
        const resolvedFacingMode = overrideFacingMode || facingMode;
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: resolvedDeviceId
            ? {
                deviceId: { exact: resolvedDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }

            : {
                facingMode: resolvedFacingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
        });

        if (!videoRef.current) {
          mediaStream.getTracks().forEach((track) => track.stop());
          throw new Error('Video element is not ready yet.');
        }

        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setStream(mediaStream);
        setIsReady(true);

        await refreshDevices();

        if (overrideDeviceId) {
          setSelectedDeviceId(overrideDeviceId);
        } else if (!selectedDeviceId) {
          const videoTrack = mediaStream.getVideoTracks()[0];
          const settings = videoTrack?.getSettings();
          if (settings?.deviceId) {
            setSelectedDeviceId(settings.deviceId);
          }
        }
      } catch (cameraError) {
        const message = cameraError instanceof Error ? cameraError.message : 'Unable to access camera.';
        setError(message);
        setIsReady(false);
      }
    },
    [facingMode, refreshDevices, selectedDeviceId, stopCamera, videoRef]
  );

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return {
    isReady,
    error,
    devices,
    selectedDeviceId,
    facingMode,
    setSelectedDeviceId,
    setFacingMode,
    refreshDevices,
    startCamera,
    stopCamera
  };
}
