export type BoothStep = 'welcome' | 'preview' | 'countdown' | 'review';

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
