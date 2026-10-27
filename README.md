<div align="center">

# ⚡ L'CONQ — Moroccan National & Medical Concours Engine
### Production-Grade Pedagogical & SRS Examination Platform (2026/2027 Architecture)

[![Node.js Version](https://img.shields.io/badge/Node.js-v22-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![CI/CD Status](https://img.shields.io/badge/CI%2FCD-Passing-brightgreen?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <strong>L'CONQ</strong> is an advanced, offline-first exam simulation & spaced repetition system (SRS) engineered for Moroccan Medical School Concours (FMP/FMD/FAPH) and National Baccalaureate (SM / PC / SVT) excellence.
</p>

[Quickstart](#-quickstart-in-3-steps) • [Architecture](#-system-architecture) • [Features](#-core-capabilities) • [Contributing](#-contributing)

---

</div>

## 📐 System Architecture

L'CONQ implements a strict **Domain-Driven, Decoupled Clean Architecture** with offline-first resilient storage fallback:

```mermaid
graph TD
    Client[📱 Web & Mobile Client (React 19 + PWA)]
    Hook[⚡ Domain Hooks (useExamSession, useLesson)]
    Repo[🏛️ Domain Repository Layer (Zod Validation + Monadic Result)]
    
    subgraph Storage Tier
        SWR[(Memory SWR Cache)]
        Local[(Offline LocalStorage)]
        BackendAPI[🔌 Node API Engine (Port 3000 /api)]
        MySQL[(Hostinger MySQL / Cloud SQL)]
    end

    Client --> Hook
    Hook --> Repo
    Repo --> SWR
    SWR --> Local
    Repo --> BackendAPI
    BackendAPI --> MySQL
```

### Key Architectural Tenets
1. **Zero Runtime Boundary Leak**: All contracts and models are validated at boundaries using `Zod` schemas.
2. **Fail-Safe Monadic Results**: Business operations return `Result.ok(data)` or `Result.fail(err)` instead of uncaught exception bubbling.
3. **Optimistic Reactivity**: Student answers, bookmarks, and draft states update instantly with asynchronous synchronization.
4. **Moroccan Scoring Formula Engine**: Standardized grading algorithm (+1.00 correct, -0.25 error penalization, threshold-based admission classification).

---

## ✨ Core Capabilities

| Feature | Description | Status |
| :--- | :--- | :---: |
| **Interactive Concours Runner** | Timed simulation with hotkeys (`A-E`, `Arrows`, `B`), real-time penalty calculation, and topic heatmaps. | ✅ Ready |
| **PWA & Offline First** | Service Worker background caching, zero-network fallback, full local data persistence. | ✅ Ready |
| **LaTeX & KaTeX Rendering** | High-precision mathematical and physical formula typography with Arabic RTL support. | ✅ Ready |
| **OMR Scanner & Bubble Sheets** | Computer vision-based automatic grading for physical paper bubble sheets. | ✅ Ready |
| **Diagnostic Remediation** | Identifies student weak spots by axis (Analyse, Algèbre, Physique, etc.) with targeted drill recommendations. | ✅ Ready |
| **Multi-Tier Persistence** | Runs standalone on zero-config local JSON files, seamlessly scales to Cloud SQL / MySQL. | ✅ Ready |

---

## 🚀 Quickstart in 3 Steps

Get L'CONQ running in less than 60 seconds without configuring any external database:

### 1. Clone & Install
```bash
git clone https://github.com/cheikhzay-collab/GAMACO.git
cd GAMACO
npm install
```

### 2. Configure Environment (Optional)
```bash
cp .env.example .env
```
*(Default settings automatically run in Zero-Config Local Storage mode).*

### 3. Launch Development Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 🛠️ Production Build & Verification

```bash
# Type check and lint
npm run lint

# Compile optimized bundle
npm run build

# Start production server
npm run start
```

---

## 🛡️ Security & Observability

- **Centralized Telemetry**: Correlated structured logs with PII scrubbing (tokens and passwords automatically redacted).
- **CORS & Access Control**: Strict origin verification and header sanitization.
- **Content Security**: DOMPurify sanitization on all dynamic mathematical and rich-text markup.

---

## 🤝 Contributing

We welcome contributions from educators, students, and engineers! Please review our [CONTRIBUTING.md](./CONTRIBUTING.md) guide before submitting a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
