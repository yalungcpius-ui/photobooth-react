import { useEffect, useMemo, useRef, useState } from 'react';
import { CameraPanel } from './components/CameraPanel';
import { ControlPanel } from './components/ControlPanel';
import { CountdownOverlay } from './components/CountdownOverlay';
import { PhotoStrip } from './components/PhotoStrip';
import { PrintEditor } from './components/PrintEditor';
import { AdminIntegrationsPanel } from './components/AdminIntegrationsPanel';
import { GalleryHistory } from './components/GalleryHistory';
import { useCamera } from './hooks/useCamera';
import { useCountdown } from './hooks/useCountdown';
import type { AppMode, BoothKioskSettings, BoothSettings, BoothStep, BoothTemplatePreset, CapturedPhoto, PrintEditElement, PrintFilter, SavedPrintedPicture, PrinterProfile, DslrSettings, CloudSyncSettings } from './types';
import { captureFrame, downloadDataUrl } from './utils/capture';
import { composePhotoStrip, createDefaultTemplateLayout, normalizeBoothSettings } from './utils/strip';
import { browserPrint, silentPrint } from './services';

const PRESET_STORAGE_KEY = 'photobooth-template-presets-v1';
const KIOSK_STORAGE_KEY = 'photobooth-kiosk-settings-v1';
const SAVED_PRINTS_STORAGE_KEY = 'photobooth-saved-prints-v1';
const PRINTER_PROFILES_STORAGE_KEY = 'photobooth-printer-profiles-v1';
const SELECTED_PRINTER_PROFILE_KEY = 'photobooth-selected-printer-profile-v1';
const DSLR_STORAGE_KEY = 'photobooth-dslr-settings-v1';
const CLOUD_SYNC_STORAGE_KEY = 'photobooth-cloud-sync-settings-v1';

const defaultPrinterProfile: PrinterProfile = {
  id: 'default-printer',
  name: 'Default browser printer',
  printerName: '',
  paperSize: '4x6',
  orientation: 'portrait',
  copies: 1,
  silentPrinting: false,
  autoSaveBeforePrint: true
};
const defaultDslrSettings: DslrSettings = { enabled: false, provider: 'none', cameraName: '', watchFolder: '', autoImportLatest: false };
const defaultCloudSyncSettings: CloudSyncSettings = { enabled: false, endpointUrl: '', apiKey: '', deviceId: 'booth-local', autoSyncPresets: false, enablePrintUpload: false };

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
  printDecisionMode: 'ask',
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
  const [appMode, setAppMode] = useState<AppMode>('configuration');
  const [step, setStep] = useState<BoothStep>('welcome');
  const [settings, setSettings] = useState<BoothSettings>(() => normalizeBoothSettings(defaultSettings));
  const [presets, setPresets] = useState<BoothTemplatePreset[]>(() => readPresetsFromStorage());
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [kioskSettings, setKioskSettings] = useState<BoothKioskSettings>(() => readKioskSettingsFromStorage());
  const [isKioskMode, setIsKioskMode] = useState(() => readKioskSettingsFromStorage().enabled);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [savedPrints, setSavedPrints] = useState<SavedPrintedPicture[]>(() => readSavedPrintsFromStorage());
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>(() => readPrinterProfilesFromStorage());
  const [selectedPrinterProfileId, setSelectedPrinterProfileId] = useState<string | null>(() => window.localStorage.getItem(SELECTED_PRINTER_PROFILE_KEY) || defaultPrinterProfile.id);
  const [dslrSettings, setDslrSettings] = useState<DslrSettings>(() => readDslrSettingsFromStorage());
  const [cloudSyncSettings, setCloudSyncSettings] = useState<CloudSyncSettings>(() => readCloudSyncSettingsFromStorage());
  const [editablePrintDataUrl, setEditablePrintDataUrl] = useState<string | null>(null);
  const [stripDataUrl, setStripDataUrl] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [hasCameraStarted, setHasCameraStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { isReady, isStarting, error, devices, selectedDeviceId, facingMode, setSelectedDeviceId, setFacingMode, refreshDevices, startCamera } = useCamera(videoRef);
  const { countdown, startCountdown, clearCountdown } = useCountdown();


  useEffect(() => {
    writePresetsToStorage(presets);
  }, [presets]);

  useEffect(() => {
    writeKioskSettingsToStorage(kioskSettings);
  }, [kioskSettings]);

  useEffect(() => {
    writeSavedPrintsToStorage(savedPrints);
  }, [savedPrints]);
  useEffect(() => { writePrinterProfilesToStorage(printerProfiles); }, [printerProfiles]);
  useEffect(() => { if (selectedPrinterProfileId) window.localStorage.setItem(SELECTED_PRINTER_PROFILE_KEY, selectedPrinterProfileId); }, [selectedPrinterProfileId]);
  useEffect(() => { writeDslrSettingsToStorage(dslrSettings); }, [dslrSettings]);
  useEffect(() => { writeCloudSyncSettingsToStorage(cloudSyncSettings); }, [cloudSyncSettings]);

  const shotsRemaining = useMemo(() => Math.max(settings.totalShots - photos.length, 0), [photos.length, settings.totalShots]);

  const resetSession = () => {
    clearCountdown();
    setPhotos([]);
    setStripDataUrl(null);
    setEditablePrintDataUrl(null);
    setStep('preview');
    setAppMode('photobooth');
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
    setAppMode('photobooth');
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
    if (step === 'review' && stripDataUrl && appMode === 'photobooth') {
      setEditablePrintDataUrl(stripDataUrl);
      setStep('edit-print');
    }
  }, [appMode, step, stripDataUrl]);

  useEffect(() => {
    if (!isKioskMode || !kioskSettings.autoReturnToCapture || step !== 'review') {
      return;
    }

    const timer = window.setTimeout(() => {
      resetSession();
    }, kioskSettings.idleResetSeconds * 1000);

    return () => window.clearTimeout(timer);
  }, [isKioskMode, kioskSettings.autoReturnToCapture, kioskSettings.idleResetSeconds, step]);

  const handleStartCamera = async () => {
    setHasCameraStarted(true);
    await startCamera(selectedDeviceId, facingMode);
  };

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (hasCameraStarted) {
      await startCamera(deviceId, facingMode);
    }
  };

  const handleRefreshDevices = async () => {
    await refreshDevices();
    if (hasCameraStarted) {
      await startCamera(selectedDeviceId, facingMode);
    }
  };

  const handleFacingModeChange = async (mode: 'user' | 'environment') => {
    setSelectedDeviceId('');
    setFacingMode(mode);
    if (hasCameraStarted) {
      await startCamera('', mode);
    }
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
    if (!stripDataUrl || isPrinting) return;
    const profile = printerProfiles.find((entry) => entry.id === selectedPrinterProfileId) ?? printerProfiles[0] ?? defaultPrinterProfile;
    if (profile.autoSaveBeforePrint) savePrintedPicture(stripDataUrl);
    setIsPrinting(true);
    void silentPrint(stripDataUrl, profile)
      .catch(() => browserPrint(stripDataUrl, profile.name))
      .finally(() => setIsPrinting(false));
  };

  const openPrintEditor = () => {
    if (!stripDataUrl) {
      return;
    }
    setEditablePrintDataUrl(stripDataUrl);
    setStep('edit-print');
    setAppMode('photobooth');
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

    if (settings.printDecisionMode === 'auto') {
      const profile = printerProfiles.find((entry) => entry.id === selectedPrinterProfileId) ?? printerProfiles[0] ?? defaultPrinterProfile;
      setIsPrinting(true);
      void silentPrint(imageDataUrl, profile)
        .catch(() => browserPrint(imageDataUrl, profile.name))
        .finally(() => setIsPrinting(false));
    }
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
    setStep('edit-print');
    setAppMode('photobooth');
  };

  const importPresetLibrary = (incoming: BoothTemplatePreset[]) => {
    setPresets((current) => {
      const byName = new Map(current.map((preset) => [preset.name.toLowerCase(), preset]));
      for (const preset of incoming) byName.set(preset.name.toLowerCase(), { ...preset, id: preset.id || createId(), settings: normalizeBoothSettings(preset.settings), updatedAt: preset.updatedAt || new Date().toISOString(), createdAt: preset.createdAt || new Date().toISOString() });
      return Array.from(byName.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  };
  return (
    <main className={`app-shell segmented-flow ${isKioskMode ? 'kiosk-mode' : ''}`}>
      <header className="app-header">
        <div>
          <p className="eyebrow">React + Tauri starter</p>
          <h1>PhotoBooth</h1>
          <p className="helper-text">Setup first, design next, then run the booth. Guests only decorate the finished print.</p>
        </div>
        <div className="header-status">
          {appMode === 'photobooth' ? <span className={`pill ${isReady ? 'live' : ''}`}>{isReady ? 'Camera ready' : hasCameraStarted ? 'Camera starting' : 'Camera off'}</span> : null}
          <span className="pill">{shotsRemaining} shots remaining</span>
          {isKioskMode ? (
            <button type="button" className="ghost-button admin-exit-button" onClick={exitKioskMode}>Admin unlock</button>
          ) : null}
        </div>
      </header>

      <nav className="workflow-tabs" aria-label="PhotoBooth workflow">
        <button type="button" className={appMode === 'configuration' ? 'active' : ''} onClick={() => setAppMode('configuration')}>1. Configuration</button>
        <button type="button" className={appMode === 'designer' ? 'active' : ''} onClick={() => setAppMode('designer')}>2. Designer</button>
        <button type="button" className={appMode === 'photobooth' ? 'active' : ''} onClick={() => setAppMode('photobooth')}>3. Photobooth mode</button>
      </nav>

      {appMode === 'configuration' ? (
        <section className="workflow-screen two-column-screen">
          <div className="left-column">
            <section className="panel flow-intro-panel">
              <p className="eyebrow">Step 1</p>
              <h2>Setup or load a configuration</h2>
              <p className="helper-text">Choose the preset, session count, countdown, kiosk options, printer behaviour and integrations before designing or testing the booth.</p>
              <div className="flow-next-actions">
                <button type="button" className="primary" onClick={() => setAppMode('designer')}>Continue to designer</button>
                <button type="button" onClick={() => setAppMode('photobooth')}>Skip to photobooth test</button>
              </div>
            </section>
            <GalleryHistory savedPrints={savedPrints} cloudSyncSettings={cloudSyncSettings} onEdit={loadSavedPrintForEditing} onDelete={deleteSavedPrint} />
          </div>
          <div className="right-column">
            <ControlPanel
              mode="configuration"
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
              onImportPreset={(file) => { void importPreset(file); }}
              onResetTemplateDefaults={resetTemplateDefaults}
              kioskSettings={kioskSettings}
              isKioskMode={isKioskMode}
              onKioskSettingsChange={updateKioskSettings}
              onEnterKioskMode={enterKioskMode}
              onExitKioskMode={exitKioskMode}
            />
            <AdminIntegrationsPanel
              printerProfiles={printerProfiles}
              selectedPrinterProfileId={selectedPrinterProfileId}
              dslrSettings={dslrSettings}
              cloudSyncSettings={cloudSyncSettings}
              presets={presets}
              onPrinterProfilesChange={setPrinterProfiles}
              onSelectedPrinterProfileChange={setSelectedPrinterProfileId}
              onDslrSettingsChange={setDslrSettings}
              onCloudSyncSettingsChange={setCloudSyncSettings}
              onImportPresets={importPresetLibrary}
            />
          </div>
        </section>
      ) : null}

      {appMode === 'designer' ? (
        <section className="workflow-screen two-column-screen designer-screen">
          <div className="left-column designer-preview-column">
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
              onTemplateChange={(nextTemplate) => updateSettings({ ...settings, template: nextTemplate })}
            />
          </div>
          <div className="right-column">
            <section className="panel flow-intro-panel">
              <p className="eyebrow">Step 2</p>
              <h2>Design the template layout</h2>
              <p className="helper-text">This is the only screen where layout can be changed. Move photo slots, resize frames, add brand elements and save the design as a preset.</p>
              <div className="flow-next-actions">
                <button type="button" className="primary" onClick={() => setAppMode('photobooth')}>Start photobooth test</button>
                <button type="button" onClick={() => setAppMode('configuration')}>Back to configuration</button>
              </div>
            </section>
            <ControlPanel
              mode="designer"
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
              onImportPreset={(file) => { void importPreset(file); }}
              onResetTemplateDefaults={resetTemplateDefaults}
              kioskSettings={kioskSettings}
              isKioskMode={isKioskMode}
              onKioskSettingsChange={updateKioskSettings}
              onEnterKioskMode={enterKioskMode}
              onExitKioskMode={exitKioskMode}
            />
          </div>
        </section>
      ) : null}

      {appMode === 'photobooth' ? (
        <section className="workflow-screen two-column-screen booth-screen">
          <div className="left-column">
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
              <>
                <CameraPanel
                  videoRef={videoRef}
                  isReady={isReady}
                  isStarting={isStarting}
                  hasCameraStarted={hasCameraStarted}
                  error={error}
                  devices={devices}
                  selectedDeviceId={selectedDeviceId}
                  facingMode={facingMode}
                  onStartCamera={handleStartCamera}
                  onDeviceChange={handleDeviceChange}
                  onFacingModeChange={handleFacingModeChange}
                  onRefreshDevices={handleRefreshDevices}
                />
                <CountdownOverlay value={countdown} />
              </>
            )}
          </div>

          <div className="right-column">
            <section className="panel flow-intro-panel">
              <p className="eyebrow">Step 3</p>
              <h2>{step === 'edit-print' ? 'Decorate the finished print' : 'Photobooth mode'}</h2>
              <p className="helper-text">
                {step === 'edit-print'
                  ? 'The template layout is locked here. Guests can only add text, bubbles, emojis, icons and filters to the finished print.'
                  : 'Test the booth with the selected configuration and template. After capture, the app opens the decoration screen automatically.'}
              </p>
              <div className="flow-next-actions">
                <button className="primary" onClick={triggerCaptureSequence} disabled={!isReady || step === 'countdown'}>{step === 'edit-print' || step === 'review' ? 'Take another set' : 'Start capture'}</button>
                <button onClick={resetSession} disabled={photos.length === 0 && step !== 'review' && step !== 'edit-print'}>Reset session</button>
                <button type="button" onClick={() => setAppMode('designer')}>Back to layout designer</button>
              </div>
            </section>

            {stripDataUrl ? (
              <section className="panel print-actions-panel">
                <div>
                  <p className="eyebrow">Print decision</p>
                  <h2>{settings.printDecisionMode === 'auto' ? 'Auto-print is enabled' : 'Ask before printing'}</h2>
                  <p className="helper-text">Printing behaviour is configured on the Configuration screen. The finished print is saved before printing when the selected printer profile requires it.</p>
                </div>
                <div className="inline-actions wrap-actions">
                  <button type="button" className="primary" onClick={openPrintEditor}>Decorate print</button>
                  <button type="button" onClick={saveCurrentPrint}>Save printed picture</button>
                  <button type="button" onClick={printStrip} disabled={isPrinting}>{isPrinting ? 'Printing...' : 'Print now'}</button>
                  <button type="button" onClick={downloadStrip}>Download strip</button>
                </div>
              </section>
            ) : null}

            {step !== 'edit-print' ? (
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
                onTemplateChange={() => { /* Layout editing is intentionally disabled in photobooth mode. */ }}
              />
            ) : null}
          </div>
        </section>
      ) : null}

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

function readPrinterProfilesFromStorage(): PrinterProfile[] {
  const raw = window.localStorage.getItem(PRINTER_PROFILES_STORAGE_KEY);
  if (!raw) return [defaultPrinterProfile];
  try { const parsed = JSON.parse(raw) as PrinterProfile[]; return Array.isArray(parsed) && parsed.length ? parsed : [defaultPrinterProfile]; } catch { return [defaultPrinterProfile]; }
}
function writePrinterProfilesToStorage(profiles: PrinterProfile[]) { window.localStorage.setItem(PRINTER_PROFILES_STORAGE_KEY, JSON.stringify(profiles.length ? profiles : [defaultPrinterProfile])); }
function readDslrSettingsFromStorage(): DslrSettings { const raw = window.localStorage.getItem(DSLR_STORAGE_KEY); if (!raw) return defaultDslrSettings; try { return { ...defaultDslrSettings, ...JSON.parse(raw) as Partial<DslrSettings> }; } catch { return defaultDslrSettings; } }
function writeDslrSettingsToStorage(settings: DslrSettings) { window.localStorage.setItem(DSLR_STORAGE_KEY, JSON.stringify(settings)); }
function readCloudSyncSettingsFromStorage(): CloudSyncSettings { const raw = window.localStorage.getItem(CLOUD_SYNC_STORAGE_KEY); if (!raw) return defaultCloudSyncSettings; try { return { ...defaultCloudSyncSettings, ...JSON.parse(raw) as Partial<CloudSyncSettings> }; } catch { return defaultCloudSyncSettings; } }
function writeCloudSyncSettingsToStorage(settings: CloudSyncSettings) { window.localStorage.setItem(CLOUD_SYNC_STORAGE_KEY, JSON.stringify(settings)); }

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
