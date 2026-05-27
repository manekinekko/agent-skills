# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainer directly or use GitHub's
[private vulnerability reporting](https://github.com/manekinekko/agent-skills/security/advisories/new).

## Scope

Since this repository contains agent skill definitions (markdown and template scripts),
security concerns are most likely to involve:

- Script injection via template files
- Credential leakage in skill documentation or examples
- Unintended command execution patterns in `allowed-tools` declarations

## Response

I will acknowledge receipt within 72 hours and aim to provide a fix or mitigation
within 7 days for confirmed vulnerabilities.
