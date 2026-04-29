import type { RefObject } from 'react';
import type { CameraDeviceOption } from '../types';

interface CameraPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: string | null;
  devices: CameraDeviceOption[];
  selectedDeviceId: string;
  facingMode: 'user' | 'environment';
  onDeviceChange: (deviceId: string) => void;
  onFacingModeChange: (mode: 'user' | 'environment') => void;
  onRefreshDevices: () => void;
}

export function CameraPanel({
  videoRef,
  isReady,
  error,
  devices,
  selectedDeviceId,
  facingMode,
  onDeviceChange,
  onFacingModeChange,
  onRefreshDevices
}: CameraPanelProps) {
  return (
    <section className="panel camera-panel">
      <div className="panel-row">
        <div>
          <h2>Live camera</h2>
          <p className="helper-text">Pick a webcam, frame the shot, then run the capture sequence.</p>
        </div>
        <button type="button" className="ghost-button" onClick={onRefreshDevices}>
          Refresh cameras
        </button>
      </div>

      <div className="settings-grid camera-source-grid">
        <label className="field-group">
          Camera source
          <select value={selectedDeviceId} onChange={(event) => onDeviceChange(event.target.value)}>
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
        <video ref={videoRef} muted autoPlay playsInline className="camera-video" />
        {!isReady && !error ? <div className="status-badge">Starting camera…</div> : null}
        {error ? <div className="status-badge error">{error}</div> : null}
      </div>
      <p className="helper-text">Tip: on iPad/phone, install the web demo to the home screen and use the lens selector for front or rear camera.</p>
    </section>
  );
}
