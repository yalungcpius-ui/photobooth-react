import { useEffect, useMemo, useRef, useState } from 'react';
import { CameraPanel } from './components/CameraPanel';
import { ControlPanel } from './components/ControlPanel';
import { CountdownOverlay } from './components/CountdownOverlay';
import { PhotoStrip } from './components/PhotoStrip';
import { PrintEditor } from './components/PrintEditor';
import { useCamera } from './hooks/useCamera';
import { useCountdown } from './hooks/useCountdown';
import type { BoothKioskSettings, BoothSettings, BoothStep, BoothTemplatePreset, CapturedPhoto, PrintEditElement, PrintFilter, SavedPrintedPicture } from './types';
import { captureFrame, downloadDataUrl } from './utils/capture';
import { composePhotoStrip, createDefaultTemplateLayout, normalizeBoothSettings } from './utils/strip';

const PRESET_STORAGE_KEY = 'photobooth-template-presets-v1';
const KIOSK_STORAGE_KEY = 'photobooth-kiosk-settings-v1';
const SAVED_PRINTS_STORAGE_KEY = 'photobooth-saved-prints-v1';

const defaultKioskSettings: BoothKioskSettings = {
  enabled: false,
  adminPin: '1234',
  idleResetSeconds: 30,
  autoReturnToCapture: true,
  allowGuestRetake: true
};

const defaultSettings: BoothSettings = {
  totalShots: 4,
  countdownSeconds: 3,
  stripTitle: 'Pius PhotoBooth',
  stripSubtitle: 'Custom event template',
  template: {
    backgroundImageDataUrl: null,
    backgroundSize: 'cover',
    backgroundOpacity: 0.22,
    stripBackgroundColor: '#fffaf3',
    textColor: '#171717',
    titleFontSize: 42,
    subtitleFontSize: 22,
    width: 900,
    frameHeight: 520,
    padding: 28,
    gap: 18,
    cornerRadius: 14,
    showHeader: true,
    showFooter: true,
    frameStyle: 'rounded',
    layout: createDefaultTemplateLayout(4)
  }
};

function App() {
  const [step, setStep] = useState<BoothStep>('welcome');
  const [settings, setSettings] = useState<BoothSettings>(() => normalizeBoothSettings(defaultSettings));
  const [presets, setPresets] = useState<BoothTemplatePreset[]>(() => readPresetsFromStorage());
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [kioskSettings, setKioskSettings] = useState<BoothKioskSettings>(() => readKioskSettingsFromStorage());
  const [isKioskMode, setIsKioskMode] = useState(() => readKioskSettingsFromStorage().enabled);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [savedPrints, setSavedPrints] = useState<SavedPrintedPicture[]>(() => readSavedPrintsFromStorage());
  const [editablePrintDataUrl, setEditablePrintDataUrl] = useState<string | null>(null);
  const [stripDataUrl, setStripDataUrl] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { isReady, error, devices, selectedDeviceId, facingMode, setSelectedDeviceId, setFacingMode, refreshDevices, startCamera } = useCamera(videoRef);
  const { countdown, startCountdown, clearCountdown } = useCountdown();

  useEffect(() => {
    void startCamera();
  }, [startCamera]);

  useEffect(() => {
    writePresetsToStorage(presets);
  }, [presets]);

  useEffect(() => {
    writeKioskSettingsToStorage(kioskSettings);
  }, [kioskSettings]);

  useEffect(() => {
    writeSavedPrintsToStorage(savedPrints);
  }, [savedPrints]);

  const shotsRemaining = useMemo(() => Math.max(settings.totalShots - photos.length, 0), [photos.length, settings.totalShots]);

  const resetSession = () => {
    clearCountdown();
    setPhotos([]);
    setStripDataUrl(null);
    setEditablePrintDataUrl(null);
    setStep('preview');
  };

  const updateSettings = (next: BoothSettings) => {
    setActivePresetId(null);
    setSettings(normalizeBoothSettings(next));
  };

  const resetTemplateDefaults = () => {
    setActivePresetId(null);
    setSettings(normalizeBoothSettings(defaultSettings));
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    const dataUrl = captureFrame(videoRef.current, canvasRef.current);
    setPhotos((current) => [
      ...current,
      {
        id: String(current.length + 1),
        dataUrl,
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const triggerCaptureSequence = () => {
    if (!isReady) {
      return;
    }
    setPhotos([]);
    setStripDataUrl(null);
    setEditablePrintDataUrl(null);
    setStep('countdown');
    startCountdown(settings.countdownSeconds);
  };

  useEffect(() => {
    if (step !== 'countdown') {
      return;
    }

    if (countdown === 0) {
      takePhoto();
      clearCountdown();
      const isSessionComplete = photos.length + 1 >= settings.totalShots;
      if (isSessionComplete) {
        setStep('review');
      } else {
        window.setTimeout(() => {
          startCountdown(settings.countdownSeconds);
        }, 750);
      }
    }
  }, [clearCountdown, countdown, photos.length, settings.countdownSeconds, settings.totalShots, startCountdown, step]);

  useEffect(() => {
    if (step === 'welcome' && isReady) {
      setStep('preview');
    }
  }, [isReady, step]);

  useEffect(() => {
    if (photos.length === 0) {
      setStripDataUrl(null);
      return;
    }

    let isCancelled = false;

    void composePhotoStrip(photos, {
      title: settings.stripTitle,
      subtitle: settings.stripSubtitle,
      template: settings.template
    }).then((dataUrl) => {
      if (!isCancelled) {
        setStripDataUrl(dataUrl);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [photos, settings]);

  useEffect(() => {
    if (!isKioskMode || !kioskSettings.autoReturnToCapture || step !== 'review') {
      return;
    }

    const timer = window.setTimeout(() => {
      resetSession();
    }, kioskSettings.idleResetSeconds * 1000);

    return () => window.clearTimeout(timer);
  }, [isKioskMode, kioskSettings.autoReturnToCapture, kioskSettings.idleResetSeconds, step]);

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    await startCamera(deviceId);
  };

  const handleRefreshDevices = async () => {
    await refreshDevices();
    await startCamera(selectedDeviceId);
  };

  const handleFacingModeChange = async (mode: 'user' | 'environment') => {
    setSelectedDeviceId('');
    setFacingMode(mode);
    await startCamera('', mode);
  };

  const handleTemplateImageUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setActivePresetId(null);
    setSettings((current) => normalizeBoothSettings({
      ...current,
      template: {
        ...current.template,
        backgroundImageDataUrl: dataUrl
      }
    }));
  };

  const clearTemplateImage = () => {
    setActivePresetId(null);
    setSettings((current) => normalizeBoothSettings({
      ...current,
      template: {
        ...current.template,
        backgroundImageDataUrl: null
      }
    }));
  };

  const savePreset = (name: string) => {
    const now = new Date().toISOString();
    setPresets((current) => {
      const existing = current.find((preset) => preset.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        const next = current.map((preset) =>
          preset.id === existing.id
            ? { ...preset, settings: normalizeBoothSettings(structuredClone(settings)), updatedAt: now, name }
            : preset
        );
        setActivePresetId(existing.id);
        return next;
      }

      const preset: BoothTemplatePreset = {
        id: createId(),
        name,
        settings: normalizeBoothSettings(structuredClone(settings)),
        createdAt: now,
        updatedAt: now
      };
      setActivePresetId(preset.id);
      return [preset, ...current].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  };

  const loadPreset = (presetId: string) => {
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }
    setActivePresetId(preset.id);
    setSettings(normalizeBoothSettings(structuredClone(preset.settings)));
  };

  const deletePreset = (presetId: string) => {
    setPresets((current) => current.filter((preset) => preset.id !== presetId));
    if (activePresetId === presetId) {
      setActivePresetId(null);
    }
  };

  const exportPreset = async (presetId: string) => {
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    const json = JSON.stringify(preset, null, 2);
    const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    await downloadDataUrl(dataUrl, `${sanitizeFileName(preset.name)}.json`);
  };

  const importPreset = async (file: File | null) => {
    if (!file) {
      return;
    }

    const json = await file.text();
    const parsed = JSON.parse(json) as Partial<BoothTemplatePreset>;
    if (!parsed.name || !parsed.settings) {
      throw new Error('Invalid preset file.');
    }

    const now = new Date().toISOString();
    const imported: BoothTemplatePreset = {
      id: createId(),
      name: `${parsed.name}`,
      settings: normalizeBoothSettings(parsed.settings as BoothSettings),
      createdAt: now,
      updatedAt: now
    };

    setPresets((current) => [imported, ...current].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setActivePresetId(imported.id);
    setSettings(normalizeBoothSettings(structuredClone(imported.settings)));
  };

  const downloadAll = async () => {
    for (let index = 0; index < photos.length; index += 1) {
      await downloadDataUrl(photos[index].dataUrl, `photobooth-shot-${index + 1}.png`);
    }
  };

  const downloadStrip = async () => {
    if (!stripDataUrl) {
      return;
    }
    await downloadDataUrl(stripDataUrl, 'photobooth-strip.png');
  };

  const updateKioskSettings = (next: BoothKioskSettings) => {
    setKioskSettings(next);
    if (!next.enabled && isKioskMode) {
      setIsKioskMode(false);
      void document.exitFullscreen?.();
    }
  };

  const enterKioskMode = async () => {
    const next = { ...kioskSettings, enabled: true };
    setKioskSettings(next);
    setIsKioskMode(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Browser/iPad Safari may require a direct user gesture or installed PWA mode.
    }
  };

  const exitKioskMode = () => {
    const enteredPin = window.prompt('Enter admin PIN to exit kiosk mode');
    if (enteredPin !== kioskSettings.adminPin) {
      return;
    }
    setKioskSettings((current) => ({ ...current, enabled: false }));
    setIsKioskMode(false);
    void document.exitFullscreen?.();
  };

  const printStrip = () => {
    if (!stripDataUrl || isPrinting) {
      return;
    }

    setIsPrinting(true);
    const popup = window.open('', '_blank', 'width=1100,height=900');
    if (!popup) {
      setIsPrinting(false);
      return;
    }

    popup.document.write(`<!doctype html>
<html>
  <head>
    <title>Print Photo Strip</title>
    <style>
      body { margin: 0; display: grid; place-items: center; min-height: 100vh; background: #f5f1ea; }
      img { max-width: 92vw; max-height: 96vh; object-fit: contain; }
      @media print {
        body { background: white; }
        img { max-width: 100%; max-height: none; width: 100%; }
      }
    </style>
  </head>
  <body>
    <img src="${stripDataUrl}" alt="Photo strip" />
    <script>
      window.onload = () => {
        window.print();
        setTimeout(() => window.close(), 300);
      };
    </script>
  </body>
</html>`);
    popup.document.close();
    setTimeout(() => setIsPrinting(false), 500);
  };

  const openPrintEditor = () => {
    if (!stripDataUrl) {
      return;
    }
    setEditablePrintDataUrl(stripDataUrl);
    setStep('edit-print');
  };

  const savePrintedPicture = (imageDataUrl: string, filter: PrintFilter = 'none', elements: PrintEditElement[] = []) => {
    const now = new Date().toISOString();
    setSavedPrints((current) => [
      {
        id: createId(),
        name: 'photobooth-print-' + (current.length + 1),
        imageDataUrl,
        baseImageDataUrl: editablePrintDataUrl ?? stripDataUrl ?? imageDataUrl,
        filter,
        elements: structuredClone(elements),
        createdAt: now
      },
      ...current
    ].slice(0, 30));
  };

  const saveCurrentPrint = () => {
    if (!stripDataUrl) {
      return;
    }
    savePrintedPicture(stripDataUrl);
  };

  const deleteSavedPrint = (id: string) => {
    setSavedPrints((current) => current.filter((print) => print.id !== id));
  };

  const loadSavedPrintForEditing = (print: SavedPrintedPicture) => {
    setEditablePrintDataUrl(print.baseImageDataUrl || print.imageDataUrl);
  };
  return (
    <main className={`app-shell ${isKioskMode ? 'kiosk-mode' : ''}`}>
      <header className="app-header">
        <div>
          <p className="eyebrow">React + Tauri starter</p>
          <h1>PhotoBooth</h1>
        </div>
        <div className="header-status">
          <span className={`pill ${isReady ? 'live' : ''}`}>{isReady ? 'Camera ready' : 'Camera starting'}</span>
          <span className="pill">{shotsRemaining} shots remaining</span>
          {isKioskMode ? (
            <button type="button" className="ghost-button admin-exit-button" onClick={exitKioskMode}>
              Admin unlock
            </button>
          ) : null}
        </div>
      </header>

      <section className="app-grid">
        <div className="left-column">
          <CameraPanel
            videoRef={videoRef}
            isReady={isReady}
            error={error}
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            facingMode={facingMode}
            onDeviceChange={handleDeviceChange}
            onFacingModeChange={handleFacingModeChange}
            onRefreshDevices={handleRefreshDevices}
          />
          <CountdownOverlay value={countdown} />
        </div>

        <div className="right-column">
          <ControlPanel
            step={step}
            shotsTaken={photos.length}
            settings={settings}
            presets={presets}
            activePresetId={activePresetId}
            onSettingsChange={updateSettings}
            onStartSession={triggerCaptureSequence}
            onRetake={resetSession}
            onDownloadAll={downloadAll}
            onDownloadStrip={downloadStrip}
            onPrintStrip={printStrip}
            onTemplateImageUpload={handleTemplateImageUpload}
            onClearTemplateImage={clearTemplateImage}
            onSavePreset={savePreset}
            onLoadPreset={loadPreset}
            onDeletePreset={deletePreset}
            onExportPreset={exportPreset}
            onImportPreset={(file) => {
              void importPreset(file);
            }}
            onResetTemplateDefaults={resetTemplateDefaults}
            kioskSettings={kioskSettings}
            isKioskMode={isKioskMode}
            onKioskSettingsChange={updateKioskSettings}
            onEnterKioskMode={enterKioskMode}
            onExitKioskMode={exitKioskMode}
          />
          {isKioskMode ? (
            <section className="panel kiosk-actions-panel">
              <button className="primary kiosk-start-button" onClick={triggerCaptureSequence} disabled={!isReady || step === 'countdown'}>
                {step === 'review' ? 'Take another set' : 'Tap to start'}
              </button>
              {kioskSettings.allowGuestRetake ? (
                <button onClick={resetSession} disabled={photos.length === 0 && step !== 'review'}>
                  Retake
                </button>
              ) : null}
            </section>
          ) : null}
          {stripDataUrl && step !== 'edit-print' ? (
            <section className="panel print-actions-panel">
              <div>
                <p className="eyebrow">Printed picture workflow</p>
                <h2>Save or edit this print</h2>
                <p className="helper-text">Save the final strip, or open the separate picture editor to add speech bubbles, emojis, icons and filters before printing.</p>
              </div>
              <div className="inline-actions wrap-actions">
                <button type="button" className="primary" onClick={openPrintEditor}>Edit printed picture</button>
                <button type="button" onClick={saveCurrentPrint}>Save printed picture</button>
              </div>
              <p className="helper-text">Saved prints: {savedPrints.length}</p>
            </section>
          ) : null}

          {step === 'edit-print' && editablePrintDataUrl ? (
            <PrintEditor
              baseImageDataUrl={editablePrintDataUrl}
              savedPrints={savedPrints}
              onSaveEditedPrint={savePrintedPicture}
              onClose={() => setStep('review')}
              onLoadSavedPrint={loadSavedPrintForEditing}
              onDeleteSavedPrint={deleteSavedPrint}
            />
          ) : (
            <PhotoStrip
              title={settings.stripTitle}
              subtitle={settings.stripSubtitle}
              stripDataUrl={stripDataUrl}
              count={photos.length}
              template={settings.template}
              photos={photos}
              totalShots={settings.totalShots}
              activePresetName={presets.find((preset) => preset.id === activePresetId)?.name ?? null}
              presetCount={presets.length}
              onTemplateChange={(nextTemplate) => {
                updateSettings({
                  ...settings,
                  template: nextTemplate
                });
              }}
            />
          )}
        </div>
      </section>

      <canvas ref={canvasRef} hidden />
    </main>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read template image file.'));
    reader.readAsDataURL(file);
  });
}

function readPresetsFromStorage(): BoothTemplatePreset[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as BoothTemplatePreset[];
    return Array.isArray(parsed)
      ? parsed.map((preset) => ({
          ...preset,
          settings: normalizeBoothSettings(preset.settings)
        }))
      : [];
  } catch {
    return [];
  }
}

function writePresetsToStorage(presets: BoothTemplatePreset[]) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

function readKioskSettingsFromStorage(): BoothKioskSettings {
  if (typeof window === 'undefined') {
    return defaultKioskSettings;
  }

  const raw = window.localStorage.getItem(KIOSK_STORAGE_KEY);
  if (!raw) {
    return defaultKioskSettings;
  }

  try {
    return normalizeKioskSettings(JSON.parse(raw) as Partial<BoothKioskSettings>);
  } catch {
    return defaultKioskSettings;
  }
}

function writeKioskSettingsToStorage(settings: BoothKioskSettings) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(KIOSK_STORAGE_KEY, JSON.stringify(normalizeKioskSettings(settings)));
}

function normalizeKioskSettings(settings: Partial<BoothKioskSettings>): BoothKioskSettings {
  return {
    enabled: Boolean(settings.enabled),
    adminPin: String(settings.adminPin || defaultKioskSettings.adminPin).slice(0, 12),
    idleResetSeconds: Math.max(10, Math.min(300, Number(settings.idleResetSeconds) || defaultKioskSettings.idleResetSeconds)),
    autoReturnToCapture: settings.autoReturnToCapture ?? defaultKioskSettings.autoReturnToCapture,
    allowGuestRetake: settings.allowGuestRetake ?? defaultKioskSettings.allowGuestRetake
  };
}

function readSavedPrintsFromStorage(): SavedPrintedPicture[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const raw = window.localStorage.getItem(SAVED_PRINTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as SavedPrintedPicture[];
    return Array.isArray(parsed) ? parsed.filter((print) => print?.imageDataUrl && print?.id).slice(0, 30) : [];
  } catch {
    return [];
  }
}

function writeSavedPrintsToStorage(prints: SavedPrintedPicture[]) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SAVED_PRINTS_STORAGE_KEY, JSON.stringify(prints.slice(0, 30)));
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'photobooth-preset';
}

function createId() {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default App;
