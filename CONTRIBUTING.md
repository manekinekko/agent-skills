# Contributing to Agent Skills

Thanks for your interest in contributing! Here's how to get involved.

## Adding a new skill

1. Create a top-level directory with a descriptive kebab-case name (must match the `name` field in frontmatter).
2. Add a `SKILL.md` file with the required frontmatter (see existing skills for reference).
3. Include any supporting scripts, references, or assets in subdirectories.
4. Validate with `npx skills-ref validate ./your-skill-name`.
5. Update the root `README.md` skills table.

### Skill frontmatter

Every `SKILL.md` must include YAML frontmatter following the [Agent Skills specification](https://agentskills.io/specification):

```yaml
---
name: your-skill-name          # Required. Must match directory name. Lowercase + hyphens only.
description: >                 # Required. Max 1024 chars. Describe what it does AND when to use it.
  A concise description of what the skill does and when to use it.
compatibility: macOS or Linux, Node 18+   # Optional. Environment requirements.
metadata:                      # Optional. Arbitrary key-value pairs.
  version: "1.0.0"
allowed-tools: Bash(node:*) Read Write    # Optional. Pre-approved tools (experimental).
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
