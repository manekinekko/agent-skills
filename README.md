# Agent Skills

_A curated collection of personal [Agent Skills](https://agentskills.io) I use in my daily workflows._

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)

[Skills](#skills) • [Installation](#installation) • [Usage](#usage)

This repository hosts a set of reusable skills for AI coding agents (Claude Code, Codex, GitHub Copilot, Cursor, OpenCode, and many others). Each skill packages procedural knowledge, references, and sometimes scripts to help an agent perform a specific task reliably and consistently.

## Skills

| Skill | Description |
|-------|-------------|
| [`screen-capture`](./.agents/skills/screen-capture/SKILL.md) | Produce reviewer-ready UX walkthrough videos and per-screen screenshots for a running web app |

## Installation

These skills are designed to be installed with the [`skills`](https://github.com/vercel-labs/skills) CLI, which works with [50+ agents](https://github.com/vercel-labs/skills#supported-agents) including Claude Code, Codex, GitHub Copilot, Cursor, and OpenCode.

### Install everything

Install all skills from this repository into the current project:

```bash
npx skills add manekinekko/agent-skills
```

Or install them globally (available across all your projects):

```bash
npx skills add manekinekko/agent-skills -g
```

### Install a single skill

Pick only the ones you need:

```bash
npx skills add manekinekko/agent-skills --skill screen-capture
```

### Browse before installing

```bash
npx skills add manekinekko/agent-skills --list
```

> **Note:** The `skills` CLI installs skills into the convention expected by each target agent (e.g. `.claude/skills/` for Claude Code, `~/.copilot/skills/` for Copilot CLI). See the [CLI README](https://github.com/vercel-labs/skills#installation-scope) for the full list of locations.

## Usage

Once installed, your agent will automatically discover the skills and trigger them when the conversation matches a skill's `description`. You don't need to invoke them manually — just describe what you want and the agent will pick the right skill.

A few examples:

- _"Record a walkthrough of the new UI"_ → triggers [`screen-capture`](./.agents/skills/screen-capture/SKILL.md)
- _"Capture screenshots for the PR"_ → triggers [`screen-capture`](./.agents/skills/screen-capture/SKILL.md)
- _"Make a demo video of the app"_ → triggers [`screen-capture`](./.agents/skills/screen-capture/SKILL.md)

> **Tip:** Most coding agents also support invoking skills with slash commands (e.g. `/screen-capture`).

## License

All skills in this repository are licensed under the [MIT License](./LICENSE).
