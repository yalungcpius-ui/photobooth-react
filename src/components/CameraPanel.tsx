import type { RefObject } from 'react';
import type { CameraDeviceOption } from '../types';

interface CameraPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  isStarting: boolean;
  hasCameraStarted: boolean;
  error: string | null;
  devices: CameraDeviceOption[];
  selectedDeviceId: string;
  facingMode: 'user' | 'environment';
  onStartCamera: () => void;
  onDeviceChange: (deviceId: string) => void;
  onFacingModeChange: (mode: 'user' | 'environment') => void;
  onRefreshDevices: () => void;
}

export function CameraPanel({
  videoRef,
  isReady,
  isStarting,
  hasCameraStarted,
  error,
  devices,
  selectedDeviceId,
  facingMode,
  onStartCamera,
  onDeviceChange,
  onFacingModeChange,
  onRefreshDevices
}: CameraPanelProps) {
  return (
    <section className="panel camera-panel">
      <div className="panel-row">
        <div>
          <h2>Live camera</h2>
          <p className="helper-text">Tap start first, then pick a camera or lens. This is more reliable on iPad, iPhone and Android.</p>
        </div>
        <button type="button" className="ghost-button" onClick={onRefreshDevices}>
          Refresh cameras
        </button>
      </div>

      <div className="settings-grid camera-source-grid">
        <label className="field-group">
          Camera source
          <select value={selectedDeviceId} onChange={(event) => onDeviceChange(event.target.value)} disabled={!hasCameraStarted && devices.length === 0}>
            <option value="">Auto camera</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          Phone/tablet lens
          <select value={facingMode} onChange={(event) => onFacingModeChange(event.target.value as 'user' | 'environment')}>
            <option value="user">Front/selfie camera</option>
            <option value="environment">Rear camera</option>
          </select>
        </label>
      </div>

      <div className="video-shell">
        <video ref={videoRef} muted playsInline autoPlay className="camera-video" />
        {!hasCameraStarted ? (
          <button type="button" className="tap-to-start-overlay" onClick={onStartCamera}>
            <span>Tap to Start Camera</span>
            <small>Required on iPad/iPhone and safer for mobile browsers</small>
          </button>
        ) : null}
        {hasCameraStarted && isStarting ? (
          <div className="camera-loading-overlay">
            <div className="spinner" aria-hidden="true" />
            <span>Starting camera…</span>
          </div>
        ) : null}
        {hasCameraStarted && !isStarting && !isReady && !error ? <div className="status-badge">Waiting for camera…</div> : null}
        {error ? <div className="status-badge error">{error}</div> : null}
      </div>
      <p className="helper-text">Tip: on iPad/phone, install the web demo to the home screen and use the lens selector for front or rear camera.</p>
    </section>
  );
}
