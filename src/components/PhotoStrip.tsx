import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type {
  BoothTemplateSettings,
  CapturedPhoto,
  LayoutRect,
  TemplateElement,
  TemplateImageElement,
  TemplateTextElement,
  TextLayout
} from '../types';
import { createDefaultTemplateLayout, getStripDimensions, normalizeBoothSettings } from '../utils/strip';

interface PhotoStripProps {
  title: string;
  subtitle: string;
  stripDataUrl: string | null;
  count: number;
  template: BoothTemplateSettings;
  photos: CapturedPhoto[];
  totalShots: number;
  activePresetName: string | null;
  presetCount: number;
  onTemplateChange: (next: BoothTemplateSettings) => void;
}

type DragTarget =
  | { kind: 'move-text'; target: 'title' | 'subtitle' | 'footer'; offsetX: number; offsetY: number }
  | { kind: 'move-slot'; index: number; offsetX: number; offsetY: number }
  | { kind: 'resize-slot'; index: number; anchorX: number; anchorY: number }
  | { kind: 'move-elements'; elementIds: string[]; startPointerX: number; startPointerY: number; origins: Record<string, { x: number; y: number }>; bounds: LayoutRect }
  | { kind: 'resize-element'; elementId: string; anchorX: number; anchorY: number }
  | { kind: 'marquee'; additive: boolean; startPointerX: number; startPointerY: number; initialSelection: string[] };

interface SnapGuides {
  vertical: number[];
  horizontal: number[];
}

const SNAP_THRESHOLD = 0.018;

export function PhotoStrip({
  title,
  subtitle,
  stripDataUrl,
  count,
  template,
  photos,
  totalShots,
  activePresetName,
  presetCount,
  onTemplateChange
}: PhotoStripProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [copiedElements, setCopiedElements] = useState<TemplateElement[]>([]);
  const [marqueeRect, setMarqueeRect] = useState<LayoutRect | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({ vertical: [], horizontal: [] });
  const dimensions = useMemo(() => getStripDimensions(totalShots, template), [template, totalShots]);
  const previewHeight = 760;
  const previewWidth = Math.max(280, (dimensions.width / dimensions.height) * previewHeight);
  const normalizedTemplate = useMemo(
    () => normalizeBoothSettings({ totalShots, countdownSeconds: 3, stripTitle: title, stripSubtitle: subtitle, template }).template,
    [template, title, subtitle, totalShots]
  );
  const { layout } = normalizedTemplate;
  const selectedElements = layout.elements.filter((element) => selectedElementIds.includes(element.id));
  const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null;
  const selectedElementId = selectedElement?.id ?? null;

  useEffect(() => {
    setSelectedElementIds((current) => current.filter((id) => layout.elements.some((element) => element.id === id)));
  }, [layout.elements]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? '';
      const isTyping = Boolean(target?.isContentEditable) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName);
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectAllVisibleElements();
        return;
      }

      if (isTyping) {
        return;
      }

      if (modifier && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelection();
        return;
      }

      if (modifier && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteSelection();
        return;
      }

      if (modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelection();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedElementIds.length > 0) {
          event.preventDefault();
          removeSelectedElements();
        }
        return;
      }

      const step = event.shiftKey ? 0.02 : 0.005;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeSelection(-step, 0);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeSelection(step, 0);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeSelection(0, -step);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeSelection(0, step);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copiedElements, layout.elements, selectedElementIds]);

  const commitTemplate = (nextTemplate: BoothTemplateSettings) => {
    onTemplateChange(
      normalizeBoothSettings({ totalShots, countdownSeconds: 3, stripTitle: title, stripSubtitle: subtitle, template: nextTemplate }).template
    );
  };

  const beginDrag = (target: DragTarget, event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragTarget(target);
  };

  const updateTemplateElement = (elementId: string, updater: (element: TemplateElement) => TemplateElement) => {
    commitTemplate({
      ...normalizedTemplate,
      layout: {
        ...layout,
        elements: layout.elements.map((element) => (element.id === elementId ? updater(element) : element))
      }
    });
  };

  const updateTemplateElements = (elementIds: string[], updater: (element: TemplateElement, index: number) => TemplateElement) => {
    const idSet = new Set(elementIds);
    let selectedIndex = 0;
    commitTemplate({
      ...normalizedTemplate,
      layout: {
        ...layout,
        elements: layout.elements.map((element) => {
          if (!idSet.has(element.id)) {
            return element;
          }
          const next = updater(element, selectedIndex);
          selectedIndex += 1;
          return next;
        })
      }
    });
  };

  const resolveSelectionIds = (elementIds: string[]) => {
    const ids = new Set<string>();
    const groupIds = new Set(
      layout.elements
        .filter((element) => elementIds.includes(element.id) && element.groupId)
        .map((element) => element.groupId as string)
    );

    layout.elements.forEach((element) => {
      if (elementIds.includes(element.id) || (element.groupId && groupIds.has(element.groupId))) {
        ids.add(element.id);
      }
    });

    return Array.from(ids);
  };

  const cloneElements = (elements: TemplateElement[], offset = 0.02) => {
    const sourceGroupIds = Array.from(new Set(elements.map((element) => element.groupId).filter(Boolean))) as string[];
    const groupMap = new Map(sourceGroupIds.map((groupId) => [groupId, createId('group')]));
    return elements.map((element) => ({
      ...structuredClone(element),
      id: createId(element.type),
      x: clamp(element.x + offset, 0, 1 - element.width),
      y: clamp(element.y + offset, 0, 1 - element.height),
      locked: false,
      hidden: false,
      groupId: element.groupId ? groupMap.get(element.groupId) : undefined
    }));
  };

  const copySelection = () => {
    if (selectedElements.length === 0) {
      return;
    }
    setCopiedElements(structuredClone(selectedElements));
  };

  const pasteSelection = () => {
    if (copiedElements.length === 0) {
      return;
    }
    const clones = cloneElements(copiedElements);
    commitTemplate({ ...normalizedTemplate, layout: { ...layout, elements: [...layout.elements, ...clones] } });
    setSelectedElementIds(clones.map((element) => element.id));
  };

  const duplicateSelection = () => {
    if (selectedElements.length === 0) {
      return;
    }
    const clones = cloneElements(selectedElements);
    commitTemplate({ ...normalizedTemplate, layout: { ...layout, elements: [...layout.elements, ...clones] } });
    setSelectedElementIds(clones.map((element) => element.id));
    setCopiedElements(structuredClone(selectedElements));
  };

  const removeSelectedElements = () => {
    if (selectedElementIds.length === 0) {
      return;
    }
    const selectedSet = new Set(selectedElementIds);
    commitTemplate({
      ...normalizedTemplate,
      layout: { ...layout, elements: layout.elements.filter((element) => !selectedSet.has(element.id)) }
    });
    clearSelection();
  };

  const nudgeSelection = (deltaX: number, deltaY: number) => {
    if (selectedElements.length === 0) {
      return;
    }
    updateTemplateElements(selectedElementIds, (element) => {
      if (element.locked) {
        return element;
      }
      return {
        ...element,
        x: clamp(element.x + deltaX, 0, 1 - element.width),
        y: clamp(element.y + deltaY, 0, 1 - element.height)
      };
    });
  };

  const groupSelection = () => {
    if (selectedElements.length < 2) {
      return;
    }
    const groupId = createId('group');
    updateTemplateElements(selectedElementIds, (element) => ({ ...element, groupId }));
  };

  const ungroupSelection = () => {
    if (selectedElements.length === 0) {
      return;
    }
    updateTemplateElements(selectedElementIds, (element) => ({ ...element, groupId: undefined }));
  };

  const selectElement = (elementId: string, additive = false) => {
    setSelectedElementIds((current) => {
      const resolved = resolveSelectionIds([elementId]);
      if (!additive) {
        return resolved;
      }
      const hasAll = resolved.every((id) => current.includes(id));
      return hasAll ? current.filter((id) => !resolved.includes(id)) : Array.from(new Set([...current, ...resolved]));
    });
  };

  const selectAllVisibleElements = () => {
    setSelectedElementIds(layout.elements.filter((element) => !element.hidden).map((element) => element.id));
  };

  const clearSelection = () => setSelectedElementIds([]);

  const reorderElement = (elementId: string, direction: 'forward' | 'backward' | 'front' | 'back') => {
    const currentIndex = layout.elements.findIndex((element) => element.id === elementId);
    if (currentIndex < 0) {
      return;
    }

    const nextElements = [...layout.elements];
    const [item] = nextElements.splice(currentIndex, 1);
    let nextIndex = currentIndex;
    if (direction === 'forward') {
      nextIndex = Math.min(nextElements.length, currentIndex + 1);
    } else if (direction === 'backward') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (direction === 'front') {
      nextIndex = nextElements.length;
    } else {
      nextIndex = 0;
    }
    nextElements.splice(nextIndex, 0, item);

    commitTemplate({
      ...normalizedTemplate,
      layout: { ...layout, elements: nextElements }
    });
  };

  const applySelectedElementAlignment = (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedElements.length === 0) {
      return;
    }

    updateTemplateElements(selectedElementIds, (element) => {
      if (mode === 'left') return { ...element, x: 0 };
      if (mode === 'center') return { ...element, x: clamp(0.5 - element.width / 2, 0, 1 - element.width) };
      if (mode === 'right') return { ...element, x: clamp(1 - element.width, 0, 1 - element.width) };
      if (mode === 'top') return { ...element, y: 0 };
      if (mode === 'middle') return { ...element, y: clamp(0.5 - element.height / 2, 0, 1 - element.height) };
      return { ...element, y: clamp(1 - element.height, 0, 1 - element.height) };
    });
  };

  const distributeElements = (axis: 'horizontal' | 'vertical') => {
    const pool = selectedElements.length >= 2 ? selectedElements : layout.elements.filter((element) => !element.hidden);
    const movableElements = pool.filter((element) => !element.hidden);
    if (movableElements.length < 3) {
      return;
    }

    const sorted = [...movableElements].sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = axis === 'horizontal'
      ? (last.x + last.width) - first.x
      : (last.y + last.height) - first.y;
    const occupied = sorted.reduce((sum, element) => sum + (axis === 'horizontal' ? element.width : element.height), 0);
    const gap = Math.max(0, (totalSpan - occupied) / (sorted.length - 1));

    let cursor = axis === 'horizontal' ? first.x : first.y;
    const byId = new Map<string, TemplateElement>();
    sorted.forEach((element, index) => {
      if (index === 0) {
        byId.set(element.id, element);
        cursor += axis === 'horizontal' ? element.width + gap : element.height + gap;
        return;
      }
      if (index === sorted.length - 1) {
        byId.set(element.id, element);
        return;
      }
      const updated = axis === 'horizontal'
        ? { ...element, x: clamp(cursor, 0, 1 - element.width) }
        : { ...element, y: clamp(cursor, 0, 1 - element.height) };
      byId.set(element.id, updated);
      cursor += axis === 'horizontal' ? element.width + gap : element.height + gap;
    });

    commitTemplate({
      ...normalizedTemplate,
      layout: {
        ...layout,
        elements: layout.elements.map((element) => byId.get(element.id) ?? element)
      }
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragTarget || !editorRef.current) {
      return;
    }

    const bounds = editorRef.current.getBoundingClientRect();
    const rawX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const rawY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);

    if (dragTarget.kind === 'move-slot') {
      const slot = layout.photoSlots[dragTarget.index];
      const snapped = snapRectPosition(rawX - dragTarget.offsetX, rawY - dragTarget.offsetY, slot.width, slot.height);
      setSnapGuides(snapped.guides);
      const nextSlot: LayoutRect = {
        ...slot,
        x: snapped.x,
        y: snapped.y
      };
      commitTemplate({
        ...normalizedTemplate,
        layout: { ...layout, photoSlots: layout.photoSlots.map((entry, index) => (index === dragTarget.index ? nextSlot : entry)) }
      });
      return;
    }

    if (dragTarget.kind === 'resize-slot') {
      const snapped = snapResizeRect(dragTarget.anchorX, dragTarget.anchorY, rawX, rawY);
      setSnapGuides(snapped.guides);
      const nextSlot: LayoutRect = {
        ...layout.photoSlots[dragTarget.index],
        width: snapped.width,
        height: snapped.height
      };
      commitTemplate({
        ...normalizedTemplate,
        layout: { ...layout, photoSlots: layout.photoSlots.map((entry, index) => (index === dragTarget.index ? nextSlot : entry)) }
      });
      return;
    }

    if (dragTarget.kind === 'move-text') {
      const snapped = snapPointPosition(rawX - dragTarget.offsetX, rawY - dragTarget.offsetY, 0.05, 0.04, 0.95, 0.98);
      setSnapGuides(snapped.guides);
      const nextText: TextLayout = {
        ...layout[dragTarget.target],
        x: snapped.x,
        y: snapped.y
      };
      commitTemplate({ ...normalizedTemplate, layout: { ...layout, [dragTarget.target]: nextText } });
      return;
    }

    if (dragTarget.kind === 'move-elements') {
      const deltaX = rawX - dragTarget.startPointerX;
      const deltaY = rawY - dragTarget.startPointerY;
      const targetX = dragTarget.bounds.x + deltaX;
      const targetY = dragTarget.bounds.y + deltaY;
      const snapTargets = getSnapTargets(layout.elements, dragTarget.elementIds);
      const snapped = snapRectPosition(targetX, targetY, dragTarget.bounds.width, dragTarget.bounds.height, snapTargets);
      setSnapGuides(snapped.guides);
      const adjustedDeltaX = snapped.x - dragTarget.bounds.x;
      const adjustedDeltaY = snapped.y - dragTarget.bounds.y;
      updateTemplateElements(dragTarget.elementIds, (entry) => {
        const origin = dragTarget.origins[entry.id];
        if (!origin || entry.locked) {
          return entry;
        }
        return {
          ...entry,
          x: clamp(origin.x + adjustedDeltaX, 0, 1 - entry.width),
          y: clamp(origin.y + adjustedDeltaY, 0, 1 - entry.height)
        };
      });
      return;
    }

    if (dragTarget.kind === 'marquee') {
      const rect = normalizeSelectionRect(dragTarget.startPointerX, dragTarget.startPointerY, rawX, rawY);
      setMarqueeRect(rect);
      const intersecting = layout.elements
        .filter((element) => !element.hidden && rectsIntersect(rect, element))
        .map((element) => element.id);
      const resolved = resolveSelectionIds(intersecting);
      setSelectedElementIds(dragTarget.additive ? Array.from(new Set([...dragTarget.initialSelection, ...resolved])) : resolved);
      return;
    }

    const element = layout.elements.find((entry) => entry.id === dragTarget.elementId);
    if (!element || element.locked) {
      return;
    }
    const snapped = snapResizeRect(dragTarget.anchorX, dragTarget.anchorY, rawX, rawY);
    setSnapGuides(snapped.guides);
    updateTemplateElement(dragTarget.elementId, (entry) => ({
      ...entry,
      width: snapped.width,
      height: snapped.height
    }));
  };

  const stopDrag = () => {
    setDragTarget(null);
    setMarqueeRect(null);
    setSnapGuides({ vertical: [], horizontal: [] });
  };

  const resetLayout = () => {
    commitTemplate({ ...normalizedTemplate, layout: createDefaultTemplateLayout(totalShots) });
    clearSelection();
    setSnapGuides({ vertical: [], horizontal: [] });
  };

  const addTextElement = () => {
    const nextElement: TemplateTextElement = {
      id: createId('text'),
      type: 'text',
      x: 0.16,
      y: 0.25,
      width: 0.56,
      height: 0.12,
      text: 'Your custom text',
      color: '#ffffff',
      fontSize: 30,
      fontWeight: 700,
      align: 'center',
      backgroundColor: 'rgba(15, 17, 23, 0.5)',
      rotation: 0,
      locked: false,
      hidden: false
    };
    commitTemplate({ ...normalizedTemplate, layout: { ...layout, elements: [...layout.elements, nextElement] } });
    setSelectedElementIds([nextElement.id]);
  };

  const triggerAddImageElement = () => imageInputRef.current?.click();

  const handleImageElementUpload = async (file: File | null) => {
    if (!file) {
      return;
    }
    const imageDataUrl = await readFileAsDataUrl(file);
    if (selectedElement?.type === 'image') {
      updateSelectedImageElement({ imageDataUrl, hidden: false });
    } else {
      const nextElement: TemplateImageElement = {
        id: createId('image'),
        type: 'image',
        x: 0.18,
        y: 0.78,
        width: 0.26,
        height: 0.12,
        imageDataUrl,
        fit: 'contain',
        cornerRadius: 14,
        rotation: 0,
        locked: false,
        hidden: false
      };
      commitTemplate({ ...normalizedTemplate, layout: { ...layout, elements: [...layout.elements, nextElement] } });
      setSelectedElementIds([nextElement.id]);
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };


  const updateSelectedTextElement = (updates: Partial<TemplateTextElement>) => {
    if (!selectedElement || selectedElement.type !== 'text') {
      return;
    }
    updateTemplateElement(selectedElement.id, (element) => ({ ...element, ...updates } as TemplateTextElement));
  };

  const updateSelectedImageElement = (updates: Partial<TemplateImageElement>) => {
    if (!selectedElement || selectedElement.type !== 'image') {
      return;
    }
    updateTemplateElement(selectedElement.id, (element) => ({ ...element, ...updates } as TemplateImageElement));
  };

  const toggleSelectedFlag = (flag: 'locked' | 'hidden') => {
    if (selectedElements.length === 0) {
      return;
    }
    const shouldEnable = selectedElements.some((element) => !element[flag]);
    updateTemplateElements(selectedElementIds, (element) => ({ ...element, [flag]: shouldEnable }));
  };

  return (
    <section className="panel strip-panel">
      <div className="stats-row compact-stats-row strip-meta-row">
        <div>
          <span className="label">Active preset</span>
          <strong>{activePresetName ?? 'Unsaved custom design'}</strong>
        </div>
        <div>
          <span className="label">Saved presets</span>
          <strong>{presetCount}</strong>
        </div>
      </div>

      <div className="inline-actions wrap-actions editor-actions">
        <span className="editor-help">Drag, marquee-select, group, duplicate, copy/paste, and nudge elements with the arrow keys. Hold Shift for bigger nudges.</span>
        <div className="inline-actions wrap-actions">
          <button type="button" onClick={addTextElement}>Add text block</button>
          <button type="button" onClick={triggerAddImageElement}>Add logo / image</button>
          <button type="button" onClick={copySelection} disabled={selectedElementIds.length === 0}>Copy</button>
          <button type="button" onClick={pasteSelection} disabled={copiedElements.length === 0}>Paste</button>
          <button type="button" onClick={duplicateSelection} disabled={selectedElementIds.length === 0}>Duplicate</button>
          <button type="button" onClick={removeSelectedElements} disabled={selectedElementIds.length === 0}>Delete selected</button>
          <button type="button" onClick={resetLayout}>Reset layout</button>
        </div>
        <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => void handleImageElementUpload(event.target.files?.[0] ?? null)} />
      </div>

      <div className="editor-workspace-grid">
        <div className="strip-sheet preview-sheet" style={{ background: template.stripBackgroundColor, color: template.textColor }}>
          <div
            ref={editorRef}
            className="strip-layout-editor"
            style={{ width: `${previewWidth}px`, height: `${previewHeight}px`, backgroundColor: template.stripBackgroundColor, color: template.textColor }}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
            onPointerLeave={stopDrag}
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget) {
                return;
              }
              const additive = event.shiftKey || event.metaKey || event.ctrlKey;
              const startX = rawXFromClient(event.clientX, editorRef.current);
              const startY = rawYFromClient(event.clientY, editorRef.current);
              beginDrag({ kind: 'marquee', additive, startPointerX: startX, startPointerY: startY, initialSelection: additive ? selectedElementIds : [] }, event);
              if (!additive) {
                clearSelection();
              }
            }}
          >
            {template.backgroundImageDataUrl ? (
              <img
                src={template.backgroundImageDataUrl}
                alt="Template background"
                className={`editor-background editor-background-${template.backgroundSize}`}
                style={{ opacity: template.backgroundOpacity }}
              />
            ) : null}

            {snapGuides.vertical.map((guide) => (
              <div key={`v-${guide}`} className="snap-guide vertical" style={{ left: `${guide * previewWidth}px` }} />
            ))}
            {snapGuides.horizontal.map((guide) => (
              <div key={`h-${guide}`} className="snap-guide horizontal" style={{ top: `${guide * previewHeight}px` }} />
            ))}

            {template.showHeader ? (
              <>
                <DraggableText
                  label="Title"
                  text={title}
                  layout={layout.title}
                  previewHeight={previewHeight}
                  previewWidth={previewWidth}
                  fontSize={Math.max(18, template.titleFontSize * layout.title.fontScale * (previewWidth / dimensions.width))}
                  onPointerDown={(event) =>
                    beginDrag(
                      {
                        kind: 'move-text',
                        target: 'title',
                        offsetX: clamp((event.clientX - event.currentTarget.getBoundingClientRect().left) / previewWidth, 0, 0.6),
                        offsetY: clamp((event.clientY - event.currentTarget.getBoundingClientRect().top) / previewHeight, 0, 0.08)
                      },
                      event
                    )
                  }
                />
                <DraggableText
                  label="Subtitle"
                  text={subtitle}
                  layout={layout.subtitle}
                  previewHeight={previewHeight}
                  previewWidth={previewWidth}
                  fontSize={Math.max(13, template.subtitleFontSize * layout.subtitle.fontScale * (previewWidth / dimensions.width))}
                  onPointerDown={(event) =>
                    beginDrag(
                      {
                        kind: 'move-text',
                        target: 'subtitle',
                        offsetX: clamp((event.clientX - event.currentTarget.getBoundingClientRect().left) / previewWidth, 0, 0.6),
                        offsetY: clamp((event.clientY - event.currentTarget.getBoundingClientRect().top) / previewHeight, 0, 0.08)
                      },
                      event
                    )
                  }
                />
              </>
            ) : null}

            {layout.photoSlots.map((slot, index) => {
              const frame = toPreviewRect(slot, previewWidth, previewHeight);
              const photo = photos[index];
              return (
                <div
                  key={`slot-${index}`}
                  className="draggable-slot"
                  style={{
                    left: `${frame.x}px`,
                    top: `${frame.y}px`,
                    width: `${frame.width}px`,
                    height: `${frame.height}px`,
                    borderRadius: template.frameStyle === 'square' ? '0px' : `${template.cornerRadius}px`
                  }}
                  onPointerDown={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    beginDrag(
                      {
                        kind: 'move-slot',
                        index,
                        offsetX: clamp((event.clientX - rect.left) / previewWidth, 0, 0.95),
                        offsetY: clamp((event.clientY - rect.top) / previewHeight, 0, 0.95)
                      },
                      event
                    );
                  }}
                >
                  <span className="slot-label">Photo {index + 1}</span>
                  {photo ? <img src={photo.dataUrl} alt={`Shot ${index + 1}`} className="slot-image" /> : <span className="slot-placeholder">Drop zone</span>}
                  <div
                    className="resize-handle"
                    onPointerDown={(event) =>
                      beginDrag(
                        {
                          kind: 'resize-slot',
                          index,
                          anchorX: slot.x,
                          anchorY: slot.y
                        },
                        event
                      )
                    }
                  />
                </div>
              );
            })}

            {layout.elements.map((element, index) => {
              const frame = toPreviewRect(element, previewWidth, previewHeight);
              const isSelected = selectedElementIds.includes(element.id);
              return (
                <div
                  key={element.id}
                  className={`editor-element ${isSelected ? 'selected' : ''} ${element.hidden ? 'is-hidden' : ''} ${element.locked ? 'is-locked' : ''}`}
                  style={{
                    left: `${frame.x}px`,
                    top: `${frame.y}px`,
                    width: `${frame.width}px`,
                    height: `${frame.height}px`,
                    transform: `rotate(${element.rotation}deg)`,
                    zIndex: 20 + index
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
                    const elementSelection = resolveSelectionIds([element.id]);
                    const nextSelection = additive
                      ? (elementSelection.every((id) => selectedElementIds.includes(id)) ? selectedElementIds.filter((id) => !elementSelection.includes(id)) : Array.from(new Set([...selectedElementIds, ...elementSelection])))
                      : (elementSelection.every((id) => selectedElementIds.includes(id)) ? selectedElementIds : elementSelection);
                    setSelectedElementIds(nextSelection);
                    if (element.locked) {
                      return;
                    }
                    const activeIds = nextSelection.some((id) => elementSelection.includes(id)) ? nextSelection : elementSelection;
                    const movableIds = activeIds.filter((id) => {
                      const candidate = layout.elements.find((entry) => entry.id === id);
                      return candidate && !candidate.locked;
                    });
                    if (movableIds.length === 0) {
                      return;
                    }
                    const bounds = getSelectionBounds(layout.elements.filter((entry) => movableIds.includes(entry.id)));
                    beginDrag(
                      {
                        kind: 'move-elements',
                        elementIds: movableIds,
                        startPointerX: rawXFromClient(event.clientX, editorRef.current),
                        startPointerY: rawYFromClient(event.clientY, editorRef.current),
                        origins: Object.fromEntries(layout.elements.filter((entry) => movableIds.includes(entry.id)).map((entry) => [entry.id, { x: entry.x, y: entry.y }])),
                        bounds
                      },
                      event
                    );
                  }}
                >
                  <span className="slot-label">{element.type === 'text' ? 'Text' : 'Image'}</span>
                  {element.type === 'text' ? (
                    <div
                      className={`editor-text-element align-${element.align}`}
                      style={{
                        color: element.color,
                        fontSize: `${Math.max(12, element.fontSize * (previewWidth / dimensions.width))}px`,
                        fontWeight: element.fontWeight,
                        background: element.backgroundColor ?? 'transparent'
                      }}
                    >
                      {element.text}
                    </div>
                  ) : (
                    <img src={element.imageDataUrl} alt="Custom element" className={`editor-image-element fit-${element.fit}`} style={{ borderRadius: `${element.cornerRadius}px` }} />
                  )}
                  {!element.locked ? (
                    <div
                      className="resize-handle"
                      onPointerDown={(event) => {
                        setSelectedElementIds([element.id]);
                        beginDrag(
                          {
                            kind: 'resize-element',
                            elementId: element.id,
                            anchorX: element.x,
                            anchorY: element.y
                          },
                          event
                        );
                      }}
                    />
                  ) : null}
                </div>
              );
            })}

            {marqueeRect ? (
              <div
                className="selection-marquee"
                style={{
                  left: `${marqueeRect.x * previewWidth}px`,
                  top: `${marqueeRect.y * previewHeight}px`,
                  width: `${marqueeRect.width * previewWidth}px`,
                  height: `${marqueeRect.height * previewHeight}px`
                }}
              />
            ) : null}

            {template.showFooter ? (
              <DraggableText
                label="Footer"
                text="Built with React + Tauri starter"
                layout={layout.footer}
                previewHeight={previewHeight}
                previewWidth={previewWidth}
                fontSize={12 * layout.footer.fontScale}
                onPointerDown={(event) =>
                  beginDrag(
                    {
                      kind: 'move-text',
                      target: 'footer',
                      offsetX: clamp((event.clientX - event.currentTarget.getBoundingClientRect().left) / previewWidth, 0, 0.7),
                      offsetY: clamp((event.clientY - event.currentTarget.getBoundingClientRect().top) / previewHeight, 0, 0.08)
                    },
                    event
                  )
                }
              />
            ) : null}
          </div>

          {stripDataUrl ? <img src={stripDataUrl} alt="Composed photostrip preview" className="strip-preview-image" /> : <div className="empty-state">Captured photos will appear here. Current shots: {count}</div>}
        </div>

        <aside className="panel layer-panel">
          <h3>Layers</h3>
          <p className="helper-text">Reorder, lock, hide, rotate, align, distribute, and now multi-select custom elements. Shift-click to build a selection.</p>

          <div className="inline-actions wrap-actions toolbar-row">
            <button type="button" onClick={selectAllVisibleElements} disabled={layout.elements.length === 0}>Select all visible</button>
            <button type="button" onClick={clearSelection} disabled={selectedElementIds.length === 0}>Clear selection</button>
            <button type="button" onClick={groupSelection} disabled={selectedElementIds.length < 2}>Group</button>
            <button type="button" onClick={ungroupSelection} disabled={selectedElementIds.length === 0 || !selectedElements.some((element) => element.groupId)}>Ungroup</button>
          </div>

          <div className="layer-list">
            {layout.elements.length === 0 ? <div className="empty-state compact-empty">Add text or logo elements to start designing layers.</div> : null}
            {[...layout.elements].reverse().map((element) => {
              const originalIndex = layout.elements.findIndex((entry) => entry.id === element.id);
              const selected = selectedElementIds.includes(element.id);
              return (
                <button
                  key={element.id}
                  type="button"
                  className={`layer-item ${selected ? 'selected' : ''}`}
                  onClick={(event) => selectElement(element.id, event.shiftKey || event.metaKey || event.ctrlKey)}
                >
                  <span>{element.type === 'text' ? 'Text' : 'Image'} layer</span>
                  <span className="layer-badges">
                    {element.groupId ? <em>Grouped</em> : null}
                    {element.hidden ? <em>Hidden</em> : null}
                    {element.locked ? <em>Locked</em> : null}
                    <strong>#{originalIndex + 1}</strong>
                  </span>
                </button>
              );
            })}
          </div>

          {layout.elements.length >= 3 ? (
            <div className="selected-element-editor section-divider">
              <div>
                <span className="label">Quick spacing</span>
                <strong>{selectedElements.length >= 2 ? 'Distribute selected elements evenly' : 'Distribute all visible custom elements evenly'}</strong>
              </div>
              <div className="inline-actions wrap-actions toolbar-row">
                <button type="button" onClick={() => distributeElements('horizontal')}>Distribute horizontally</button>
                <button type="button" onClick={() => distributeElements('vertical')}>Distribute vertically</button>
              </div>
            </div>
          ) : null}

          {selectedElements.length > 0 ? (
            <div className="selected-element-editor">
              <div>
                <span className="label">Selection</span>
                <strong>{selectedElements.length === 1 ? (selectedElement?.type === 'text' ? 'Text block' : 'Image / logo') : `${selectedElements.length} elements selected`}</strong>
              </div>

              <div className="inline-actions wrap-actions toolbar-row">
                <button type="button" onClick={() => selectedElement && reorderElement(selectedElement.id, 'front')} disabled={!selectedElement}>Bring to front</button>
                <button type="button" onClick={() => selectedElement && reorderElement(selectedElement.id, 'forward')} disabled={!selectedElement}>Forward</button>
                <button type="button" onClick={() => selectedElement && reorderElement(selectedElement.id, 'backward')} disabled={!selectedElement}>Backward</button>
                <button type="button" onClick={() => selectedElement && reorderElement(selectedElement.id, 'back')} disabled={!selectedElement}>Send to back</button>
              </div>

              <div className="inline-actions wrap-actions toolbar-row">
                <button type="button" onClick={() => toggleSelectedFlag('locked')}>{selectedElements.every((element) => element.locked) ? 'Unlock' : 'Lock'}</button>
                <button type="button" onClick={() => toggleSelectedFlag('hidden')}>{selectedElements.every((element) => element.hidden) ? 'Show' : 'Hide'}</button>
              </div>

              <div className="inline-actions wrap-actions toolbar-row">
                <button type="button" onClick={() => applySelectedElementAlignment('left')}>Align left</button>
                <button type="button" onClick={() => applySelectedElementAlignment('center')}>Center</button>
                <button type="button" onClick={() => applySelectedElementAlignment('right')}>Align right</button>
                <button type="button" onClick={() => applySelectedElementAlignment('top')}>Top</button>
                <button type="button" onClick={() => applySelectedElementAlignment('middle')}>Middle</button>
                <button type="button" onClick={() => applySelectedElementAlignment('bottom')}>Bottom</button>
              </div>

              {selectedElement ? (
                <div className="settings-grid two-columns">
                  <label className="field-group">
                    Rotation
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={selectedElement.rotation}
                      onChange={(event) =>
                        updateTemplateElement(selectedElement.id, (element) => ({ ...element, rotation: Number(event.target.value) }))
                      }
                    />
                  </label>
                  <label className="field-group">
                    Degrees
                    <input
                      type="number"
                      min={-180}
                      max={180}
                      value={selectedElement.rotation}
                      onChange={(event) =>
                        updateTemplateElement(selectedElement.id, (element) => ({ ...element, rotation: clamp(Number(event.target.value) || 0, -180, 180) }))
                      }
                    />
                  </label>
                </div>
              ) : null}

              {selectedElement ? (selectedElement.type === 'text' ? (
                <div className="settings-grid three-columns">
                  <label className="field-group">
                    Text
                    <input value={selectedElement.text} onChange={(event) => updateSelectedTextElement({ text: event.target.value })} />
                  </label>
                  <label className="field-group">
                    Font size
                    <input
                      type="range"
                      min={12}
                      max={96}
                      step={1}
                      value={selectedElement.fontSize}
                      onChange={(event) => updateSelectedTextElement({ fontSize: Number(event.target.value) })}
                    />
                  </label>
                  <label className="field-group">
                    Text color
                    <input type="color" value={selectedElement.color} onChange={(event) => updateSelectedTextElement({ color: event.target.value })} />
                  </label>
                  <label className="field-group">
                    Font weight
                    <input
                      type="range"
                      min={300}
                      max={900}
                      step={100}
                      value={selectedElement.fontWeight}
                      onChange={(event) => updateSelectedTextElement({ fontWeight: Number(event.target.value) })}
                    />
                  </label>
                  <label className="field-group">
                    Align
                    <select value={selectedElement.align} onChange={(event) => updateSelectedTextElement({ align: event.target.value as TemplateTextElement['align'] })}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                  <label className="field-group">
                    Panel tint
                    <input
                      value={selectedElement.backgroundColor ?? ''}
                      placeholder="rgba(15,17,23,0.5)"
                      onChange={(event) => updateSelectedTextElement({ backgroundColor: event.target.value || undefined })}
                    />
                  </label>
                </div>
              ) : (
                <div className="settings-grid three-columns">
                  <label className="field-group">
                    Fit
                    <select value={selectedElement.fit} onChange={(event) => updateSelectedImageElement({ fit: event.target.value as TemplateImageElement['fit'] })}>
                      <option value="contain">Contain</option>
                      <option value="cover">Cover</option>
                      <option value="stretch">Stretch</option>
                    </select>
                  </label>
                  <label className="field-group">
                    Corner radius
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={selectedElement.cornerRadius}
                      onChange={(event) => updateSelectedImageElement({ cornerRadius: Number(event.target.value) })}
                    />
                  </label>
                  <div className="field-group">
                    <span className="label">Image source</span>
                    <button type="button" onClick={triggerAddImageElement}>Replace image</button>
                  </div>
                </div>
              )) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function DraggableText({
  label,
  text,
  layout,
  previewHeight,
  previewWidth,
  fontSize,
  onPointerDown
}: {
  label: string;
  text: string;
  layout: TextLayout;
  previewHeight: number;
  previewWidth: number;
  fontSize: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const left = layout.align === 'center' ? layout.x * previewWidth : layout.x * previewWidth;
  return (
    <div
      className={`draggable-text align-${layout.align}`}
      style={{ left: `${left}px`, top: `${layout.y * previewHeight}px`, fontSize: `${fontSize}px` }}
      onPointerDown={onPointerDown}
    >
      <span className="slot-label">{label}</span>
      {text}
    </div>
  );
}

function toPreviewRect(rect: { x: number; y: number; width: number; height: number }, previewWidth: number, previewHeight: number) {
  return {
    x: rect.x * previewWidth,
    y: rect.y * previewHeight,
    width: rect.width * previewWidth,
    height: rect.height * previewHeight
  };
}

function normalizeSelectionRect(startX: number, startY: number, endX: number, endY: number): LayoutRect {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  };
}

function rectsIntersect(a: LayoutRect, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function getSelectionBounds(elements: Array<{ x: number; y: number; width: number; height: number }>): LayoutRect {
  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const right = Math.max(...elements.map((element) => element.x + element.width));
  const bottom = Math.max(...elements.map((element) => element.y + element.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function getSnapTargets(elements: TemplateElement[], excludeIds: string[]) {
  const exclude = new Set(excludeIds);
  const vertical = [0, 0.5, 1];
  const horizontal = [0, 0.5, 1];

  elements.forEach((element) => {
    if (exclude.has(element.id) || element.hidden) {
      return;
    }
    vertical.push(element.x, element.x + element.width / 2, element.x + element.width);
    horizontal.push(element.y, element.y + element.height / 2, element.y + element.height);
  });

  return { vertical, horizontal };
}

function rawXFromClient(clientX: number, editor: HTMLDivElement | null) {
  if (!editor) return 0;
  const bounds = editor.getBoundingClientRect();
  return clamp((clientX - bounds.left) / bounds.width, 0, 1);
}

function rawYFromClient(clientY: number, editor: HTMLDivElement | null) {
  if (!editor) return 0;
  const bounds = editor.getBoundingClientRect();
  return clamp((clientY - bounds.top) / bounds.height, 0, 1);
}

function snapRectPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  targets: { vertical: number[]; horizontal: number[] } = { vertical: [0, 0.5, 1], horizontal: [0, 0.5, 1] }
) {
  const resultX = snapAxisPosition(clamp(x, 0, 1 - width), width, targets.vertical, [0, 1 - width]);
  const resultY = snapAxisPosition(clamp(y, 0, 1 - height), height, targets.horizontal, [0, 1 - height]);
  return {
    x: resultX.value,
    y: resultY.value,
    guides: {
      vertical: resultX.guides,
      horizontal: resultY.guides
    }
  };
}

function snapResizeRect(
  anchorX: number,
  anchorY: number,
  rawX: number,
  rawY: number,
  targets: { vertical: number[]; horizontal: number[] } = { vertical: [0.5, 1], horizontal: [0.5, 1] }
) {
  const widthResult = snapAxisResize(anchorX, rawX, targets.vertical);
  const heightResult = snapAxisResize(anchorY, rawY, targets.horizontal);
  return {
    width: widthResult.size,
    height: heightResult.size,
    guides: {
      vertical: widthResult.guides,
      horizontal: heightResult.guides
    }
  };
}

function snapPointPosition(x: number, y: number, minX: number, minY: number, maxX: number, maxY: number) {
  const resultX = snapScalar(clamp(x, minX, maxX), [minX, 0.5, maxX]);
  const resultY = snapScalar(clamp(y, minY, maxY), [minY, 0.5, maxY]);
  return {
    x: resultX.value,
    y: resultY.value,
    guides: {
      vertical: resultX.guides,
      horizontal: resultY.guides
    }
  };
}

function snapAxisPosition(value: number, size: number, targets: number[], positionRange: [number, number]) {
  const uniqueTargets = [...new Set(targets)];
  const candidates = uniqueTargets.flatMap((target) => ([
    { point: value, target, offset: 0 },
    { point: value + size / 2, target, offset: size / 2 },
    { point: value + size, target, offset: size }
  ]));

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestGuide: number | null = null;
  let bestSnappedValue = value;

  for (const candidate of candidates) {
    const distance = Math.abs(candidate.point - candidate.target);
    if (distance <= SNAP_THRESHOLD && distance < bestDistance) {
      bestDistance = distance;
      bestGuide = candidate.target;
      bestSnappedValue = candidate.target - candidate.offset;
    }
  }

  return {
    value: clamp(bestSnappedValue, positionRange[0], positionRange[1]),
    guides: bestGuide === null ? [] : [bestGuide]
  };
}

function snapAxisResize(anchor: number, pointer: number, targets: number[]) {
  const clamped = clamp(pointer, anchor + 0.06, 1);
  let snappedEdge = clamped;
  let bestDistance = Number.POSITIVE_INFINITY;
  const guides: number[] = [];

  for (const target of [...new Set(targets)]) {
    if (target < anchor + 0.06 || target > 1) {
      continue;
    }
    const distance = Math.abs(clamped - target);
    if (distance <= SNAP_THRESHOLD && distance < bestDistance) {
      snappedEdge = target;
      bestDistance = distance;
    }
  }

  if (bestDistance < Number.POSITIVE_INFINITY) {
    guides.push(snappedEdge);
  }

  return { size: clamp(snappedEdge - anchor, 0.06, 1 - anchor), guides };
}

function snapScalar(value: number, targets: number[]) {
  let nextValue = value;
  const guides: number[] = [];
  targets.forEach((target) => {
    if (Math.abs(value - target) <= SNAP_THRESHOLD) {
      nextValue = target;
      guides.push(target);
    }
  });
  return { value: nextValue, guides };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}
