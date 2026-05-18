import React from "react";
import { AWB } from "../constants/Theme.jsx";

const RISK_CONFIG = {
  low: {
    className: "risk-low",
    label: "Risque Faible",
    desc: "Dossier conforme, aucune anomalie détectée.",
  },
  medium: {
    className: "risk-medium",
    label: "Risque Moyen",
    desc: "Quelques incohérences nécessitent une vérification.",
  },
  high: {
    className: "risk-high",
    label: "Risque Élevé",
    desc: "Anomalies critiques — revue humaine obligatoire.",
  },
};

const STROKE_COLOR = {
  low: "#2E7D46",
  medium: "#C9A84C",
  high: AWB.red,
};

export default function RiskGauge({ score, level }) {
  const config = RISK_CONFIG[level] || RISK_CONFIG.low;
  const strokeColor = STROKE_COLOR[level] || AWB.red;

  return (
    <div className="risk-gauge">
      <div style={{ position: "relative", display: "inline-block" }}>
        <svg width="100" height="60" viewBox="0 0 100 60">
          <path
            d="M10,50 A40,40 0 0,1 90,50"
            fill="none"
            stroke={AWB.grayMid}
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M10,50 A40,40 0 0,1 90,50"
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 125.6} 125.6`}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <div className={`risk-score ${config.className}`}>{score}</div>
        </div>
      </div>
      <div className={`risk-label ${config.className}`}>{config.label}</div>
      <div className="risk-desc">{config.desc}</div>
    </div>
  );
}