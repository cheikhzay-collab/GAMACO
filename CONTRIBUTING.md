# Contributing to L'CONQ (GAMACO)

Thank you for your interest in contributing to **L'CONQ**! As an open-source platform dedicated to high-stakes exam preparation in Morocco, we hold our code, pedagogical content, and UI standards to the highest engineering bar.

---

## 🧭 Code of Conduct

- Be respectful, constructive, and inclusive.
- Keep pedagogical accuracy paramount when touching mathematical, chemical, or biological content.
- Protect user privacy and student performance metrics at all times.

---

## 🛠️ Development Workflow

### 1. Fork & Branch
- Fork the repository on GitHub.
- Create a feature branch with a descriptive name:
  ```bash
  git checkout -b feat/srs-adaptive-interval
  # or
  git checkout -b fix/omr-scanner-rotation
  ```

### 2. Standards & Guidelines (2026/2027)
- **Domain-Driven**: Business logic belongs in `/src/domain/`, not directly inside UI components.
- **Type & Schema Safety**: Use `zod` schemas in `/src/domain/schemas/` to validate all API boundaries and user inputs.
- **Design Tokens**: Follow Tailwind CSS classes and existing token variables (`--emerald`, `--violet`, `--navy-950`).
- **Mobile First**: All UI components must render flawlessly on viewports from 360px width upwards.

### 3. Verification Before Submitting
Ensure clean code compilation:
```bash
npm run lint
npm run build
```

---

## 📦 Pull Request Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new user-facing feature or pedagogical tool.
- `fix:` A bug fix in exam scoring, LaTeX rendering, or storage.
- `perf:` Performance optimization (reducing bundle size, latency).
- `refactor:` Code restructuring without behavior change.
- `docs:` Documentation updates.

---

## 🐛 Reporting Issues

Found a bug or have a suggestion? Open an issue using one of our GitHub templates:
- **Bug Report Template**: For reproducible glitches.
- **Feature Request Template**: For new exam features or pedagogical suggestions.
