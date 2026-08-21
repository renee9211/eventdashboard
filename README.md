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
- `report-generator-v1.js` — Post Event Report preview / report composition

### Feature styles
- `rsvp-manager-v3.css` — RSVP module styles (used by v4 manager)
- `cloud-media-v1.css` — Media module styles
- `survey-analysis-v1.css` — Survey module styles (used by v2 analyzer)
- `report-generator-v1.css` — Report preview styles

## Data flow

`Pre-event Plan → Event execution → Post-event Actual → Report Generator`

Shared datasets are reused instead of duplicated:
- RSVP → Attendance Result
- Collaterals Plan → Collaterals Actual
- Giveaway Plan → Giveaway Actual
- Event / Speaker / Agenda data → Report Generator

## Firebase

- Authentication: Google sign-in
- Firestore: projects + structured subcollections
- Storage: KV, speaker headshots, event highlights, actual photos
- Roles: Admin / Editor / Viewer

## Maintenance rule

Do not add another `v5`, `v6`, etc. file unless it is temporary migration work. Update the current active module or refactor it into a clearly named replacement, then remove the obsolete file once verified.

Git history is the backup for removed legacy files.
