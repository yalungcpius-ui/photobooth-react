import { useState } from 'react';
import type { CloudSyncSettings, SavedPrintedPicture } from '../types';
import { createShareLink } from '../services';
import { downloadDataUrl } from '../utils/capture';

interface Props {
  savedPrints: SavedPrintedPicture[];
  cloudSyncSettings: CloudSyncSettings;
  onEdit: (print: SavedPrintedPicture) => void;
  onDelete: (id: string) => void;
}

export function GalleryHistory({ savedPrints, cloudSyncSettings, onEdit, onDelete }: Props) {
  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});

  const sharePrint = async (print: SavedPrintedPicture) => {
    const url = await createShareLink(print.imageDataUrl, cloudSyncSettings, savedPrints);
    setShareLinks((current) => ({ ...current, [print.id]: url }));
    if (navigator.share) {
      await navigator.share({ title: print.name, text: 'PhotoBooth picture', url }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(url).catch(() => undefined);
    }
  };

  return (
    <section className="panel gallery-history-panel">
      <div className="panel-row">
        <div><p className="eyebrow">Gallery / history</p><h2>Saved printed pictures</h2><p className="helper-text">Saved strips and edited prints appear here for re-editing, downloading, printing or QR sharing.</p></div>
        <strong>{savedPrints.length} saved</strong>
      </div>
      {savedPrints.length === 0 ? <p className="helper-text">No saved pictures yet.</p> : null}
      <div className="gallery-grid">
        {savedPrints.map((print) => {
          const link = shareLinks[print.id];
          const qrSrc = link ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}` : null;
          return (
            <article key={print.id} className="gallery-card" id={`print-${print.id}`}>
              <img src={print.imageDataUrl} alt={print.name} />
              <div className="gallery-card-body">
                <strong>{print.name}</strong>
                <small>{new Date(print.createdAt).toLocaleString()}</small>
                <div className="inline-actions wrap-actions"><button type="button" onClick={() => onEdit(print)}>Edit</button><button type="button" onClick={() => void downloadDataUrl(print.imageDataUrl, `${print.name}.png`)}>Download</button><button type="button" onClick={() => void sharePrint(print)}>Share / QR</button><button type="button" onClick={() => onDelete(print.id)}>Delete</button></div>
                {qrSrc ? <div className="qr-card"><img src={qrSrc} alt="QR code for shared print" /><input readOnly value={link} onFocus={(event) => event.currentTarget.select()} /></div> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
