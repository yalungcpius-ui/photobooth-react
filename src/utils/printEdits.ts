import type { PrintEditElement, PrintFilter } from '../types';

interface ComposeEditedPrintOptions {
  baseImageDataUrl: string;
  filter: PrintFilter;
  elements: PrintEditElement[];
}

const filterMap: Record<PrintFilter, string> = {
  none: 'none',
  warm: 'sepia(0.18) saturate(1.18) contrast(1.04)',
  cool: 'saturate(1.08) hue-rotate(185deg) contrast(1.03)',
  mono: 'grayscale(1) contrast(1.08)',
  vintage: 'sepia(0.45) contrast(0.95) saturate(0.82)',
  pop: 'saturate(1.45) contrast(1.08)'
};

export function cssFilterForPrintFilter(filter: PrintFilter) {
  return filterMap[filter] ?? filterMap.none;
}

export async function composeEditedPrint({ baseImageDataUrl, filter, elements }: ComposeEditedPrintOptions): Promise<string> {
  const baseImage = await loadImage(baseImageDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = baseImage.width;
  canvas.height = baseImage.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is not available.');
  }

  context.save();
  context.filter = cssFilterForPrintFilter(filter);
  context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
  context.restore();

  for (const element of elements) {
    if (element.hidden) {
      continue;
    }
    drawPrintElement(context, element, canvas.width, canvas.height);
  }

  return canvas.toDataURL('image/png');
}

function drawPrintElement(context: CanvasRenderingContext2D, element: PrintEditElement, width: number, height: number) {
  const x = element.x * width;
  const y = element.y * height;
  const w = element.width * width;
  const h = element.height * height;
  const centerX = x + w / 2;
  const centerY = y + h / 2;

  context.save();
  context.translate(centerX, centerY);
  context.rotate((element.rotation * Math.PI) / 180);
  context.translate(-centerX, -centerY);

  if (element.kind === 'bubble') {
    context.fillStyle = element.backgroundColor || 'rgba(255,255,255,0.9)';
    context.strokeStyle = element.borderColor || 'rgba(15,17,23,0.18)';
    context.lineWidth = Math.max(2, width * 0.003);
    roundRect(context, x, y, w, h, Math.min(w, h) * 0.18);
    context.fill();
    context.stroke();
  }

  context.fillStyle = element.color;
  context.font = `${element.fontWeight} ${Math.round(element.fontSize * width)}px ${element.kind === 'emoji' ? 'Apple Color Emoji, Segoe UI Emoji, sans-serif' : 'Arial, sans-serif'}`;
  context.textAlign = element.align;
  context.textBaseline = 'middle';

  const padding = w * 0.08;
  let textX = x + padding;
  if (element.align === 'center') textX = x + w / 2;
  if (element.align === 'right') textX = x + w - padding;

  const lines = wrapText(context, element.text, w - padding * 2);
  const lineHeight = element.fontSize * width * 1.12;
  const totalHeight = lineHeight * lines.length;
  let currentY = y + h / 2 - totalHeight / 2 + lineHeight / 2;

  for (const line of lines) {
    context.fillText(line, textX, currentY);
    currentY += lineHeight;
  }

  context.restore();
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (!text.trim()) {
    return [''];
  }
  const words = text.split(/\s+/);
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
  return lines.slice(0, 5);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image.'));
    image.src = src;
  });
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  context.beginPath();
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
