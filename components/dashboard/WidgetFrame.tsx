"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

type Props = {
  title: string;
  children: ReactNode;
  onExportCsv?: () => void;
  extra?: ReactNode;
  defaultW?: number;
  defaultH?: number;
};

export function WidgetFrame({
  title,
  children,
  onExportCsv,
  extra,
  defaultW = 100,
  defaultH = 22,
}: Props) {
  const [full, setFull] = useState(false);
  const [size, setSize] = useState({ w: defaultW, h: defaultH });
  const box = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const drag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (!full) return;
    const node = dialog.current;
    if (!node) return;
    if (!node.open) node.showModal();
    const focusFrame = window.requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (node.open) node.close();
      returnFocus.current?.focus();
    };
  }, [full]);

  function openFullScreen() {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setFull(true);
  }

  function startResize(e: PointerEvent<HTMLButtonElement>) {
    const el = box.current;
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  }

  function moveResize(e: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    const parent = box.current?.parentElement;
    if (!start || !parent) return;
    const dw = ((e.clientX - start.x) / parent.clientWidth) * 100;
    const dh = (e.clientY - start.y) / 16;
    setSize({
      w: Math.min(100, Math.max(40, start.w + dw)),
      h: Math.min(56, Math.max(14, start.h + dh)),
    });
  }

  function endResize(e: PointerEvent<HTMLButtonElement>) {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function resizeWithKeyboard(e: KeyboardEvent<HTMLButtonElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    setSize((current) => ({
      w: Math.min(
        100,
        Math.max(40, current.w + (e.key === "ArrowRight" ? 4 : e.key === "ArrowLeft" ? -4 : 0)),
      ),
      h: Math.min(
        56,
        Math.max(14, current.h + (e.key === "ArrowDown" ? 2 : e.key === "ArrowUp" ? -2 : 0)),
      ),
    }));
  }

  function exportPng() {
    const svg = box.current?.querySelector("svg");
    if (!svg) return;
    downloadSvgAsPng(svg, `${title.replace(/\s+/g, "-").toLowerCase()}.png`);
  }

  function exportCsv() {
    if (!onExportCsv) return;
    const approved = window.confirm(
      `Export “${title}” as CSV? The file may contain sensitive finance data.`,
    );
    if (approved) onExportCsv();
  }

  const actions = (forLightbox: boolean) => (
    <div className="widget-frame-actions">
      {extra}
      {onExportCsv ? (
        <button type="button" onClick={exportCsv}>
          Export CSV
        </button>
      ) : null}
      <button type="button" onClick={exportPng}>
        Export PNG
      </button>
      <button
        ref={forLightbox ? closeButton : undefined}
        type="button"
        onClick={() => (forLightbox ? setFull(false) : openFullScreen())}
      >
        {forLightbox ? "Close" : "Full screen"}
      </button>
    </div>
  );

  return (
    <>
      <article
        ref={box}
        className="widget-frame"
        style={{ width: `${size.w}%`, minHeight: `${size.h}rem` }}
      >
        <header className="widget-frame-head">
          <h3>{title}</h3>
          {actions(false)}
        </header>
        <div className="widget-frame-body">{children}</div>
        <button
          type="button"
          className="resize-handle"
          aria-label="Resize widget"
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onKeyDown={resizeWithKeyboard}
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
          title="Drag to resize, or use arrow keys"
        />
      </article>
      {full ? (
        <dialog
          ref={dialog}
          className="lightbox"
          aria-label={title}
          onCancel={(event) => {
            event.preventDefault();
            setFull(false);
          }}
        >
          <div className="lightbox-card">
            <header className="widget-frame-head">
              <h3>{title}</h3>
              {actions(true)}
            </header>
            <div className="lightbox-body">{children}</div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}

export function downloadCsv(filename: string, rows: { label: string; value: number }[]): void {
  const lines = ["label,value", ...rows.map((r) => `${JSON.stringify(r.label)},${r.value}`)];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadSvgAsPng(svg: SVGElement, filename: string): void {
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, img.width);
    canvas.height = Math.max(1, img.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#10141a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (!png) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(png);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };
  img.src = url;
}
