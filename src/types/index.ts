export type BoothStep = 'welcome' | 'preview' | 'countdown' | 'review' | 'edit-print';

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

export type PrinterProfile = {
  id: string;
  name: string;
  printerName: string;
  paperSize: string;
  orientation: 'portrait' | 'landscape';
  copies: number;
  silentPrint: boolean;
  autoSaveBeforePrint: boolean;
};

export type DslrSettings = {
  enabled: boolean;
  provider: 'none' | 'canon' | 'nikon' | 'sony' | 'generic';
  connectionMode: 'usb' | 'wifi';
  cameraName: string;
  captureFolder: string;
  watchFolder: string;
  autoImportLatest: boolean;
};

export type CloudSyncSettings = {
  enabled: boolean;
  provider: 'none' | 'supabase' | 'firebase' | 'custom';
  endpointUrl: string;
  apiKey: string;
  libraryId: string;
  deviceId: string;
  autoSyncPresets: boolean;
  autoSyncGallery: boolean;
  enablePrintUpload: boolean;
};

export type SavedPrintedPicture = {
  id: string;
  name: string;
  imageDataUrl: string;
  baseImageDataUrl?: string;
  createdAt: string;
  templatePresetId?: string;
  filter?: PrintFilter;
  elements?: PrintEditElement[];
};

export type AdminPersistenceState = {
  printerProfiles: PrinterProfile[];
  selectedPrinterProfileId?: string | null;
  dslrSettings: DslrSettings;
  cloudSyncSettings: CloudSyncSettings;
  savedPrintedPictures: SavedPrintedPicture[];
  presets: BoothTemplatePreset[];
  updatedAt?: string;
};