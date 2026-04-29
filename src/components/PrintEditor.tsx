import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PrintEditElement, PrintFilter, SavedPrintedPicture } from '../types';
import { composeEditedPrint, cssFilterForPrintFilter } from '../utils/printEdits';
import { downloadDataUrl } from '../utils/capture';

interface PrintEditorProps {
  baseImageDataUrl: string;
  savedPrints: SavedPrintedPicture[];
  onSaveEditedPrint: (imageDataUrl: string, filter: PrintFilter, elements: PrintEditElement[]) => void;
  onClose: () => void;
  onLoadSavedPrint: (print: SavedPrintedPicture) => void;
  onDeleteSavedPrint: (id: string) => void;
}

type DragTarget =
  | { kind: 'move'; id: string; offsetX: number; offsetY: number }
  | { kind: 'resize'; id: string; anchorX: number; anchorY: number };

const emojiChoices = ['😂', '😍', '🎉', '✨', '🥳', '❤️', '😎', '👍'];
const iconChoices = ['⭐', '📸', '👑', '🔥', '🎂', '💍', '🎓', '🏆'];

export function PrintEditor({ baseImageDataUrl, savedPrints, onSaveEditedPrint, onClose, onLoadSavedPrint, onDeleteSavedPrint }: PrintEditorProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<PrintFilter>('none');
  const [elements, setElements] = useState<PrintEditElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [editedDataUrl, setEditedDataUrl] = useState<string | null>(null);
  const selectedElement = useMemo(() => elements.find((element) => element.id === selectedId) ?? null, [elements, selectedId]);

  useEffect(() => {
    let cancelled = false;
    void composeEditedPrint({ baseImageDataUrl, filter, elements }).then((dataUrl) => {
      if (!cancelled) {
        setEditedDataUrl(dataUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [baseImageDataUrl, filter, elements]);

  const addElement = (kind: PrintEditElement['kind'], text?: string) => {
    const element: PrintEditElement = {
      id: createId(kind),
      kind,
      text: text ?? (kind === 'bubble' ? 'Say something!' : kind === 'emoji' ? '🎉' : kind === 'icon' ? '⭐' : 'Custom text'),
      x: kind === 'emoji' || kind === 'icon' ? 0.62 : 0.15,
      y: kind === 'emoji' || kind === 'icon' ? 0.12 : 0.12,
      width: kind === 'emoji' || kind === 'icon' ? 0.16 : 0.56,
      height: kind === 'emoji' || kind === 'icon' ? 0.11 : 0.1,
      rotation: 0,
      color: kind === 'bubble' ? '#111827' : '#ffffff',
      backgroundColor: kind === 'bubble' ? 'rgba(255,255,255,0.92)' : kind === 'text' ? 'rgba(17,24,39,0.45)' : 'transparent',
      borderColor: 'rgba(17,24,39,0.18)',
      fontSize: kind === 'emoji' || kind === 'icon' ? 0.075 : 0.035,
      fontWeight: 700,
      align: 'center',
      hidden: false
    };
    setElements((current) => [...current, element]);
    setSelectedId(element.id);
  };

  const updateSelected = (updates: Partial<PrintEditElement>) => {
    if (!selectedId) return;
    setElements((current) => current.map((element) => (element.id === selectedId ? { ...element, ...updates } : element)));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((current) => current.filter((element) => element.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selectedElement) return;
    const clone = {
      ...selectedElement,
      id: createId(selectedElement.kind),
      x: clamp(selectedElement.x + 0.04, 0, 1 - selectedElement.width),
      y: clamp(selectedElement.y + 0.04, 0, 1 - selectedElement.height),
      hidden: false
    };
    setElements((current) => [...current, clone]);
    setSelectedId(clone.id);
  };

  const resetEdits = () => {
    setFilter('none');
    setElements([]);
    setSelectedId(null);
  };

  const saveEditedPrint = async () => {
    const imageDataUrl = editedDataUrl ?? await composeEditedPrint({ baseImageDataUrl, filter, elements });
    onSaveEditedPrint(imageDataUrl, filter, elements);
  };

  const downloadEditedPrint = async () => {
    const imageDataUrl = editedDataUrl ?? await composeEditedPrint({ baseImageDataUrl, filter, elements });
    await downloadDataUrl(imageDataUrl, 'photobooth-edited-print.png');
  };

  const printEdited = async () => {
    const imageDataUrl = editedDataUrl ?? await composeEditedPrint({ baseImageDataUrl, filter, elements });
    const popup = window.open('', '_blank', 'width=1100,height=900');
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>Print Edited Photo</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#fff}img{max-width:96vw;max-height:96vh;object-fit:contain}@media print{img{width:100%;max-height:none}}</style></head><body><img src="${imageDataUrl}" alt="Edited photobooth print"/><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>`);
    popup.document.close();
  };

  const beginDrag = (target: DragTarget, event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragTarget(target);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragTarget || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const rawX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const rawY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    setElements((current) => current.map((element) => {
      if (element.id !== dragTarget.id) return element;
      if (dragTarget.kind === 'move') {
        return {
          ...element,
          x: clamp(rawX - dragTarget.offsetX, 0, 1 - element.width),
          y: clamp(rawY - dragTarget.offsetY, 0, 1 - element.height)
        };
      }
      return {
        ...element,
        width: clamp(rawX - dragTarget.anchorX, 0.06, 1 - dragTarget.anchorX),
        height: clamp(rawY - dragTarget.anchorY, 0.05, 1 - dragTarget.anchorY)
      };
    }));
  };

  return (
    <section className="panel print-editor-panel">
      <div className="panel-row">
        <div>
          <p className="eyebrow">Post-capture editor</p>
          <h2>Edit printed picture</h2>
          <p className="helper-text">Add bubble text, emojis, icons and filters before saving, downloading or printing.</p>
        </div>
        <button type="button" onClick={onClose}>Back to booth</button>
      </div>

      <div className="print-editor-grid">
        <div className="print-editor-stage-wrap">
          <div
            ref={stageRef}
            className="print-editor-stage"
            onPointerMove={handlePointerMove}
            onPointerUp={() => setDragTarget(null)}
            onPointerCancel={() => setDragTarget(null)}
            onPointerLeave={() => setDragTarget(null)}
            onPointerDown={() => setSelectedId(null)}
          >
            <img src={baseImageDataUrl} alt="Editable printed strip" className="print-editor-base" style={{ filter: cssFilterForPrintFilter(filter) }} />
            {elements.filter((element) => !element.hidden).map((element) => (
              <div
                key={element.id}
                className={`print-edit-element print-edit-${element.kind} ${selectedId === element.id ? 'selected' : ''}`}
                style={{
                  left: `${element.x * 100}%`,
                  top: `${element.y * 100}%`,
                  width: `${element.width * 100}%`,
                  height: `${element.height * 100}%`,
                  color: element.color,
                  background: element.kind === 'bubble' || element.kind === 'text' ? element.backgroundColor : 'transparent',
                  transform: `rotate(${element.rotation}deg)`,
                  fontSize: `${element.fontSize * 100}vw`,
                  fontWeight: element.fontWeight,
                  textAlign: element.align
                }}
                onPointerDown={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const stageBounds = stageRef.current?.getBoundingClientRect();
                  setSelectedId(element.id);
                  if (!stageBounds) return;
                  beginDrag({ kind: 'move', id: element.id, offsetX: (event.clientX - bounds.left) / stageBounds.width, offsetY: (event.clientY - bounds.top) / stageBounds.height }, event);
                }}
              >
                <span>{element.text}</span>
                <div className="resize-handle print-resize-handle" onPointerDown={(event) => beginDrag({ kind: 'resize', id: element.id, anchorX: element.x, anchorY: element.y }, event)} />
              </div>
            ))}
          </div>
        </div>

        <aside className="print-editor-sidebar">
          <div className="section-divider"><h3>Add items</h3></div>
          <div className="inline-actions wrap-actions">
            <button type="button" onClick={() => addElement('bubble')}>Bubble text</button>
            <button type="button" onClick={() => addElement('text')}>Plain text</button>
          </div>
          <div className="emoji-picker-row">
            {emojiChoices.map((emoji) => <button type="button" key={emoji} onClick={() => addElement('emoji', emoji)}>{emoji}</button>)}
          </div>
          <div className="emoji-picker-row">
            {iconChoices.map((icon) => <button type="button" key={icon} onClick={() => addElement('icon', icon)}>{icon}</button>)}
          </div>

          <label className="field-group">
            Filter
            <select value={filter} onChange={(event) => setFilter(event.target.value as PrintFilter)}>
              <option value="none">None</option>
              <option value="warm">Warm</option>
              <option value="cool">Cool</option>
              <option value="mono">Black & white</option>
              <option value="vintage">Vintage</option>
              <option value="pop">Pop colour</option>
            </select>
          </label>

          {selectedElement ? (
            <div className="selected-print-editor">
              <div className="section-divider"><h3>Selected item</h3></div>
              <label className="field-group">
                Text / symbol
                <input value={selectedElement.text} onChange={(event) => updateSelected({ text: event.target.value })} />
              </label>
              <div className="settings-grid three-columns">
                <label className="field-group">Colour<input type="color" value={selectedElement.color} onChange={(event) => updateSelected({ color: event.target.value })} /></label>
                <label className="field-group">Font size<input type="range" min={0.018} max={0.12} step={0.002} value={selectedElement.fontSize} onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })} /></label>
                <label className="field-group">Rotate<input type="range" min={-45} max={45} step={1} value={selectedElement.rotation} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} /></label>
              </div>
              {(selectedElement.kind === 'bubble' || selectedElement.kind === 'text') ? (
                <label className="field-group">
                  Background / tint
                  <input value={selectedElement.backgroundColor ?? ''} onChange={(event) => updateSelected({ backgroundColor: event.target.value || 'transparent' })} />
                </label>
              ) : null}
              <div className="inline-actions wrap-actions">
                <button type="button" onClick={duplicateSelected}>Duplicate</button>
                <button type="button" onClick={() => updateSelected({ hidden: true })}>Hide</button>
                <button type="button" onClick={deleteSelected}>Delete</button>
              </div>
            </div>
          ) : null}

          <div className="section-divider"><h3>Finish</h3></div>
          <div className="button-stack">
            <button type="button" className="primary" onClick={() => void saveEditedPrint()}>Save printed picture</button>
            <button type="button" onClick={() => void printEdited()}>Print edited picture</button>
            <button type="button" onClick={() => void downloadEditedPrint()}>Download edited picture</button>
            <button type="button" onClick={resetEdits}>Reset edits</button>
          </div>

          <div className="section-divider"><h3>Saved prints</h3></div>
          {savedPrints.length === 0 ? <p className="helper-text">Saved pictures will appear here.</p> : null}
          <div className="saved-print-list">
            {savedPrints.map((print) => (
              <div key={print.id} className="saved-print-card">
                <img src={print.imageDataUrl} alt={print.name} />
                <div>
                  <strong>{print.name}</strong>
                  <small>{new Date(print.createdAt).toLocaleString()}</small>
                  <div className="inline-actions wrap-actions">
                    <button type="button" onClick={() => {
                      setFilter(print.filter);
                      setElements(structuredClone(print.elements));
                      setSelectedId(null);
                      onLoadSavedPrint(print);
                    }}>Load</button>
                    <button type="button" onClick={() => void downloadDataUrl(print.imageDataUrl, `${print.name}.png`)}>Download</button>
                    <button type="button" onClick={() => onDeleteSavedPrint(print.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
