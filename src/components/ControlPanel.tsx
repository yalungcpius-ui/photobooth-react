import { useMemo, useState } from 'react';
import type { BoothKioskSettings, BoothSettings, BoothStep, BoothTemplatePreset } from '../types';

interface ControlPanelProps {
  mode: 'configuration' | 'designer';
  step: BoothStep;
  shotsTaken: number;
  settings: BoothSettings;
  presets: BoothTemplatePreset[];
  activePresetId: string | null;
  onSettingsChange: (next: BoothSettings) => void;
  onStartSession: () => void;
  onRetake: () => void;
  onDownloadAll: () => void;
  onDownloadStrip: () => void;
  onPrintStrip: () => void;
  onTemplateImageUpload: (file: File | null) => void;
  onClearTemplateImage: () => void;
  onSavePreset: (name: string) => void;
  onLoadPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onExportPreset: (presetId: string) => void;
  onImportPreset: (file: File | null) => void;
  onResetTemplateDefaults: () => void;
  kioskSettings: BoothKioskSettings;
  isKioskMode: boolean;
  onKioskSettingsChange: (next: BoothKioskSettings) => void;
  onEnterKioskMode: () => void;
  onExitKioskMode: () => void;
}

export function ControlPanel({
  mode,
  step,
  shotsTaken,
  settings,
  presets,
  activePresetId,
  onSettingsChange,
  onTemplateImageUpload,
  onClearTemplateImage,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onExportPreset,
  onImportPreset,
  onResetTemplateDefaults,
  kioskSettings,
  isKioskMode,
  onKioskSettingsChange,
  onEnterKioskMode,
  onExitKioskMode
}: ControlPanelProps) {
  const disableSettings = step === 'countdown';
  const { template } = settings;
  const [presetName, setPresetName] = useState('');

  const selectedPresetId = useMemo(() => {
    if (activePresetId && presets.some((preset) => preset.id === activePresetId)) {
      return activePresetId;
    }
    return presets[0]?.id ?? '';
  }, [activePresetId, presets]);

  const updateTemplate = <K extends keyof typeof template>(key: K, value: (typeof template)[K]) => {
    onSettingsChange({ ...settings, template: { ...template, [key]: value } });
  };

  const updateKiosk = <K extends keyof BoothKioskSettings>(key: K, value: BoothKioskSettings[K]) => {
    onKioskSettingsChange({ ...kioskSettings, [key]: value });
  };

  if (mode === 'designer') {
    return (
      <section className="panel controls-panel">
        <h2>Template designer controls</h2>
        <p className="helper-text">Use this screen for template layout, branding, colours and reusable preset design. Guests will not see these controls in photobooth mode.</p>

        <div className="section-divider"><h3>Preset design</h3></div>
        <div className="field-group">
          <label htmlFor="preset-name">Preset name</label>
          <div className="input-with-action">
            <input id="preset-name" value={presetName} disabled={disableSettings} placeholder="Birthday, wedding, expo booth..." onChange={(event) => setPresetName(event.target.value)} />
            <button type="button" className="primary" disabled={disableSettings || presetName.trim().length === 0} onClick={() => { onSavePreset(presetName.trim()); setPresetName(''); }}>Save</button>
          </div>
        </div>
        <div className="inline-actions wrap-actions">
          <button type="button" onClick={onResetTemplateDefaults} disabled={disableSettings}>Reset default design</button>
          <button type="button" onClick={() => onExportPreset(selectedPresetId)} disabled={!selectedPresetId}>Export preset</button>
        </div>

        <div className="section-divider"><h3>Template background</h3></div>
        <label className="field-group">Template background image<input type="file" accept="image/*" disabled={disableSettings} onChange={(event) => onTemplateImageUpload(event.target.files?.[0] ?? null)} /></label>
        <div className="inline-actions wrap-actions"><button type="button" onClick={onClearTemplateImage} disabled={disableSettings || !template.backgroundImageDataUrl}>Remove background image</button></div>

        <div className="settings-grid three-columns">
          <label className="field-group">Strip width<input type="number" min={500} max={1600} value={template.width} disabled={disableSettings} onChange={(event) => updateTemplate('width', Math.max(500, Math.min(1600, Number(event.target.value) || 900)))} /></label>
          <label className="field-group">Frame height<input type="number" min={180} max={700} value={template.frameHeight} disabled={disableSettings} onChange={(event) => updateTemplate('frameHeight', Math.max(180, Math.min(700, Number(event.target.value) || 420)))} /></label>
          <label className="field-group">Spacing gap<input type="number" min={0} max={80} value={template.gap} disabled={disableSettings} onChange={(event) => updateTemplate('gap', Math.max(0, Math.min(80, Number(event.target.value) || 0)))} /></label>
        </div>

        <div className="settings-grid three-columns">
          <label className="field-group">Outer padding<input type="number" min={0} max={80} value={template.padding} disabled={disableSettings} onChange={(event) => updateTemplate('padding', Math.max(0, Math.min(80, Number(event.target.value) || 0)))} /></label>
          <label className="field-group">Corner radius<input type="number" min={0} max={50} value={template.cornerRadius} disabled={disableSettings} onChange={(event) => updateTemplate('cornerRadius', Math.max(0, Math.min(50, Number(event.target.value) || 0)))} /></label>
          <label className="field-group">Background opacity<input type="number" min={0} max={1} step={0.05} value={template.backgroundOpacity} disabled={disableSettings} onChange={(event) => updateTemplate('backgroundOpacity', Math.max(0, Math.min(1, Number(event.target.value) || 0)))} /></label>
        </div>

        <div className="settings-grid three-columns">
          <label className="field-group">Strip background<input type="color" value={template.stripBackgroundColor} disabled={disableSettings} onChange={(event) => updateTemplate('stripBackgroundColor', event.target.value)} /></label>
          <label className="field-group">Text color<input type="color" value={template.textColor} disabled={disableSettings} onChange={(event) => updateTemplate('textColor', event.target.value)} /></label>
          <label className="field-group">Background fit<select value={template.backgroundSize} disabled={disableSettings} onChange={(event) => updateTemplate('backgroundSize', event.target.value as typeof template.backgroundSize)}><option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">Stretch</option></select></label>
        </div>

        <div className="settings-grid three-columns">
          <label className="field-group checkbox-row"><input type="checkbox" checked={template.showHeader} disabled={disableSettings} onChange={(event) => updateTemplate('showHeader', event.target.checked)} />Show header</label>
          <label className="field-group checkbox-row"><input type="checkbox" checked={template.showFooter} disabled={disableSettings} onChange={(event) => updateTemplate('showFooter', event.target.checked)} />Show footer</label>
          <label className="field-group">Frame shape<select value={template.frameStyle} disabled={disableSettings} onChange={(event) => updateTemplate('frameStyle', event.target.value as typeof template.frameStyle)}><option value="rounded">Rounded</option><option value="square">Square</option></select></label>
        </div>
      </section>
    );
  }

  return (
    <section className="panel controls-panel">
      <h2>Configuration</h2>
      <p className="helper-text">Load or set the booth behaviour first. Use the Designer tab afterwards to change layout.</p>
      <div className="stats-row">
        <div><span className="label">Mode</span><strong>{settings.totalShots}-shot strip</strong></div>
        <div><span className="label">Taken</span><strong>{shotsTaken}/{settings.totalShots}</strong></div>
      </div>

      <div className="section-divider"><h3>Preset library</h3></div>
      <div className="settings-grid preset-actions-grid">
        <label className="field-group preset-select-group">Saved presets<select value={selectedPresetId} onChange={(event) => onLoadPreset(event.target.value)} disabled={presets.length === 0}>{presets.length === 0 ? <option value="">No presets yet</option> : null}{presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
        <div className="button-stack compact-stack"><button type="button" onClick={() => onLoadPreset(selectedPresetId)} disabled={!selectedPresetId}>Load selected</button><button type="button" onClick={() => onDeletePreset(selectedPresetId)} disabled={!selectedPresetId}>Delete preset</button></div>
      </div>
      <div className="inline-actions wrap-actions"><label className="button-like file-button"><input type="file" accept="application/json" hidden onChange={(event) => onImportPreset(event.target.files?.[0] ?? null)} />Import preset JSON</label></div>

      <div className="section-divider"><h3>Session settings</h3></div>
      <label className="field-group">Strip title<input value={settings.stripTitle} disabled={disableSettings} onChange={(event) => onSettingsChange({ ...settings, stripTitle: event.target.value })} /></label>
      <label className="field-group">Strip subtitle<input value={settings.stripSubtitle} disabled={disableSettings} onChange={(event) => onSettingsChange({ ...settings, stripSubtitle: event.target.value })} /></label>
      <div className="settings-grid three-columns">
        <label className="field-group">Total shots<input type="number" min={1} max={6} value={settings.totalShots} disabled={disableSettings} onChange={(event) => onSettingsChange({ ...settings, totalShots: Math.max(1, Math.min(6, Number(event.target.value) || 1)) })} /></label>
        <label className="field-group">Countdown seconds<input type="number" min={1} max={10} value={settings.countdownSeconds} disabled={disableSettings} onChange={(event) => onSettingsChange({ ...settings, countdownSeconds: Math.max(1, Math.min(10, Number(event.target.value) || 3)) })} /></label>
        <label className="field-group">After decoration<select value={settings.printDecisionMode} disabled={disableSettings} onChange={(event) => onSettingsChange({ ...settings, printDecisionMode: event.target.value as BoothSettings['printDecisionMode'] })}><option value="ask">Ask to print</option><option value="auto">Auto print after save</option></select></label>
      </div>

      <div className="section-divider"><h3>Kiosk + touch mode</h3></div>
      <div className="settings-grid three-columns">
        <label className="field-group">Admin PIN<input value={kioskSettings.adminPin} inputMode="numeric" maxLength={12} disabled={disableSettings} onChange={(event) => updateKiosk('adminPin', event.target.value.replace(/\D/g, '').slice(0, 12))} /></label>
        <label className="field-group">Idle reset seconds<input type="number" min={10} max={300} value={kioskSettings.idleResetSeconds} disabled={disableSettings} onChange={(event) => updateKiosk('idleResetSeconds', Math.max(10, Math.min(300, Number(event.target.value) || 30)))} /></label>
        <label className="field-group checkbox-row"><input type="checkbox" checked={kioskSettings.allowGuestRetake} disabled={disableSettings} onChange={(event) => updateKiosk('allowGuestRetake', event.target.checked)} />Guest retake</label>
      </div>
      <label className="field-group checkbox-row"><input type="checkbox" checked={kioskSettings.autoReturnToCapture} disabled={disableSettings} onChange={(event) => updateKiosk('autoReturnToCapture', event.target.checked)} />Auto-return after each session</label>
      <div className="inline-actions wrap-actions"><button type="button" className="primary" onClick={onEnterKioskMode} disabled={step === 'countdown'}>Enter kiosk mode</button><button type="button" onClick={onExitKioskMode} disabled={!isKioskMode}>Exit kiosk mode</button></div>
    </section>
  );
}
