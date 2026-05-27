# Contributing to Agent Skills

Thanks for your interest in contributing! Here's how to get involved.

## Adding a new skill

1. Create a directory under `skills/` with a descriptive kebab-case name.
2. Add a `SKILL.md` file with the standard frontmatter (see existing skills for reference).
3. Include any supporting scripts or references in subdirectories.
4. Update the root `README.md` skills table.

### Skill frontmatter

Every `SKILL.md` must include YAML frontmatter with at minimum:

```yaml
---
name: your-skill-name
description: >
  A concise description of what the skill does and when to use it.
compatibility: platforms, runtimes, and tools required
metadata:
  version: "1.0.0"
allowed-tools: list of tools the skill needs
---
```

## Submitting changes

1. Fork the repository and create a feature branch (`feat/your-feature`).
2. Make your changes — keep commits small and focused.
3. Ensure your skill's `SKILL.md` is well-documented and self-contained.
4. Open a pull request against `main` with a clear description of what the skill does.

## Guidelines

- **Keep skills generic** — avoid hardcoding project-specific URLs, paths, or credentials.
- **Be self-contained** — a skill should work by copying it into any compatible workspace.
- **Document thoroughly** — the `SKILL.md` is the primary interface; it should be complete enough for an agent (or human) to follow without external context.
- **Include examples** — template scripts, sample configs, or usage snippets help adoption.

## Reporting issues

Open an issue on GitHub with:
- The skill name (if applicable)
- What you expected vs. what happened
- Your environment (OS, Node version, tool versions)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold this standard.
