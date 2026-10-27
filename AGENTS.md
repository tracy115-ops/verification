# Repository Guidelines

## Project Structure & Module Organization

This enterprise verification project has an initial React / TypeScript workbench and Tauri / Rust CLI discovery shell. Start with `docs/README.md` and `docs/roadmap/development-plan.md` for implemented scope; architecture proposals are not all implemented.

- `.agents/skills/<skill-name>/SKILL.md`: skill entry points and workflow instructions.
- `.agents/skills/*/references/`: supporting documentation, including CSS architecture and design tokens. Some references are placeholders; verify content before relying on them.
- `.agents/skills/*/scripts/` and `assets/`: helper scripts and supporting assets. The current `aicoder-ui-pro` examples are placeholders.
- `.claude/skills/`: architecture, code quality, theme switching, and coding guidance.
- `.claude/settings.local.json`: local agent configuration.
- `docs/`: engineering constraints, product proposals, architecture decisions, workflow designs, and examples.
- `src/`: UI features, workflow domain checks, repository / IPC services, shared i18n, and layered styles.
- `crates/agent-runtime/`: CLI resolution and version-only probes; `src-tauri/`: desktop IPC shell.
- `tests/e2e/`: Playwright interactions; unit tests are colocated as `src/**/*.test.ts`.

Some legacy skill examples describe other applications. Verify paths and applicability before using them.

## Build, Test, and Development Commands

Run from the root. Use `npm.cmd` on Windows PowerShell if the `.ps1` entry is blocked; do not change the global execution policy.

- `npm ci`, `npm run dev`: install locked dependencies and start browser development.
- `npm run check`: Prettier, source limits, Vitest, TypeScript, and production build.
- `npm run test:e2e`: Playwright interactions; first install Chromium with `npx playwright install chromium`.
- `npm run tauri dev`: desktop development; stop a separately running dev server first.
- `cargo test -p agent-runtime --locked`: Rust tests; `cargo run -p agent-runtime --example probe --locked` only probes CLI versions.

## Coding Style & Naming Conventions

Use UTF-8, Prettier, two-space TypeScript indentation, strict typing, `camelCase` functions and `PascalCase` components. Rust uses rustfmt and Clippy. Preserve lowercase, hyphenated skill names and `SKILL.md`. Apply the UI and CSS architecture skills for UI changes.

## Mandatory Enterprise Constraints

- Each maintained source file must contain at most **2,000 physical lines**, including comments and blank lines; each function, method, or closure must span at most **200 physical lines**. Prefer files below 800 lines and functions below 80. Split by responsibility before exceeding limits; never compress code to evade them.
- Internationalization is required from the first feature: maintain `zh-CN` and `en-US` message keys, locale-aware dates/numbers/plurals, and stable language-neutral status/error codes. Do not hardcode user-facing strings or translate user source documents implicitly.
- Maintain a modular architecture with single responsibilities and one-way dependencies. Keep CLI drivers, Provider configuration, execution targets, and workflow nodes behind explicit interfaces; avoid provider-specific branches throughout business logic.
- Validate external and Agent-produced data at boundaries. Version workflow definitions, schemas, and artifacts. Preserve evidence and audit history; support timeouts, cancellation, recovery, and resource cleanup.
- Read [engineering constraints](docs/governance/engineering-constraints.md) before implementation. These project-specific limits govern conflicts with inherited examples; stricter small-function guidance remains a preferred target.

## Testing Guidelines

Use Vitest for domain / persistence contracts, Playwright for critical interactions, and Rust tests for discovery. Cover invalid graphs, corrupt imports, profile compatibility and failure paths. No numeric coverage threshold is established. Keep paid model calls and remote execution outside ordinary tests; version discovery does not certify authentication or inference. Validate documentation links and commands when editing guides.

## Commit & Pull Request Guidelines

Use concise imperative commit subjects with prefixes such as `docs:`, `feat:`, `fix:`, and `refactor:`. This is the initial repository convention, rather than a claim about earlier history. Example: `docs: define verification workflow architecture`.

Pull requests should explain the purpose, list affected skills, and report validation performed. Link relevant issues and include screenshots when changing visual examples.

## Security & Configuration

Keep credentials and machine-specific paths out of shared examples. Review local settings before sharing or committing them.
