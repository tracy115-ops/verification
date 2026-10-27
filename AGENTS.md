# Repository Guidelines

## Project Structure & Module Organization

This enterprise verification Agent project is in its design phase. It currently has no application source tree, dependency manifest, or test suite. Start with `docs/README.md` for the architecture and implementation plan; proposed directories in design documents are not implemented features.

- `.agents/skills/<skill-name>/SKILL.md`: skill entry points and workflow instructions.
- `.agents/skills/*/references/`: supporting documentation, including CSS architecture and design tokens. Some references are placeholders; verify content before relying on them.
- `.agents/skills/*/scripts/` and `assets/`: helper scripts and supporting assets. The current `aicoder-ui-pro` examples are placeholders.
- `.claude/skills/`: architecture, code quality, theme switching, and coding guidance.
- `.claude/settings.local.json`: local agent configuration.
- `docs/`: engineering constraints, product proposals, architecture decisions, workflow designs, and examples.

Paths such as `src/` and `src-tauri/` mentioned inside guidance describe the target application; those directories are absent here.

## Build, Test, and Development Commands

No build, development server, package installation, or automated test commands are configured. Use these PowerShell commands from the workspace root to inspect contributions:

- `rg --files --hidden`: list files, including hidden skill directories.
- `Get-Content -Encoding UTF8 .agents/skills/<skill-name>/SKILL.md`: read a skill before changing it.
- `Get-Content -Raw .claude/settings.local.json | ConvertFrom-Json | Out-Null`: validate local configuration JSON without printing its contents.

## Coding Style & Naming Conventions

Write UTF-8 Markdown with descriptive headings and fenced examples. Preserve lowercase, hyphenated skill directory names and the entry filename `SKILL.md`. Python uses four-space indentation and `snake_case`; proposed TypeScript uses two spaces, strict typing, and `camelCase` functions / `PascalCase` components. No formatter or linter is configured yet.

## Mandatory Enterprise Constraints

- Each maintained source file must contain at most **2,000 physical lines**, including comments and blank lines; each function, method, or closure must span at most **200 physical lines**. Prefer files below 800 lines and functions below 80. Split by responsibility before exceeding limits; never compress code to evade them.
- Internationalization is required from the first feature: maintain `zh-CN` and `en-US` message keys, locale-aware dates/numbers/plurals, and stable language-neutral status/error codes. Do not hardcode user-facing strings or translate user source documents implicitly.
- Maintain a modular architecture with single responsibilities and one-way dependencies. Keep CLI drivers, Provider configuration, execution targets, and workflow nodes behind explicit interfaces; avoid provider-specific branches throughout business logic.
- Validate external and Agent-produced data at boundaries. Version workflow definitions, schemas, and artifacts. Preserve evidence and audit history; support timeouts, cancellation, recovery, and resource cleanup.
- Read [engineering constraints](docs/governance/engineering-constraints.md) before implementation. These project-specific limits govern conflicts with inherited examples; stricter small-function guidance remains a preferred target.

## Testing Guidelines

No testing framework, coverage threshold, or test naming convention is established. For documentation changes, check relative links, paths, front matter, and command examples. For functional helper changes, document prerequisites and verify representative inputs and failure cases. Placeholder scripts do not demonstrate application correctness.

## Commit & Pull Request Guidelines

Use concise imperative commit subjects with prefixes such as `docs:`, `feat:`, `fix:`, and `refactor:`. This is the initial repository convention, rather than a claim about earlier history. Example: `docs: define verification workflow architecture`.

Pull requests should explain the purpose, list affected skills, and report validation performed. Link relevant issues and include screenshots when changing visual examples.

## Security & Configuration

Keep credentials and machine-specific paths out of shared examples. Review local settings before sharing or committing them.
