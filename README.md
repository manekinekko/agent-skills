# Agent Skills

A curated collection of reusable [Agent Skills](https://agentskills.io) for everyday use.

Each skill follows the [Agent Skills specification](https://agentskills.io/specification) and works with any compatible agent (GitHub Copilot, Claude Code, Cursor, Gemini CLI, and [more](https://agentskills.io/clients)).

## Skills

| Skill | Description |
|-------|-------------|
| [ux-walkthrough-recording](./ux-walkthrough-recording/) | Produce reviewer-ready UX walkthrough videos and per-screen screenshots for a running web app |

## Installation

Install any skill into your project with `npx`:

```bash
npx skills-ref install github:manekinekko/agent-skills/ux-walkthrough-recording
```

This copies the skill into your project's `.agents/skills/` directory where agents can discover it.

### Verify

```bash
npx skills-ref validate .agents/skills/ux-walkthrough-recording
```

## Repository structure

```
agent-skills/
├── ux-walkthrough-recording/   # Each skill is a top-level directory
│   ├── SKILL.md                # Required: metadata + instructions
│   └── scripts/                # Optional: executable code
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE
└── README.md
```

Each skill directory is self-contained and follows the [spec directory structure](https://agentskills.io/specification):
- `SKILL.md` — Required. YAML frontmatter (`name`, `description`) + markdown instructions.
- `scripts/` — Optional. Executable code agents can run.
- `references/` — Optional. Additional documentation loaded on demand.
- `assets/` — Optional. Templates, images, data files.

## Compatibility

Skills in this repo are tested with:
- [GitHub Copilot](https://github.com/features/copilot) (VS Code agent mode)
- [Claude Code](https://claude.ai/code)
- [Cursor](https://cursor.com/)

They should work with any client that supports the [Agent Skills format](https://agentskills.io/clients).

## License

[MIT](./LICENSE)
