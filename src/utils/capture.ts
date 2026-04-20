export function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): string {
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context is unavailable.');
  }

  context.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

export async function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}
