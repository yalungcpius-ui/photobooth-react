import type { BoothTemplatePreset, DslrSettings, PrinterProfile, CloudSyncSettings, SavedPrintedPicture, AdminPersistenceState } from './types';

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
async function getInvoke(): Promise<InvokeFn | null> {
  if (!isTauri()) return null;
  try {
    const api = await import('@tauri-apps/api/core');
    return api.invoke as InvokeFn;
  } catch {
    return null;
  }
}

export async function persistAdminStateToFile(state: AdminPersistenceState) {
  const invoke = await getInvoke();
  if (!invoke) {
    localStorage.setItem('photobooth-admin-state-file-fallback-v1', JSON.stringify(state));
    return 'Saved to browser localStorage fallback. Run inside Tauri for file-system persistence.';
  }
  return invoke<string>('save_app_data', { fileName: 'admin-state.json', contents: JSON.stringify(state, null, 2) });
}

export async function loadAdminStateFromFile(): Promise<AdminPersistenceState | null> {
  const invoke = await getInvoke();
  if (!invoke) {
    const raw = localStorage.getItem('photobooth-admin-state-file-fallback-v1');
    return raw ? JSON.parse(raw) as AdminPersistenceState : null;
  }
  const raw = await invoke<string>('load_app_data', { fileName: 'admin-state.json' });
  return raw ? JSON.parse(raw) as AdminPersistenceState : null;
}

export async function silentPrint(imageDataUrl: string, profile: PrinterProfile) {
  if (!profile.silentPrint) {
    browserPrint(imageDataUrl, profile.name);
    return 'Opened normal print dialog because silent printing is disabled for this profile.';
  }
  const invoke = await getInvoke();
  if (!invoke) {
    browserPrint(imageDataUrl, profile.name);
    return 'Silent printing needs the Windows/Tauri app. Browser fallback opened the print dialog.';
  }
  return invoke<string>('silent_print_image', { imageDataUrl, profile });
}

export function browserPrint(imageDataUrl: string, title = 'PhotoBooth print') {
  const popup = window.open('', '_blank', 'width=1100,height=900');
  if (!popup) return;
  popup.document.write(`<!doctype html><html><head><title>${title}</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#fff}img{max-width:96vw;max-height:96vh;object-fit:contain}@media print{img{width:100%;max-height:none}}</style></head><body><img src="${imageDataUrl}" alt="Photobooth print"/><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>`);
  popup.document.close();
}

export async function connectDslr(settings: DslrSettings) {
  const invoke = await getInvoke();
  if (!invoke) return 'DSLR control requires the Tauri Windows app plus a camera adapter/SDK. Webcam mode remains active in browser/PWA.';
  return invoke<string>('connect_dslr', { settings });
}

export async function triggerDslrCapture(settings: DslrSettings): Promise<string> {
  const invoke = await getInvoke();
  if (!invoke) throw new Error('DSLR capture requires the Tauri Windows app.');
  return invoke<string>('trigger_dslr_capture', { settings });
}

export async function uploadPresetLibrary(settings: CloudSyncSettings, presets: BoothTemplatePreset[]) {
  if (!settings.endpointUrl) throw new Error('Cloud endpoint URL is required.');
  const response = await fetch(settings.endpointUrl.replace(/\/$/, '') + '/presets', {
    method: 'PUT',
    headers: buildCloudHeaders(settings),
    body: JSON.stringify({ deviceId: settings.deviceId, presets })
  });
  if (!response.ok) throw new Error(`Cloud upload failed: ${response.status}`);
  return 'Preset library uploaded.';
}

export async function downloadPresetLibrary(settings: CloudSyncSettings): Promise<BoothTemplatePreset[]> {
  if (!settings.endpointUrl) throw new Error('Cloud endpoint URL is required.');
  const response = await fetch(settings.endpointUrl.replace(/\/$/, '') + `/presets?deviceId=${encodeURIComponent(settings.deviceId)}`, {
    headers: buildCloudHeaders(settings)
  });
  if (!response.ok) throw new Error(`Cloud download failed: ${response.status}`);
  const data = await response.json() as { presets?: BoothTemplatePreset[] };
  return Array.isArray(data.presets) ? data.presets : [];
}

export async function createShareLink(imageDataUrl: string, cloud: CloudSyncSettings, savedPrints: SavedPrintedPicture[]) {
  if (cloud.endpointUrl && cloud.enablePrintUpload) {
    const response = await fetch(cloud.endpointUrl.replace(/\/$/, '') + '/prints', {
      method: 'POST',
      headers: buildCloudHeaders(cloud),
      body: JSON.stringify({ deviceId: cloud.deviceId, imageDataUrl, createdAt: new Date().toISOString() })
    });
    if (response.ok) {
      const data = await response.json() as { url?: string };
      if (data.url) return data.url;
    }
  }
  const item = savedPrints.find((print) => print.imageDataUrl === imageDataUrl);
  return item ? `${window.location.origin}${window.location.pathname}#print-${item.id}` : window.location.href;
}

function buildCloudHeaders(settings: CloudSyncSettings) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;
  return headers;
}
