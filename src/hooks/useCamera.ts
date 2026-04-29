import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
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
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => {
      track.stop();
    });

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
    }

    setIsReady(false);
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
        try {
          setError(null);
          setIsReady(false);

          stopCamera();

          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: deviceId
                ? { deviceId: { exact: deviceId } }
                : { facingMode: mode },
            audio: false
          });

          streamRef.current = mediaStream;

          const video = videoRef.current;
          if (!video) return;

          video.srcObject = mediaStream;

          video.onloadedmetadata = () => {
            void video.play().then(() => {
              setIsReady(true);
              void refreshDevices();
            }).catch((playError: unknown) => {
              if (playError instanceof DOMException && playError.name === 'AbortError') {
                return;
              }

              setError('Could not start camera preview.');
              console.error('Video play failed:', playError);
            });
          };
        } catch (cameraError) {
          setError('Could not access the camera.');
          console.error('Camera error:', cameraError);
        }
      },
      [selectedDeviceId, facingMode, stopCamera, videoRef, refreshDevices]
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