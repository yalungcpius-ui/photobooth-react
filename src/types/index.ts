export type BoothStep = 'welcome' | 'preview' | 'countdown' | 'review' | 'edit-print';
export type AppMode = 'configuration' | 'designer' | 'photobooth';
export type PrintDecisionMode = 'ask' | 'auto';

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextLayout {
  x: number;
  y: number;
  fontScale: number;
  align: 'left' | 'center' | 'right';
}

interface BaseTemplateElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  hidden: boolean;
  groupId?: string;
}

export interface TemplateTextElement extends BaseTemplateElement {
  type: 'text';
  text: string;
  color: string;
  fontSize: number;
  fontWeight: number;
  align: 'left' | 'center' | 'right';
  backgroundColor?: string;
}

export interface TemplateImageElement extends BaseTemplateElement {
  type: 'image';
  imageDataUrl: string;
  fit: 'contain' | 'cover' | 'stretch';
  cornerRadius: number;
}

export type TemplateElement = TemplateTextElement | TemplateImageElement;

export interface BoothTemplateLayout {
  title: TextLayout;
  subtitle: TextLayout;
  footer: TextLayout;
  photoSlots: LayoutRect[];
  elements: TemplateElement[];
}

export interface BoothTemplateSettings {
  backgroundImageDataUrl: string | null;
  backgroundSize: 'cover' | 'contain' | 'stretch';
  backgroundOpacity: number;
  stripBackgroundColor: string;
  textColor: string;
  titleFontSize: number;
  subtitleFontSize: number;
  width: number;
  frameHeight: number;
  padding: number;
  gap: number;
  cornerRadius: number;
  showHeader: boolean;
  showFooter: boolean;
  frameStyle: 'rounded' | 'square';
  layout: BoothTemplateLayout;
}

export interface BoothSettings {
  totalShots: number;
  countdownSeconds: number;
  printDecisionMode: PrintDecisionMode;
  stripTitle: string;
  stripSubtitle: string;
  template: BoothTemplateSettings;
}

export interface BoothKioskSettings {
  enabled: boolean;
  adminPin: string;
  idleResetSeconds: number;
  autoReturnToCapture: boolean;
  allowGuestRetake: boolean;
}

export interface BoothTemplatePreset {
  id: string;
  name: string;
  settings: BoothSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  createdAt: string;
}

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
}

export type PrintFilter = 'none' | 'warm' | 'cool' | 'mono' | 'vintage' | 'pop';

export interface PrintEditElement {
  id: string;
  kind: 'bubble' | 'emoji' | 'icon' | 'text';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  backgroundColor?: string;
  borderColor?: string;
  fontSize: number;
  fontWeight: number;
  align: 'left' | 'center' | 'right';
  hidden: boolean;
}

export interface SavedPrintedPicture {
  id: string;
  name: string;
  imageDataUrl: string;
  baseImageDataUrl: string;
  filter: PrintFilter;
  elements: PrintEditElement[];
  createdAt: string;
}

export interface PrinterProfile {
  id: string;
  name: string;
  printerName: string;
  paperSize: '4x6' | '5x7' | '6x4-strip' | 'custom';
  orientation: 'portrait' | 'landscape';
  copies: number;
  silentPrinting: boolean;
  autoSaveBeforePrint: boolean;
}

export interface DslrSettings {
  enabled: boolean;
  provider: 'none' | 'gphoto2' | 'canon-edsk' | 'sony-sdk' | 'watch-folder';
  cameraName: string;
  watchFolder: string;
  autoImportLatest: boolean;
}

export interface CloudSyncSettings {
  enabled: boolean;
  endpointUrl: string;
  apiKey: string;
  deviceId: string;
  autoSyncPresets: boolean;
  enablePrintUpload: boolean;
}

export interface AdminPersistenceState {
  printerProfiles: PrinterProfile[];
  selectedPrinterProfileId: string | null;
  dslrSettings: DslrSettings;
  cloudSyncSettings: CloudSyncSettings;
  presets?: BoothTemplatePreset[];
  savedPrints?: SavedPrintedPicture[];
  updatedAt: string;
}
