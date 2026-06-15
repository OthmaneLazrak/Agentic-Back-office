import React, { useEffect, useRef, useState } from "react";
import { AWB } from "../constants/Theme.jsx";

// Couleur par classe (cycle).
const COLORS = ["#F5A800", "#1D4ED8", "#15803D", "#B91C1C", "#7C3AED", "#0891B2", "#DB2777"];
const colorOf = (classes, cls) => COLORS[Math.max(0, classes.indexOf(cls)) % COLORS.length];

/**
 * Annotateur de boîtes : image + overlay SVG. Une boîte (max) par classe.
 * - clic sur une classe = la sélectionner
 * - glisser le corps = déplacer ; glisser le coin = redimensionner
 * - "Dessiner" = tracer la boîte de la classe active sur l'image
 * - "Supprimer" = retirer la boîte de la classe active
 * Les boîtes sont en COORDONNÉES PIXELS D'ORIGINE. onChange({classe:[x1,y1,x2,y2]}).
 */
export default function BoxAnnotator({ imageUrl, imageSize, initialBoxes, classes, onChange }) {
  const imgRef = useRef(null);
  const svgRef = useRef(null);
  const boxesRef = useRef({ ...(initialBoxes || {}) });
  const dragRef = useRef(null);

  const [boxes, setBoxes] = useState({ ...(initialBoxes || {}) });
  const [natural, setNatural] = useState(
    imageSize && imageSize[0] ? { w: imageSize[0], h: imageSize[1] } : null);
  const [renderW, setRenderW] = useState(0);
  const [active, setActive] = useState(classes[0]);
  const [drawMode, setDrawMode] = useState(false);

  // Re-sync si on change de dossier.
  useEffect(() => {
    boxesRef.current = { ...(initialBoxes || {}) };
    setBoxes(boxesRef.current);
    setDrawMode(false);
  }, [initialBoxes]);

  useEffect(() => { if (!classes.includes(active)) setActive(classes[0]); }, [classes, active]);

  // Largeur rendue (pour l'échelle) — au chargement et au redimensionnement fenêtre.
  useEffect(() => {
    const onResize = () => imgRef.current && setRenderW(imgRef.current.clientWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const scale = natural && renderW ? renderW / natural.w : 1;
  const renderH = natural ? natural.h * scale : 0;

  const apply = (next) => { boxesRef.current = next; setBoxes(next); onChange && onChange(next); };

  const onImgLoad = (e) => {
    if (!natural) setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    setRenderW(e.target.clientWidth);
  };

  const toOrig = (clientX, clientY) => {
    const r = svgRef.current.getBoundingClientRect();
    return [(clientX - r.left) / scale, (clientY - r.top) / scale];
  };
  const clamp = (v, max) => Math.max(0, Math.min(max, v));

  const startMove = (e, cls) => {
    e.stopPropagation();
    setActive(cls);
    const [x, y] = toOrig(e.clientX, e.clientY);
    const b = boxesRef.current[cls];
    dragRef.current = { mode: "move", cls, ox: b[0], oy: b[1], w: b[2] - b[0], h: b[3] - b[1], gx: x, gy: y };
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const startResize = (e, cls) => {
    e.stopPropagation();
    setActive(cls);
    const b = boxesRef.current[cls];
    dragRef.current = { mode: "resize", cls, x1: b[0], y1: b[1] };
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const onBgDown = (e) => {
    if (!drawMode || !natural) return;
    const [x, y] = toOrig(e.clientX, e.clientY);
    dragRef.current = { mode: "draw", cls: active, x0: clamp(x, natural.w), y0: clamp(y, natural.h) };
    svgRef.current.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    const d = dragRef.current;
    if (!d || !natural) return;
    const x = clamp(toOrig(e.clientX, e.clientY)[0], natural.w);
    const y = clamp(toOrig(e.clientX, e.clientY)[1], natural.h);
    let box;
    if (d.mode === "draw") {
      box = [Math.min(d.x0, x), Math.min(d.y0, y), Math.max(d.x0, x), Math.max(d.y0, y)];
    } else if (d.mode === "move") {
      const nx = clamp(d.ox + (x - d.gx), natural.w - d.w);
      const ny = clamp(d.oy + (y - d.gy), natural.h - d.h);
      box = [nx, ny, nx + d.w, ny + d.h];
    } else { // resize
      box = [d.x1, d.y1, Math.max(d.x1 + 5, x), Math.max(d.y1 + 5, y)];
    }
    apply({ ...boxesRef.current, [d.cls]: box.map(Math.round) });
  };
  const onUp = () => {
    if (dragRef.current?.mode === "draw") setDrawMode(false);
    dragRef.current = null;
  };

  const removeActive = () => {
    if (!boxesRef.current[active]) return;
    const next = { ...boxesRef.current };
    delete next[active];
    apply(next);
  };

  if (!imageUrl) return null;

  return (
    <div className="annot">
      <div className="annot-toolbar">
        {classes.map((cls) => (
          <button
            key={cls}
            className={`annot-chip ${active === cls ? "active" : ""} ${boxes[cls] ? "has" : "missing"}`}
            style={{ "--c": colorOf(classes, cls) }}
            onClick={() => setActive(cls)}
            title={boxes[cls] ? "Boîte présente" : "Aucune boîte"}
          >
            {cls}{!boxes[cls] && " ∅"}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          className={`btn-outline ${drawMode ? "active" : ""}`}
          onClick={() => setDrawMode((v) => !v)}
          style={{ padding: "4px 10px", fontSize: 11 }}
        >
          {drawMode ? `Tracer « ${active} »…` : "Dessiner"}
        </button>
        <button
          className="btn-outline"
          onClick={removeActive}
          disabled={!boxes[active]}
          style={{ padding: "4px 10px", fontSize: 11 }}
        >
          Supprimer
        </button>
      </div>

      <div className="annot-stage" style={{ position: "relative", width: "100%", maxWidth: natural ? natural.w : "100%" }}>
        <img ref={imgRef} src={imageUrl} alt="document" onLoad={onImgLoad}
             style={{ width: "100%", display: "block", borderRadius: 8, border: `1px solid ${AWB.slate200}` }} />
        {natural && renderW > 0 && (
          <svg
            ref={svgRef}
            width={renderW} height={renderH}
            style={{ position: "absolute", top: 0, left: 0, touchAction: "none", cursor: drawMode ? "crosshair" : "default" }}
            onPointerDown={onBgDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            {classes.filter((c) => boxes[c]).map((cls) => {
              const [x1, y1, x2, y2] = boxes[cls];
              const c = colorOf(classes, cls);
              const isA = cls === active;
              return (
                <g key={cls}>
                  <rect
                    x={x1 * scale} y={y1 * scale}
                    width={(x2 - x1) * scale} height={(y2 - y1) * scale}
                    fill={isA ? `${c}22` : "transparent"} stroke={c}
                    strokeWidth={isA ? 2.5 : 1.5}
                    style={{ cursor: "move" }}
                    onPointerDown={(e) => startMove(e, cls)}
                  />
                  <text x={x1 * scale + 3} y={y1 * scale - 4} fill={c} fontSize="11" fontWeight="700">{cls}</text>
                  {/* poignée de redimensionnement (coin bas-droit) */}
                  <rect
                    x={x2 * scale - 6} y={y2 * scale - 6} width={12} height={12}
                    fill={c} style={{ cursor: "nwse-resize" }}
                    onPointerDown={(e) => startResize(e, cls)}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
