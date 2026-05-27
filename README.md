# Agent Skills

A curated collection of reusable agent skills for everyday use.

## Skills

| Skill | Description |
|-------|-------------|
| [ux-walkthrough-recording](./skills/ux-walkthrough-recording/) | Produce reviewer-ready UX walkthrough videos and per-screen screenshots for a running web app |

## Installation

Each skill lives in its own directory under `skills/` and contains a `SKILL.md` file with full instructions, plus any supporting scripts or references.

### Option 1: Clone and symlink (recommended)

Clone this repo once, then symlink individual skills into your project:

```bash
# Clone the repo (once)
git clone https://github.com/manekinekko/agent-skills.git ~/agent-skills

# Symlink a skill into your project
ln -s ~/agent-skills/skills/ux-walkthrough-recording .agents/skills/ux-walkthrough-recording
```

This keeps skills up to date with a simple `git pull` in the cloned repo.

### Option 2: Copy into your project

Copy the skill directory directly into your project's `.agents/skills/` folder:

```bash
cp -r ~/agent-skills/skills/ux-walkthrough-recording .agents/skills/
```

### Option 3: Git submodule

Add this repo as a submodule if you want version-pinned skills tracked in your project's git history:

```bash
git submodule add https://github.com/manekinekko/agent-skills.git .agents/vendor/agent-skills
ln -s .agents/vendor/agent-skills/skills/ux-walkthrough-recording .agents/skills/ux-walkthrough-recording
```

### Verify installation

After installing, confirm the skill is discoverable:

```
.agents/
└── skills/
    └── ux-walkthrough-recording/
        ├── SKILL.md
        └── scripts/
            ├── screenshots.template.mjs
            └── walkthrough.template.mjs
```

## License

MIT
