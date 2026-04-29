import { useMemo, useState } from 'react';
import type { BoothTemplatePreset, CloudSyncSettings, DslrSettings, PrinterProfile } from '../types';
import { connectDslr, downloadPresetLibrary, loadAdminStateFromFile, persistAdminStateToFile, uploadPresetLibrary } from '../services';

interface Props {
  printerProfiles: PrinterProfile[];
  selectedPrinterProfileId: string | null;
  dslrSettings: DslrSettings;
  cloudSyncSettings: CloudSyncSettings;
  presets: BoothTemplatePreset[];
  onPrinterProfilesChange: (profiles: PrinterProfile[]) => void;
  onSelectedPrinterProfileChange: (id: string | null) => void;
  onDslrSettingsChange: (settings: DslrSettings) => void;
  onCloudSyncSettingsChange: (settings: CloudSyncSettings) => void;
  onImportPresets: (presets: BoothTemplatePreset[]) => void;
}

export function AdminIntegrationsPanel({
  printerProfiles,
  selectedPrinterProfileId,
  dslrSettings,
  cloudSyncSettings,
  presets,
  onPrinterProfilesChange,
  onSelectedPrinterProfileChange,
  onDslrSettingsChange,
  onCloudSyncSettingsChange,
  onImportPresets
}: Props) {
  const [status, setStatus] = useState('');
  const selectedProfile = useMemo(() => printerProfiles.find((profile) => profile.id === selectedPrinterProfileId) ?? printerProfiles[0], [printerProfiles, selectedPrinterProfileId]);

  const updateSelectedProfile = (updates: Partial<PrinterProfile>) => {
    if (!selectedProfile) return;
    onPrinterProfilesChange(printerProfiles.map((profile) => (profile.id === selectedProfile.id ? { ...profile, ...updates } : profile)));
  };

  const addProfile = () => {
    const profile: PrinterProfile = {
      id: `printer-${Date.now()}`,
      name: `Printer profile ${printerProfiles.length + 1}`,
      printerName: '',
      paperSize: '4x6',
      copies: 1,
      silentPrinting: false,
      autoSaveBeforePrint: true
    };
    onPrinterProfilesChange([...printerProfiles, profile]);
    onSelectedPrinterProfileChange(profile.id);
  };

  const removeProfile = () => {
    if (!selectedProfile) return;
    const next = printerProfiles.filter((profile) => profile.id !== selectedProfile.id);
    onPrinterProfilesChange(next);
    onSelectedPrinterProfileChange(next[0]?.id ?? null);
  };

  const saveAdminFile = async () => {
    const result = await persistAdminStateToFile({
      printerProfiles,
      selectedPrinterProfileId,
      dslrSettings,
      cloudSyncSettings,
      presets,
      updatedAt: new Date().toISOString()
    });
    setStatus(result);
  };

  const loadAdminFile = async () => {
    const state = await loadAdminStateFromFile();
    if (!state) {
      setStatus('No saved admin state found.');
      return;
    }
    onPrinterProfilesChange(state.printerProfiles ?? printerProfiles);
    onSelectedPrinterProfileChange(state.selectedPrinterProfileId ?? null);
    onDslrSettingsChange(state.dslrSettings ?? dslrSettings);
    onCloudSyncSettingsChange(state.cloudSyncSettings ?? cloudSyncSettings);
    if (state.presets?.length) onImportPresets(state.presets);
    setStatus('Admin settings loaded from persistent storage.');
  };

  return (
    <section className="panel admin-integrations-panel">
      <div className="panel-row">
        <div>
          <p className="eyebrow">Admin integrations</p>
          <h2>Printing, DSLR, persistence & cloud sync</h2>
          <p className="helper-text">These settings run in browser/PWA with safe fallbacks, and unlock native behaviour in the Windows Tauri app.</p>
        </div>
        <div className="inline-actions wrap-actions">
          <button type="button" onClick={() => void saveAdminFile()}>Save admin file</button>
          <button type="button" onClick={() => void loadAdminFile()}>Load admin file</button>
        </div>
      </div>

      <div className="integration-grid">
        <div className="integration-card">
          <h3>Printer profiles</h3>
          <label className="field-group">Profile<select value={selectedProfile?.id ?? ''} onChange={(event) => onSelectedPrinterProfileChange(event.target.value)}>{printerProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
          {selectedProfile ? <>
            <label className="field-group">Profile name<input value={selectedProfile.name} onChange={(event) => updateSelectedProfile({ name: event.target.value })} /></label>
            <label className="field-group">Windows printer name<input placeholder="Exact printer name" value={selectedProfile.printerName} onChange={(event) => updateSelectedProfile({ printerName: event.target.value })} /></label>
            <div className="settings-grid three-columns">
              <label className="field-group">Paper<select value={selectedProfile.paperSize} onChange={(event) => updateSelectedProfile({ paperSize: event.target.value as PrinterProfile['paperSize'] })}><option value="4x6">4x6</option><option value="5x7">5x7</option><option value="6x4-strip">6x4 strip</option><option value="custom">Custom</option></select></label>
              <label className="field-group">Copies<input type="number" min={1} max={10} value={selectedProfile.copies} onChange={(event) => updateSelectedProfile({ copies: Math.max(1, Number(event.target.value) || 1) })} /></label>
              <label className="field-group checkbox-row"><input type="checkbox" checked={selectedProfile.silentPrinting} onChange={(event) => updateSelectedProfile({ silentPrinting: event.target.checked })} />Silent</label>
            </div>
            <label className="field-group checkbox-row"><input type="checkbox" checked={selectedProfile.autoSaveBeforePrint} onChange={(event) => updateSelectedProfile({ autoSaveBeforePrint: event.target.checked })} />Auto-save before printing</label>
          </> : null}
          <div className="inline-actions wrap-actions"><button type="button" onClick={addProfile}>Add profile</button><button type="button" onClick={removeProfile} disabled={!selectedProfile || printerProfiles.length <= 1}>Delete profile</button></div>
        </div>

        <div className="integration-card">
          <h3>DSLR integration</h3>
          <label className="field-group checkbox-row"><input type="checkbox" checked={dslrSettings.enabled} onChange={(event) => onDslrSettingsChange({ ...dslrSettings, enabled: event.target.checked })} />Enable DSLR mode</label>
          <label className="field-group">Provider<select value={dslrSettings.provider} onChange={(event) => onDslrSettingsChange({ ...dslrSettings, provider: event.target.value as DslrSettings['provider'] })}><option value="none">None</option><option value="watch-folder">Watch folder import</option><option value="gphoto2">gPhoto2 adapter</option><option value="canon-edsk">Canon EDSDK adapter</option><option value="sony-sdk">Sony SDK adapter</option></select></label>
          <label className="field-group">Camera name<input value={dslrSettings.cameraName} onChange={(event) => onDslrSettingsChange({ ...dslrSettings, cameraName: event.target.value })} /></label>
          <label className="field-group">Watch/import folder<input value={dslrSettings.watchFolder} onChange={(event) => onDslrSettingsChange({ ...dslrSettings, watchFolder: event.target.value })} /></label>
          <label className="field-group checkbox-row"><input type="checkbox" checked={dslrSettings.autoImportLatest} onChange={(event) => onDslrSettingsChange({ ...dslrSettings, autoImportLatest: event.target.checked })} />Auto-import newest DSLR file</label>
          <button type="button" onClick={() => void connectDslr(dslrSettings).then(setStatus).catch((error) => setStatus(String(error)))}>Test DSLR adapter</button>
        </div>

        <div className="integration-card">
          <h3>Cloud sync</h3>
          <label className="field-group checkbox-row"><input type="checkbox" checked={cloudSyncSettings.enabled} onChange={(event) => onCloudSyncSettingsChange({ ...cloudSyncSettings, enabled: event.target.checked })} />Enable cloud sync</label>
          <label className="field-group">Endpoint URL<input placeholder="https://your-api.example.com" value={cloudSyncSettings.endpointUrl} onChange={(event) => onCloudSyncSettingsChange({ ...cloudSyncSettings, endpointUrl: event.target.value })} /></label>
          <label className="field-group">API key<input type="password" value={cloudSyncSettings.apiKey} onChange={(event) => onCloudSyncSettingsChange({ ...cloudSyncSettings, apiKey: event.target.value })} /></label>
          <label className="field-group">Device ID<input value={cloudSyncSettings.deviceId} onChange={(event) => onCloudSyncSettingsChange({ ...cloudSyncSettings, deviceId: event.target.value })} /></label>
          <div className="settings-grid">
            <label className="field-group checkbox-row"><input type="checkbox" checked={cloudSyncSettings.autoSyncPresets} onChange={(event) => onCloudSyncSettingsChange({ ...cloudSyncSettings, autoSyncPresets: event.target.checked })} />Auto-sync presets</label>
            <label className="field-group checkbox-row"><input type="checkbox" checked={cloudSyncSettings.enablePrintUpload} onChange={(event) => onCloudSyncSettingsChange({ ...cloudSyncSettings, enablePrintUpload: event.target.checked })} />Upload prints for QR sharing</label>
          </div>
          <div className="inline-actions wrap-actions"><button type="button" onClick={() => void uploadPresetLibrary(cloudSyncSettings, presets).then(setStatus).catch((e) => setStatus(String(e)))}>Upload presets</button><button type="button" onClick={() => void downloadPresetLibrary(cloudSyncSettings).then((items) => { onImportPresets(items); setStatus(`Downloaded ${items.length} presets.`); }).catch((e) => setStatus(String(e)))}>Download presets</button></div>
        </div>
      </div>
      {status ? <p className="status-note">{status}</p> : null}
    </section>
  );
}
