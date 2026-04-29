import type {
  BoothSettings,
  BoothTemplateLayout,
  BoothTemplateSettings,
  CapturedPhoto,
  LayoutRect,
  TemplateElement,
  TemplateImageElement,
  TemplateTextElement,
  TextLayout
} from '../types';

interface ComposeStripOptions {
  title: string;
  subtitle?: string;
  template: BoothTemplateSettings;
}

interface StripDimensions {
  width: number;
  height: number;
}

export function getStripDimensions(totalShots: number, template: BoothTemplateSettings): StripDimensions {
  const headerHeight = template.showHeader ? 140 : 32;
  const footerHeight = template.showFooter ? 50 : 20;

  return {
    width: template.width,
    height:
      headerHeight +
      footerHeight +
      totalShots * template.frameHeight +
      Math.max(0, totalShots - 1) * template.gap +
      template.padding * 2
  };
}

export function createDefaultTemplateLayout(totalShots: number): BoothTemplateLayout {
  const photoSlots: LayoutRect[] = [];
  const topStart = 0.16;
  const availableHeight = 0.68;
  const slotGap = totalShots > 1 ? 0.015 : 0;
  const slotHeight = totalShots > 0 ? (availableHeight - slotGap * Math.max(totalShots - 1, 0)) / totalShots : 0.2;

  for (let index = 0; index < totalShots; index += 1) {
    photoSlots.push({
      x: 0.08,
      y: topStart + index * (slotHeight + slotGap),
      width: 0.84,
      height: slotHeight
    });
  }

  return {
    title: { x: 0.5, y: 0.07, fontScale: 1, align: 'center' },
    subtitle: { x: 0.5, y: 0.12, fontScale: 1, align: 'center' },
    footer: { x: 0.5, y: 0.965, fontScale: 1, align: 'center' },
    photoSlots,
    elements: []
  };
}

export function normalizeBoothSettings(settings: BoothSettings): BoothSettings {
  const totalShots = clampInteger(settings.totalShots, 1, 6);
  const defaultLayout = createDefaultTemplateLayout(totalShots);
  const sourceLayout = settings.template.layout ?? defaultLayout;
  const photoSlots = Array.from({ length: totalShots }, (_, index) => {
    const fallback = defaultLayout.photoSlots[index];
    const source = sourceLayout.photoSlots[index] ?? fallback;
    return normalizeRect(source, fallback);
  });

  return {
    ...settings,
    totalShots,
    countdownSeconds: clampInteger(settings.countdownSeconds, 1, 10),
    printDecisionMode: settings.printDecisionMode === 'auto' ? 'auto' : 'ask',
    template: {
      ...settings.template,
      backgroundOpacity: clamp(settings.template.backgroundOpacity, 0, 1),
      width: clampInteger(settings.template.width, 500, 1600),
      frameHeight: clampInteger(settings.template.frameHeight, 180, 700),
      padding: clampInteger(settings.template.padding, 0, 80),
      gap: clampInteger(settings.template.gap, 0, 80),
      cornerRadius: clampInteger(settings.template.cornerRadius, 0, 50),
      layout: {
        title: normalizeTextLayout(sourceLayout.title ?? defaultLayout.title, defaultLayout.title),
        subtitle: normalizeTextLayout(sourceLayout.subtitle ?? defaultLayout.subtitle, defaultLayout.subtitle),
        footer: normalizeTextLayout(sourceLayout.footer ?? defaultLayout.footer, defaultLayout.footer),
        photoSlots,
        elements: Array.isArray(sourceLayout.elements) ? sourceLayout.elements.map(normalizeTemplateElement).filter(Boolean) as TemplateElement[] : []
      }
    }
  };
}

export async function composePhotoStrip(photos: CapturedPhoto[], options: ComposeStripOptions): Promise<string> {
  const { template } = options;
  const layout = normalizeBoothSettings({
    totalShots: Math.max(photos.length, 1),
    countdownSeconds: 3,
    printDecisionMode: 'ask',
    stripTitle: options.title,
    stripSubtitle: options.subtitle ?? '',
    template
  }).template.layout;
  const { width, height } = getStripDimensions(Math.max(photos.length, 1), template);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is not available.');
  }

  context.fillStyle = template.stripBackgroundColor;
  context.fillRect(0, 0, width, height);

  if (template.backgroundImageDataUrl) {
    const backgroundImage = await loadImage(template.backgroundImageDataUrl);
    context.save();
    context.globalAlpha = clamp(template.backgroundOpacity, 0, 1);
    drawBackgroundImage(context, backgroundImage, width, height, template.backgroundSize);
    context.restore();
  }

  if (template.showHeader) {
    drawTextBlock(context, options.title || 'PhotoBooth', layout.title, width, height, template.textColor, template.titleFontSize, 700);
    drawTextBlock(
      context,
      options.subtitle || new Date().toLocaleString(),
      layout.subtitle,
      width,
      height,
      template.textColor,
      template.subtitleFontSize,
      400
    );
  }

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const slot = layout.photoSlots[index] ?? layout.photoSlots[layout.photoSlots.length - 1];
    const image = await loadImage(photo.dataUrl);
    const radius = template.frameStyle === 'square' ? 0 : template.cornerRadius;
    const px = denormalizeRect(slot, width, height);
    const frame = fitMode(image.width, image.height, px.width, px.height, 'cover');
    const imageX = px.x + (px.width - frame.drawWidth) / 2;
    const imageY = px.y + (px.height - frame.drawHeight) / 2;

    context.fillStyle = 'rgba(255,255,255,0.94)';
    roundRect(context, px.x - 6, px.y - 6, px.width + 12, px.height + 12, Math.max(radius + 4, radius));
    context.fill();

    context.save();
    roundRect(context, px.x, px.y, px.width, px.height, radius);
    context.clip();
    context.drawImage(image, imageX, imageY, frame.drawWidth, frame.drawHeight);
    context.restore();
  }

  for (const element of layout.elements) {
    if (element.hidden) {
      continue;
    }
    await drawTemplateElement(context, element, width, height);
  }

  if (template.showFooter) {
    drawTextBlock(context, 'Built with React + Tauri starter', layout.footer, width, height, template.textColor, 18, 400);
  }

  return canvas.toDataURL('image/png');
}

async function drawTemplateElement(context: CanvasRenderingContext2D, element: TemplateElement, width: number, height: number) {
  const rect = denormalizeRect(element, width, height);
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  context.save();
  context.translate(centerX, centerY);
  context.rotate((element.rotation * Math.PI) / 180);
  context.translate(-centerX, -centerY);

  if (element.type === 'text') {
    drawCustomTextElement(context, element, rect);
    context.restore();
    return;
  }

  const image = await loadImage(element.imageDataUrl);
  roundRect(context, rect.x, rect.y, rect.width, rect.height, clampInteger(element.cornerRadius, 0, 40));
  context.clip();
  const fit = fitMode(image.width, image.height, rect.width, rect.height, element.fit);
  const x = rect.x + (rect.width - fit.drawWidth) / 2;
  const y = rect.y + (rect.height - fit.drawHeight) / 2;
  context.drawImage(image, x, y, fit.drawWidth, fit.drawHeight);
  context.restore();
}

function drawCustomTextElement(
  context: CanvasRenderingContext2D,
  element: TemplateTextElement,
  rect: { x: number; y: number; width: number; height: number }
) {
  if (element.backgroundColor) {
    context.fillStyle = element.backgroundColor;
    roundRect(context, rect.x, rect.y, rect.width, rect.height, 14);
    context.fill();
  }

  context.fillStyle = element.color;
  context.font = `${clampInteger(element.fontWeight, 300, 900)} ${clampInteger(element.fontSize, 12, 160)}px Arial`;
  context.textAlign = element.align;
  context.textBaseline = 'middle';

  const paddingX = 14;
  let textX = rect.x + paddingX;
  if (element.align === 'center') {
    textX = rect.x + rect.width / 2;
  } else if (element.align === 'right') {
    textX = rect.x + rect.width - paddingX;
  }

  const lines = wrapText(context, element.text, rect.width - paddingX * 2);
  const lineHeight = Math.max(18, element.fontSize * 1.1);
  const totalHeight = lineHeight * lines.length;
  let currentY = rect.y + rect.height / 2 - totalHeight / 2 + lineHeight / 2;

  for (const line of lines) {
    context.fillText(line, textX, currentY);
    currentY += lineHeight;
  }
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const next = `${current} ${words[index]}`;
    if (context.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[index];
    }
  }
  lines.push(current);
  return lines.slice(0, 4);
}

function drawTextBlock(
  context: CanvasRenderingContext2D,
  text: string,
  layout: TextLayout,
  width: number,
  height: number,
  color: string,
  baseFontSize: number,
  weight: number
) {
  context.fillStyle = color;
  context.font = `${weight} ${Math.max(12, Math.round(baseFontSize * layout.fontScale))}px Arial`;
  context.textAlign = layout.align;
  context.textBaseline = 'middle';

  const x = width * clamp(layout.x, 0.05, 0.95);
  const y = height * clamp(layout.y, 0.03, 0.98);
  context.fillText(text, x, y);
}

function denormalizeRect(rect: { x: number; y: number; width: number; height: number }, width: number, height: number) {
  return {
    x: rect.x * width,
    y: rect.y * height,
    width: rect.width * width,
    height: rect.height * height
  };
}

function normalizeRect(rect: LayoutRect, fallback: LayoutRect): LayoutRect {
  return {
    x: clamp(Number.isFinite(rect.x) ? rect.x : fallback.x, 0, 0.95),
    y: clamp(Number.isFinite(rect.y) ? rect.y : fallback.y, 0, 0.95),
    width: clamp(Number.isFinite(rect.width) ? rect.width : fallback.width, 0.12, 0.95),
    height: clamp(Number.isFinite(rect.height) ? rect.height : fallback.height, 0.08, 0.9)
  };
}

function normalizeTemplateElement(element: TemplateElement | Partial<TemplateElement>): TemplateElement | null {
  if (!element || typeof element !== 'object' || !('type' in element) || !('id' in element)) {
    return null;
  }

  if (element.type === 'text') {
    const textElement = element as Partial<TemplateTextElement>;
    return {
      id: String(textElement.id),
      type: 'text',
      x: clamp(numberOr(textElement.x, 0.1), 0, 0.95),
      y: clamp(numberOr(textElement.y, 0.2), 0, 0.95),
      width: clamp(numberOr(textElement.width, 0.5), 0.12, 0.95),
      height: clamp(numberOr(textElement.height, 0.12), 0.08, 0.7),
      text: textElement.text ?? 'Your text',
      color: textElement.color ?? '#ffffff',
      fontSize: clampInteger(numberOr(textElement.fontSize, 28), 12, 160),
      fontWeight: clampInteger(numberOr(textElement.fontWeight, 700), 300, 900),
      align: textElement.align ?? 'center',
      backgroundColor: textElement.backgroundColor ?? 'rgba(15, 17, 23, 0.45)',
      rotation: clamp(numberOr(textElement.rotation, 0), -180, 180),
      locked: Boolean(textElement.locked),
      hidden: Boolean(textElement.hidden),
      groupId: textElement.groupId ? String(textElement.groupId) : undefined
    };
  }

  const imageElement = element as Partial<TemplateImageElement>;
  if (!imageElement.imageDataUrl) {
    return null;
  }
  return {
    id: String(imageElement.id),
    type: 'image',
    x: clamp(numberOr(imageElement.x, 0.18), 0, 0.95),
    y: clamp(numberOr(imageElement.y, 0.82), 0, 0.95),
    width: clamp(numberOr(imageElement.width, 0.24), 0.08, 0.95),
    height: clamp(numberOr(imageElement.height, 0.12), 0.08, 0.8),
    imageDataUrl: imageElement.imageDataUrl,
    fit: imageElement.fit ?? 'contain',
    cornerRadius: clampInteger(numberOr(imageElement.cornerRadius, 12), 0, 40),
    rotation: clamp(numberOr(imageElement.rotation, 0), -180, 180),
    locked: Boolean(imageElement.locked),
    hidden: Boolean(imageElement.hidden),
    groupId: imageElement.groupId ? String(imageElement.groupId) : undefined
  };
}

function normalizeTextLayout(layout: TextLayout, fallback: TextLayout): TextLayout {
  return {
    x: clamp(Number.isFinite(layout.x) ? layout.x : fallback.x, 0.05, 0.95),
    y: clamp(Number.isFinite(layout.y) ? layout.y : fallback.y, 0.03, 0.98),
    fontScale: clamp(Number.isFinite(layout.fontScale) ? layout.fontScale : fallback.fontScale, 0.6, 1.8),
    align: layout.align ?? fallback.align
  };
}

function drawBackgroundImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  mode: BoothTemplateSettings['backgroundSize']
) {
  if (mode === 'stretch') {
    context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
    return;
  }

  const fit = fitMode(image.width, image.height, canvasWidth, canvasHeight, mode);
  const x = (canvasWidth - fit.drawWidth) / 2;
  const y = (canvasHeight - fit.drawHeight) / 2;
  context.drawImage(image, x, y, fit.drawWidth, fit.drawHeight);
}

function fitMode(imageWidth: number, imageHeight: number, maxWidth: number, maxHeight: number, mode: 'cover' | 'contain' | 'stretch') {
  if (mode === 'stretch') {
    return { drawWidth: maxWidth, drawHeight: maxHeight };
  }
  const scale = mode === 'cover' ? Math.max(maxWidth / imageWidth, maxHeight / imageHeight) : Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  return {
    drawWidth: imageWidth * scale,
    drawHeight: imageHeight * scale
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image.'));
    image.src = src;
  });
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  context.beginPath();
  if (safeRadius === 0) {
    context.rect(x, y, width, height);
    context.closePath();
    return;
  }
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function numberOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max));
}
