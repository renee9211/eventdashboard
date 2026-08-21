# Event Project Report System

活動專案從 Pre-event Plan、Post-event Actual 到 Post Event Report 的管理系統。

## Current architecture

### Core
- `index.html` — App shell、navigation、templates、module loading
- `app.js` — 基礎 project workspace 與主要 view renderer
- `bootstrap-v2.js` — Firebase Auth、roles、Firestore load/save sync
- `firebase.js` — Firebase initialization and exports
- `style.css` — Global UI styles
- `storage.rules` — Firebase Storage permissions

### Feature modules
- `pre-event-v2.js` — Pre-event readiness、Agenda / Speaker schema enhancements
- `plan-workflow.js` — Collaterals / Giveaway Plan → Actual workflow
- `rsvp-manager-v4.js` — RSVP import、attendance、batch edit、Type management
- `cloud-media-v1.js` — Firebase Storage image uploads and Event Highlights
- `survey-analysis-v2.js` — RAW DATA survey parsing and analysis
- `report-template-shell-v1.js` — Report Template view shell
- `report-template-manager-v1.js` — PPTX / POTX upload、Open XML analysis、layout mapping
- `pptx-export.js` — Current editable PPTX exporter; will be replaced by template-driven output path
- `report-generator-v1.js` — Post Event Report preview / report composition

### Feature styles
- `rsvp-manager-v3.css` — RSVP module styles (used by v4 manager)
- `cloud-media-v1.css` — Media module styles
- `survey-analysis-v1.css` — Survey module styles (used by v2 analyzer)
- `report-template-manager-v1.css` — Template Manager styles
- `report-generator-v1.css` — Report preview styles

## Data flow

`Pre-event Plan → Event execution → Post-event Actual → Template Mapping → Report Generator`

Shared datasets are reused instead of duplicated:
- RSVP → Attendance Result
- Collaterals Plan → Collaterals Actual
- Giveaway Plan → Giveaway Actual
- Event / Speaker / Agenda data → Report Generator

## Template-driven report architecture

The report generator is moving from a hard-coded PowerPoint layout to a client-template workflow.

1. Upload a client `.pptx` or `.potx` in **Report Template**.
2. The browser reads the PowerPoint Open XML package with JSZip.
3. The system records slide size, theme name, major/minor fonts, theme colors, slide layouts, shape names and placeholders.
4. The system recommends a layout mapping for report sections.
5. The user confirms the mapping once; the mapping is stored with the project/template metadata.
6. Generate Report will use the stored template profile and mapping for editable PPTX output.

Current mapping keys:
- Cover
- Event Summary
- RSVP Summary
- Agenda
- Speakers
- Event Highlights (2 / 3 / 4 photo variants)
- Deco & Collaterals
- Giveaway
- Questionnaire Analysis
- Recap & Evaluation

This architecture is client-neutral: HPE is the first template, but Nokia, NVIDIA and other client templates can use the same data model without hard-coded client-specific report code.

## Firebase

- Authentication: Google sign-in
- Firestore: projects + structured subcollections
- Storage: KV, speaker headshots, event highlights, actual photos, report templates
- Roles: Admin / Editor / Viewer

## Maintenance rule

Do not add another `v5`, `v6`, etc. file unless it is temporary migration work. Update the current active module or refactor it into a clearly named replacement, then remove the obsolete file once verified.

Git history is the backup for removed legacy files.
