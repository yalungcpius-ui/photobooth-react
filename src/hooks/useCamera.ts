import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { CameraDeviceOption } from '../types';

interface UseCameraResult {
  isReady: boolean;
  isStarting: boolean;
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
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);

  const stopCamera = useCallback(() => {
    requestIdRef.current += 1;

    streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => {
      track.stop();
    });
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.onloadedmetadata = null;
    }

    setIsReady(false);
    setIsStarting(false);
  }, [videoRef]);

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
    async (deviceId = selectedDeviceId, mode = facingMode) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not available in this browser.');
        }

        setError(null);
        setIsReady(false);
        setIsStarting(true);

        streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => {
          track.stop();
        });
        streamRef.current = null;

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            : {
                facingMode: mode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
          audio: false
        });

        if (requestId !== requestIdRef.current) {
          mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
          throw new Error('Video element is not ready yet.');
        }

        streamRef.current = mediaStream;
        video.srcObject = mediaStream;

        await new Promise<void>((resolve) => {
          if (video.readyState >= 1) {
            resolve();
            return;
          }
          video.onloadedmetadata = () => resolve();
        });

        if (requestId !== requestIdRef.current) {
          mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
          return;
        }

        await video.play().catch((playError: unknown) => {
          if (playError instanceof DOMException && playError.name === 'AbortError') {
            return;
          }
          throw playError;
        });

        setIsReady(true);
        setIsStarting(false);

        const activeTrack = mediaStream.getVideoTracks()[0];
        const activeDeviceId = activeTrack?.getSettings().deviceId;
        if (activeDeviceId && !selectedDeviceId) {
          setSelectedDeviceId(activeDeviceId);
        }

        void refreshDevices();
      } catch (cameraError) {
        const message = cameraError instanceof Error ? cameraError.message : 'Unable to access camera.';
        setError(message);
        setIsReady(false);
        setIsStarting(false);
      }
    },
    [facingMode, refreshDevices, selectedDeviceId, videoRef]
  );

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    isReady,
    isStarting,
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
