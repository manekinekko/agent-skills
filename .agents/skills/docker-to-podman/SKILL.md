---
name: docker-to-podman
description: >
  Migrate a macOS (Apple Silicon) developer machine from Docker Desktop to Podman
  while keeping the `docker` and `docker compose` commands working. Use this skill when:
  (1) the user wants to uninstall Docker Desktop and switch to Podman,
  (2) a `docker`/`docker compose`/`docker-compose` workflow breaks after removing Docker Desktop
  (e.g. "cannot connect to the Docker API at .../.docker/run/docker.sock", "no such file or directory"),
  (3) macOS Keychain popups appear on every registry entry from `docker-credential-osxkeychain`,
  (4) a compose build dies with "exit status 137" (OOM) under Podman,
  (5) Podman keeps returning "connection refused" / "unable to connect to Podman socket" right after start.
  It captures the exact failure signatures, root causes, and fixes for a clean Docker Desktop -> Podman cutover.
compatibility: macOS 12+ on Apple Silicon (arm64), Podman 5.x installed via the official installer (/opt/podman), Homebrew
metadata:
  version: "1.0.0"
allowed-tools: Bash(docker:*) Bash(podman:*) Bash(brew:*) Bash(ls:*) Bash(cat:*) Bash(grep:*) Bash(pgrep:*) Bash(sudo:*) Read Write Edit
---

# Docker Desktop → Podman migration (macOS / Apple Silicon)

Use this skill to move a developer off Docker Desktop and onto Podman **without**
rewriting their scripts. The goal is that `docker`, `docker compose`, and
`docker-compose` all keep working, now backed by a Podman machine.

Podman is a drop-in replacement for the Docker CLI on macOS, but the cutover has
five sharp edges. Each has a distinct error signature. Diagnose by signature, then
apply the matching fix — don't guess.

## Golden rule: always inspect before you change

Before touching anything, capture the current state so you know what you're
migrating from and can verify afterwards:

```bash
docker context ls 2>&1            # which socket is active
docker context show 2>&1
echo "DOCKER_HOST=$DOCKER_HOST"    # env override wins over context
ls -la /var/run/docker.sock 2>&1   # what the compat socket points at
podman machine list 2>&1           # is a Podman VM present / running
pgrep -fl "Docker Desktop|com.docker|podman|vfkit|gvproxy" 2>&1
```

Key mental model: on macOS the `docker` CLI talks to a **socket**, and which
socket is chosen is decided (in priority order) by `DOCKER_HOST`, then the active
`docker context`. Podman's `podman-mac-helper` symlinks
`/var/run/docker.sock` -> the running Podman machine, so the `default` context
"just works" once Podman is up.

---

## Symptom 1 — "cannot connect to the Docker API at .../.docker/run/docker.sock"

```
failed to connect to the docker API at unix:///Users/<you>/.docker/run/docker.sock;
check if the path is correct and if the daemon is running:
dial unix .../.docker/run/docker.sock: connect: no such file or directory
```

**Root cause:** The active `docker context` is still `desktop-linux`, whose
endpoint is `unix://.../.docker/run/docker.sock`. That socket only exists while
**Docker Desktop is running**. Docker Desktop is stopped (or uninstalled), so the
path is gone. Meanwhile the real daemon is Podman on `/var/run/docker.sock`.

**Fix — switch the context to `default`** (which uses `/var/run/docker.sock` ->
Podman via `podman-mac-helper`):

```bash
docker context use default
docker context show      # => default
docker ps                # should list your Podman containers
```

If the tool that failed reads `DOCKER_HOST` directly instead of the context, also
export it:

```bash
export DOCKER_HOST=unix:///var/run/docker.sock
```

Verify the Podman socket actually answers before moving on:

```bash
DOCKER_HOST=unix:///var/run/docker.sock docker ps
podman ps        # should show the same containers
```

---

## Uninstalling Docker Desktop cleanly

Only do this once Podman is confirmed working (Symptom 1 resolved). The
uninstall **breaks the `docker` command**, because on a Docker Desktop install
`/usr/local/bin/docker` is a symlink into `/Applications/Docker.app`. You must
re-point it at Podman afterwards (see below).

```bash
# 1. Official uninstaller (removes helpers, launchd jobs, most symlinks)
sudo /Applications/Docker.app/Contents/MacOS/uninstall

# 2. Remove the app bundle
sudo rm -rf /Applications/Docker.app

# 3. User-level leftovers
rm -rf ~/Library/Group\ Containers/group.com.docker \
       ~/Library/Containers/com.docker.docker \
       ~/Library/Application\ Support/Docker\ Desktop \
       ~/Library/Preferences/com.docker.docker.plist \
       ~/Library/Logs/Docker\ Desktop \
       ~/.docker/desktop
```

### Gotcha: "operation not permitted" during uninstall

```
Error: unlinkat ~/Library/Containers/com.docker.docker/.com.apple.containermanagerd.metadata.plist:
operation not permitted
```

This file is protected by macOS's container manager and **cannot be removed even
with sudo** while the OS holds it. This does **not** mean the uninstall failed —
it usually completed everything else first. Verify what actually got removed:

```bash
ls -ld /Applications/Docker.app 2>&1                 # should be gone
ls -la /usr/local/bin/docker 2>&1                    # symlink likely already removed
ls /Library/PrivilegedHelperTools/ | grep -i docker  # helpers should be gone
```

Finish any stragglers manually:

```bash
sudo launchctl bootout system/com.docker.socket 2>/dev/null
sudo rm -f /Library/PrivilegedHelperTools/com.docker.socket
sudo rm -rf /Applications/Docker.app
```

The protected `~/Library/Containers/com.docker.docker` dir is empty and harmless.
Remove it later via **reboot then `rm -rf`**, or by granting the terminal **Full
Disk Access**, or just leave it.

### Re-point `docker` (and clean dangling plugin symlinks) at Podman

The uninstaller deletes the `docker` symlink (it pointed into Docker.app). Restore
a working `docker` command backed by Podman:

```bash
sudo ln -sf /opt/podman/bin/podman /usr/local/bin/docker
docker version   # Client + Server should both say "Podman Engine"
```

`~/.docker/cli-plugins/` is typically full of **dangling symlinks** into the now
deleted Docker.app (`docker-compose`, `docker-buildx`, `docker-scout`, ...).
Podman ignores them, but clean them up:

```bash
ls -la ~/.docker/cli-plugins/            # all point into /Applications/Docker.app
rm -f ~/.docker/cli-plugins/*
```

For `docker compose` (subcommand form) keep a standalone Compose binary on PATH —
Podman auto-detects it as an "external compose provider":

```bash
docker compose version
# >>>> Executing external compose provider "/usr/local/bin/docker-compose" ... <<<<
# Docker Compose version v...
```

---

## Symptom 2 — Keychain popups on every registry / "executable file not found: docker-credential-osxkeychain"

Two related failures come from `~/.docker/config.json` containing
`"credsStore": "osxkeychain"`:

**2a. Helper missing after uninstall:**

```
error getting credentials - err: exec: "docker-credential-osxkeychain":
executable file not found in $PATH
```

The helper was a symlink into Docker.app and vanished. Reinstall the standalone
one (it reads the same Keychain entries):

```bash
brew install docker-credential-helper
which docker-credential-osxkeychain      # => /opt/homebrew/bin/...
```

**2b. Endless "wants to use your confidential information" popups:**

macOS Keychain binds each stored item to the **exact binary** that created it.
Your credentials were created by Docker Desktop's helper; the new Homebrew binary
is different, so the Keychain re-prompts for **every** registry entry (dozens of
popups if you have many `*.azurecr.io` / registry logins).

Two choices — **ask the user which trade-off they want**:

- **Stop using Keychain (zero popups, creds sit base64 in `config.json`):** remove
  `credsStore`. Best when the config has no real secrets or the user accepts
  file-stored tokens.
- **Keep Keychain (more secure, one "Always Allow" click per registry now):** leave
  `credsStore` and click through the prompts once to re-grant the new binary.

To stop the popups, remove `credsStore` (and the dead Docker Desktop
`plugins`/`features` hooks) from `~/.docker/config.json`. Back it up first:

```bash
cp ~/.docker/config.json ~/.docker/config.json.bak.$(date +%Y%m%d%H%M%S)
```

Then remove the keys. Note the file may be **root-owned** after the sudo uninstall
steps — if so, delete-and-rewrite works because the parent dir is user-writable:

```bash
python3 - <<'PY'
import json, os, pathlib
p = pathlib.Path.home()/".docker/config.json"
cfg = json.loads(p.read_text())
for k in ("credsStore", "credHelpers", "plugins", "features"):
    cfg.pop(k, None)
data = json.dumps(cfg, indent=2) + "\n"
os.remove(p)              # needs dir write, not file write -> bypasses root-owned file
p.write_text(data)
os.chmod(p, 0o600)
print("cleaned; auths kept:", len(cfg.get("auths", {})))
PY
```

After this, registries are anonymous by default. For any **private** registry the
build actually needs, log in once (token now writes base64 to `config.json`, no
popup):

```bash
az acr login --name <registry>          # Azure Container Registry
# or
docker login <registry>                 # any registry
```

---

## Symptom 3 — compose build dies with "exit status 137"

```
building at STEP "RUN pnpm install --frozen-lockfile": while running runtime: exit status 137
Error: executing /usr/local/bin/docker-compose ... up --build --watch: exit status 1
```

**Root cause:** `137 = 128 + 9 (SIGKILL)` = the **kernel OOM-killed** the build
step. The Podman machine has far less RAM than Docker Desktop used to give the VM.
A fresh `podman machine` defaults to **2 GiB**, which is not enough for parallel
image builds running memory-hungry installs (`pnpm install`, `npm ci`, `webpack`,
`tsc`, Rust/Go builds).

Check the VM's current allocation vs. host RAM:

```bash
sysctl -n hw.memsize | awk '{printf "host: %.0f GB\n", $1/1024/1024/1024}'
podman machine inspect podman-machine-default \
  | python3 -c "import sys,json;r=json.load(sys.stdin)[0]['Resources'];print('VM: CPUs',r['CPUs'],'Mem',r['Memory'],'MB')"
```

**Fix — raise the machine's memory** (and optionally CPUs). This requires a
stop/set/start cycle, which also **stops running containers** — restart them after.
Pick a size that's generous but safe on the host (e.g. ~1/3 of host RAM):

```bash
podman machine stop
podman machine set --memory 12288      # 12 GiB; also: --cpus 8 --disk-size 100
podman machine start
```

> ⚠️ **Start the machine from the user's own terminal, not from an ephemeral
> agent shell** — see Symptom 4. If you (the agent) run `podman machine start` and
> your shell session is then torn down, it kills `vfkit` and the VM dies seconds
> later.

Verify:

```bash
podman machine inspect podman-machine-default \
  | python3 -c "import sys,json;print('Mem MB:', json.load(sys.stdin)[0]['Resources']['Memory'])"
podman machine ssh 'free -h'
```

Containers with `restart: unless-stopped` do **not** always come back after a
machine reconfigure — restart them explicitly:

```bash
docker ps -a --format '{{.Names}}\t{{.Status}}'
docker start <container> <container> ...
```

---

## Symptom 4 — "unable to connect to Podman socket ... connection refused" right after start

```
Cannot connect to Podman. Please verify your connection ... `podman system connection list` ...
Error: unable to connect to Podman socket: failed to connect:
dial tcp 127.0.0.1:<port>: connect: connection refused
```

The machine reports it started, then dies within seconds. The gvproxy log gives it
away:

```bash
tail -15 "$(ls -t /var/folders/*/*/T/podman/gvproxy.log 2>/dev/null | head -1)"
# cannot receive packets from .../vfkit-*.sock, disconnecting: ... use of closed network connection
# gvproxy exiting: signal caught
```

**Root cause:** `vfkit` (the Apple `virtualization.framework` hypervisor) and
`gvproxy` are **children of the shell that ran `podman machine start`.** If that
shell is short-lived — for example an **AI agent's ephemeral command session that
is discarded when the command returns** — its process group is reaped on teardown,
taking `vfkit` down with it. The VM then vanishes and every client gets
`connection refused`.

**Fix — start the Podman machine from a persistent, interactive process.** In
practice this means **the user's own terminal**, the same one they run
`pnpm`/`docker compose` in:

```bash
podman machine start
# wait for: Machine "podman-machine-default" started successfully
docker ps          # must respond, no "connection refused"
```

Agents: do **not** try to keep the VM alive yourself. `setsid` is not available on
macOS, and detached background tricks from an agent shell are unreliable here.
Instead, **hand the one-line `podman machine start` back to the user** and verify
read-only afterwards:

```bash
podman machine list                       # State should stay "running"
pgrep -fl vfkit || echo "VM is down"      # vfkit must be alive
```

### Make it durable — auto-start on login (optional, recommended)

So the user never has to babysit the VM, register the machine to start at login.
Podman ships a helper for this:

```bash
podman machine start           # ensure it's up first (from the user's terminal)
# Podman 5.x: enable the per-user launchd/systemd startup unit
podman machine set --now       # applies pending config immediately
```

If the installed Podman doesn't wire login-start automatically, a minimal
LaunchAgent that runs `podman machine start` at login is a reliable fallback (the
user's `launchd` session is persistent, unlike an agent shell).

---

## Symptom 5 — a specific container won't restart (orphaned bind mount)

```
Error: unable to start container "<id>": crun: cannot stat
`/.../some/removed/path/mosquitto.conf`: No such file or directory:
OCI runtime attempted to invoke a command that was not found
```

Not a migration bug. The container has a **bind mount to a path that no longer
exists** (e.g. a deleted git worktree). Distinguish it from real migration
failures and either recreate it from its compose project or remove the orphan:

```bash
docker rm <container>          # drop the stale container; compose will recreate it
```

---

## End-to-end verification checklist

Run after the full migration; every line should succeed:

- [ ] `docker version` → Client **and** Server both "Podman Engine".
- [ ] `docker ps` → lists containers, no socket error.
- [ ] `docker compose version` → resolves the external compose provider.
- [ ] `docker-compose version` → standalone binary works.
- [ ] `ls -ld /Applications/Docker.app` → **No such file or directory**.
- [ ] `ls /Library/PrivilegedHelperTools/ | grep -i docker` → nothing.
- [ ] `grep credsStore ~/.docker/config.json` → gone (if popups were the issue).
- [ ] `podman machine inspect ... Resources.Memory` → the raised value (e.g. 12288).
- [ ] `pgrep -fl vfkit` → alive **and stays alive** after your agent shell exits.
- [ ] `podman machine list` → State `running` (from the user's terminal).
- [ ] The original failing command (e.g. `pnpm docker:dev:copilot`) now builds.

## Anti-patterns

- ❌ Uninstalling Docker Desktop **before** confirming Podman answers on
  `/var/run/docker.sock` — you strand yourself with no working `docker`.
- ❌ Forgetting to re-create `/usr/local/bin/docker` → Podman after uninstall
  (`docker: command not found`).
- ❌ Treating "operation not permitted" on `.com.apple.containermanagerd.metadata.plist`
  as a fatal uninstall failure — it isn't; the rest completed.
- ❌ Leaving `credsStore: osxkeychain` in place with a mismatched helper binary →
  a storm of Keychain popups.
- ❌ Bumping compose parallelism to fix `exit 137` instead of raising VM memory —
  the container was OOM-killed, not rate-limited.
- ❌ **Starting `podman machine` from an ephemeral/agent shell** and expecting it to
  survive — `vfkit` dies with the parent process. Always start from the user's
  persistent terminal.
- ❌ Force-killing processes by name (`pkill vfkit`) instead of `podman machine stop`
  — leaves the machine state inconsistent.
