# Frontend Development Guidelines - KYC Back-Office Project

## Role and Objective
You are acting as a Lead Frontend Developer and UI/UX expert. 
The objective is to improve and maintain a professional "Enterprise Back-Office" React/Vite web interface for banking process automation (KYC, document verification). The generated code must be production-ready and meet professional supervision standards.

## Design System & UI/UX (Attijariwafa Bank Theme)
The interface must inspire trust, security, and efficiency.
- **Primary Colors:** 
  - Deep Navy Blue (e.g., `slate-900` or similar hex) for the sidebar and main text.
  - Institutional Orange/Mustard for accents, headers, or secondary action buttons.
- **Typography:** Clean sans-serif (Inter, Roboto). Strict visual hierarchy.
- **Layout:** Use Split-Pane views. Forms and documents on the left, AI analysis results (LangGraph Agent / Vision Models) on the right.
- **User Feedback:** Avoid blocking "white" loading states. Consistently use animated *Skeleton Loaders* for asynchronous calls.

## Technical Stack & Architecture (React + Vite)
- **Components:** Exclusively use Functional Components and Hooks (useState, useEffect, useCallback).
- **Structure:** Respect the current modular structure (`components/`, `pages/`, `styles/`, `constants/`).
- **Styling:** [Specify here if you are using Tailwind CSS, CSS Modules, or styled-components]. Keep CSS/styling isolated and maintainable. No inline styles (except for dynamic variables).

## Artificial Intelligence Integration (Human-in-the-Loop)
The interface serves as an intermediary between the human and complex AI models (Field extraction, YOLOv8, Agents).
- **Data Rendering:** Extracted data (First Name, Last Name, ID Numbers) must be displayed in editable fields to allow for human validation.
- **Confidence Scores:** Any data originating from the AI must be accompanied by a visual reliability indicator:
  - 🟢 Green: Confidence > 95%
  - 🟠 Orange: Confidence between 80% and 95% (Requires attention)
  - 🔴 Red: Confidence < 80% (Requires manual correction)
- **Risk Gauge:** The `RiskGauge.jsx` component must react dynamically to the cross-referenced document results.

## Code Generation Rules (Strict)
1. **Do not break existing code:** Before modifying a major file like `KYCPage.jsx`, analyze its dependencies thoroughly.
2. **Modularity:** If a file exceeds 150 lines, propose extracting the logic into sub-components (e.g., `DocumentDropzone.jsx`, `AIResultsPanel.jsx`).
3. **Robustness:** Systematically add error handling (try/catch on API calls) and visual feedback (Toast notifications).
4. **Clean Code:** Use explicit variables in English (e.g., `extractedData`, `isUploading`), and provide concise comments for complex logic.