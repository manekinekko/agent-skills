---
name: pr-review
description: >
  Review a pull request (peer review) and record findings as inline PR comments and tracking issues.
  Use this skill whenever reviewing, auditing, or giving feedback on a PR — including security audits,
  UX reviews, data-model/entity reviews, infrastructure/deployment reviews, API backward-compatibility
  and worker/queue reviews, CLI↔UI parity reviews, migration reversibility reviews, testing-quality
  reviews, and documentation-accuracy reviews. Triggers include "review this PR", "do a sec/security
  audit", "do a UX review", "review the data model", "do an infra review", "review the migration",
  "check CLI parity", "testing quality", "review the docs", "flag these as comments", or any request to
  comment on / open issues for a pull request.
compatibility: Any coding agent with shell access to the GitHub `gh` CLI and a local git checkout of the PR branch.
metadata:
  author: wassimchegham
  version: "1.1.0"
---

# PR Review

Structured, safe workflow for reviewing a pull request and recording findings. Encodes hard safety
rules learned the hard way, plus the reliable mechanics for posting inline comments and tracking issues.

---

## RULE 0 — NEVER MODIFY A BRANCH THAT ISN'T THE USER'S (non-negotiable)

A PR review is **read-only on the code**. When reviewing someone else's PR (peer review), the branch
belongs to the PR author, NOT to the user you're helping.

**You MUST NOT, under any circumstances:**
- `git commit` to the PR branch (or any branch that is not explicitly the user's own).
- `git push`, `git merge`, `git rebase`, `git reset` that rewrites shared state, or force-push.
- Write, edit, or create files in the repo working tree "to fix" a finding — even trivial one-line fixes,
  even a missing manifest, even when you're confident it's correct.

**This applies even when the user says "yes" to an offer that included "draft the fix".** "Draft" or
"suggest" a fix means: show the proposed change **as a suggestion in a PR comment** (a fenced diff or a
GitHub ```suggestion block), or describe it. It does **not** mean commit it to the branch.

If a fix genuinely needs to land in code, the correct paths are:
- Post it as a review comment / GitHub suggestion for the PR author to apply, OR
- Ask the user explicitly whether they want it on a **separate branch they own** (never the PR branch), and
  only proceed after a clear, specific yes.

Before ANY mutating git command during a review, STOP and re-read this rule. When in doubt, ask.

> Session note (why this rule exists): during a review the agent committed a "fix" (a missing IaC
> manifest) directly to the PR author's branch after the user said "yes" to an offer that bundled
> "draft the manifest". The user was rightly upset: "DO NEVER MAKE A COMMIT TO A BRANCH THAT DO NOT
> BELONG TO ME." The commit was local-only and was reverted with `git reset --hard HEAD~1`, but it
> should never have happened. Offers to the user must NOT bundle "commit/draft-in-code" with
> "post comments / open issues", because a single "yes" then gets read as consent to commit.

---

## RULE 1 — Only mutate GitHub state when the user says so

Posting inline comments, creating issues, and creating review drafts are all actions the user must
approve. Do the review/analysis first, present findings, and only post/create after an explicit "yes"
(or when the user said "flag these" / "post" / "open an issue"). Keep each offer scoped to
**non-code** actions (comments + issues), never bundled with code changes (see Rule 0).

---

## Workflow

### 1. Get oriented (read-only)
- Get a change overview first: merge-base, commit log, diff stat, changed files (via your agent's
  changes-overview tool if it has one, else the git commands below).
- Diff locally against the merge-base. **Do NOT use `gh pr diff`** (network) when a local worktree exists:
  ```bash
  git --no-pager diff --no-ext-diff --no-textconv <merge_base>..HEAD -- <path> | sed -n '1,240p'
  ```
- Read the key new/changed files (batch parallel reads). Note the PR number, repo `owner/repo`, and the
  pushed HEAD SHA — you need these to post comments.

### 2. Pick the right lens (and specialist)
- **Security audit** → if your agent has a dedicated read-only security-review sub-agent, delegate to it
  before investigating yourself. Give it the merge-base, the diff command, and a focused threat list
  (IDOR/access-control, injection, authz gaps, secrets, migration/race safety).
- **UX / data-model / infra / API / migration / testing / docs** reviews → do them yourself (or a
  read-only exploration sub-agent for large scope), reading the actual code.
- Multiple review types in one session: do them as separate passes, each with its own findings + offer.

### 3. Structure every review the same way
- **Strengths** — briefly, what's done well (specific, not flattery).
- **Findings** — numbered, each with: a `file:line` reference, severity/impact, and a concrete
  remediation. Separate **blocking bugs** from **non-blocking observations**.
- **Minor / nits** — grouped at the end.
- End with a **scoped offer** of non-code actions only: "Want me to post findings N as inline PR
  comments and/or open a tracking issue?" (never "…and commit the fix").

### 4. Post inline comments — mechanics that actually work
Some agents ship a built-in "add PR review comment" tool whose diff-line mapping is unreliable (it
rejects valid added lines with "No valid diff lines found"). **Reliable approach: post via the GitHub
REST API with `gh`.**

- Anchor on a line that is part of the PR diff, on the **pushed HEAD commit** (not any local commit):
  new files → every line is valid; modified files → prefer a `+`/added line, or a context line inside a hunk.
- Use `side=RIGHT` and the pushed HEAD SHA as `commit_id`:
  ```bash
  gh api --method POST /repos/<owner>/<repo>/pulls/<pr_number>/comments \
    -f commit_id=<pushed_head_sha> \
    -f path=<repo/relative/path> \
    -F line=<n> -f side=RIGHT \
    -f body='<comment text>' \
    --jq '.html_url'
  ```
- `-F line=<n>` (capital F) sends an integer; `-f` sends strings. Escape single quotes in the body.
- **Comment bodies with backticks, `$operators` (`$group`/`$match`/`$ne`), or apostrophes break
  single-quoted `-f body='…'` args (shell EOF / expansion errors). Reliable fix: write the body to a
  temp file with a quoted heredoc and pass `-F body=@/tmp/prc/finding.md`. Clean up the temp files after.**
  ```bash
  mkdir -p /tmp/prc
  cat > /tmp/prc/finding.md <<'EOF'
  **Finding.** Body with `code`, $group, and it's apostrophes — all safe here.
  EOF
  gh api --method POST /repos/<owner>/<repo>/pulls/<pr>/comments \
    -f commit_id=<sha> -f path=<path> -F line=<n> -f side=RIGHT -F body=@/tmp/prc/finding.md --jq '.html_url'
  rm -f /tmp/prc/finding.md
  ```
- Verify each call returns a `discussion_r...` URL.
- Multi-line comment: add `-F start_line=<n>` (and optional `-f start_side=RIGHT`).
- **422 "line must be part of the diff" / "could not be resolved":** the anchor is a context/unchanged
  line outside a hunk. Re-anchor to a `+`/added or context line that is actually inside a diff hunk
  (open the file's diff and pick a nearby changed line).
- **Editing a comment you already posted** (e.g. to add "Tracked in #NNNN"): 
  `gh api --method PATCH /repos/<owner>/<repo>/pulls/comments/<comment_id> -f body='…'` (or `-F body=@file`).
- If you made a local commit that shifts line numbers, compute anchors against the **pushed** SHA's
  version of the file, not your working tree.

### 5. Tracking issues
Create issues with `gh issue create` (or your agent's issue-creation tool if it renders a nicer
confirmation card). Cross-link the PR, the design issue, and any related in-flight PRs. Good issue body:
Context, Problem, Proposed resolution, Acceptance criteria, Related. **To add a comment to an existing
issue** (e.g. folding a related finding into an already-open issue instead of creating a new one):
`gh issue comment <n> --repo <owner>/<repo> --body-file <file>`. When the user says "fold finding X into
#NNNN", comment on that issue rather than opening a duplicate.

### 6. gh CLI usage
- Prefer `gh` for GitHub operations (comments, checks, review threads, issues).
- To edit a PR title/body, prefer the REST PATCH endpoint (`gh api --method PATCH /repos/<owner>/<repo>/pulls/<n>`)
  over `gh pr edit`, which uses GraphQL and can fail when the token isn't SAML/SSO-authorized for the org.

---

## Review-lens checklists

Use the relevant checklist(s) as the backbone of each pass. These are generic and reflect recurring
findings across reviews; adapt the specifics to the PR under review. Throughout, "scope key" means
whatever tenant/ownership dimension the system partitions data by (tenant id, org id, project id,
workspace id, account id, etc.).

### Security / access-control
- IDOR / broken isolation: every by-id and by-name/slug get/edit/delete filters by the primary key
  **or** the scope key — no global name/slug-only lookups. Opaque/random ids (e.g. UUIDs) are
  unguessable (acceptable for point reads); human-readable slugs must always be scoped.
- Child entities derive their scope key from the **parent**, never from a client-supplied field.
  Confirm the scope key appears on Response schemas but NOT on Create/Update **input** schemas.
- Cross-scope reference checks reject mixing entities from different scopes (return a conflict/403).
- NoSQL/query injection: scope/slug params are type-checked (`typeof === "string"`) so operator-object
  payloads like `?x[$ne]=` collapse to empty and fail closed rather than matching everything.
- Secrets: keyed/filtered by the full scope tuple, values masked on responses, internal ids masked.
- Integrity vs. exposure: a "unique constraint degraded to non-unique + app-level dedup" is a
  same-scope integrity/race concern, not cross-scope data exposure — classify severity accordingly.
- Note pre-existing, app-wide gaps (e.g. missing auth middleware) as observations, not as
  newly-introduced vulns; tie them to any in-flight remediation PR.

### UX (web / client)
- Don't overload the logo / "home" affordance with destructive context resets (e.g. silently clearing
  the selected scope). Home should be safe.
- Route guards: scoped pages gated so they never fire a scope-less request; but detail-by-id routes that
  stay ungated can (a) leave the surrounding nav empty and (b) render an entity from a different scope
  than the active selection — recommend auto-adopting the entity's scope on load.
- Pickers/switchers: search or pagination past a small threshold; never flash a raw id as a label
  while loading — use a skeleton/"Loading…".
- Reuse shared forms across entry points so behavior can't drift; action labels must reflect the real
  effect (e.g. "Create & switch" when it also changes scope).
- Cache hygiene: reset (not just invalidate) scope-dependent query caches on scope switch to avoid
  showing the previous scope's data.

### Data model / entities
- Referential integrity: a client-supplied scope id used on writes should be validated to reference an
  existing, non-deleted parent — otherwise you can create orphans. A bare-string foreign key has no
  database guarantee on its own.
- Single source of truth for the scope: a store shouldn't take the scope id from both a constructor
  field AND a create-input field that can diverge (dedup runs in one scope, the row lands in another).
- Fail-closed: scoped stores/queries should require the scope and error when it's missing, not silently
  operate globally.
- Identity taxonomy: watch for many different "human reference key" field names (`id`/`slug`/`ref`/`key`)
  and collections holding both legacy rows (`_id === humanKey`) and new rows (`_id === opaque id`) — every
  lookup must handle both (`$or: [{ slug }, { _id: slug }]`); confirm backfills make the legacy branch
  pure defense-in-depth, and that the taxonomy is documented.

### Infrastructure / deployment
- New persistent resource (DB collection/table/bucket/queue) ⇒ new IaC declaration. Check the repo's
  infra manifests and any "adding a resource" contract in the folder README. A resource created only
  implicitly at runtime (e.g. a migration's `createIndex`) drifts outside IaC (no managed
  throughput/limits, not reproducible in a fresh environment).
- Migration gating: if a readiness probe hard-gates on "required migrations applied", a heavy backfill
  keeps new instances NotReady until it finishes — rollout completion is gated (usually no downtime via
  rolling update, but can be hours). Flag it.
- Backfill scalability: helpers that buffer **all** matching ids in memory risk OOM under the migration
  job's memory limit on the largest datasets; check row counts vs. limit; conservative pacing (small
  batch + long delay) may make the gated window very long.
- Idempotency/resume: backfills filtered on `{ field: { $exists: false } }` (or equivalent) resume
  safely across retries — verify.
- Removing a resource: confirm **both** halves — drop it in the migration AND remove its IaC
  manifest/registration; sanity-check the ordering vs. the infra reconcile loop.
- Managed-DB index/constraint quirks: some engines only allow unique indexes at empty/creation time and
  reject later modification with a specific error code/message. Helpers that degrade to non-unique +
  app-level dedup should match that error **by code/message** so real auth/permission failures still surface.

### API backward-compatibility / worker & queue path
- Contract changes: a param that becomes **required** (e.g. list/submit endpoints now hard-requiring a
  `?scope=` and returning 400 without it) is a breaking change for existing clients. Confirm it's
  intentional, documented, and versioned; check whether point-reads keep an optional/legacy fallback.
- End-to-end scope threading: when a request enqueues async work, trace the scope key all the way
  through the queue message → worker → any downstream service calls. A value that's `undefined` when
  interpolated into a URL/query (`?scope=${scopeId}` → literal `"undefined"`) silently corrupts the call.
- Fail-open vs. fail-closed in workers/evaluators: decide deliberately. Falling back to a **global**
  dataset when the scope is absent can leak or mis-evaluate across scopes — usually workers should
  fail closed and error, matching the API's own fail-fast stance.
- Serialization compatibility: removed/renamed fields on messages already sitting in a queue must still
  deserialize (or be drained first). Check for in-flight messages produced by the old code.

### CLI ↔ UI parity
- If the project asserts CLI/UI parity, every capability added to one must exist in the other. New
  scoping/selection behavior in the UI needs an equivalent CLI mechanism (flag + env var + persisted
  selection) and vice-versa.
- Fail-closed consistency: the CLI should refuse scope-less scoped commands the same way the API/UI do
  (a `requireScope()` that errors cleanly and exits non-zero), not silently hit a global endpoint.
- Precedence is explicit and documented: typically per-invocation flag > env var > persisted selection,
  with "no default" and a clear error when nothing resolves. Point reads / by-id mutations need no scope.
- Shared option helpers: reuse one `--scope`/option builder across commands so behavior can't drift.

### Migration reversibility
- `down()` must not lose data written by `up()`. A `down()` that unsets a field with a broad filter can
  orphan or corrupt rows created **after** the migration under the new schema — reason about the state
  produced by up→(new writes)→down, not just up→down on untouched data.
- Duplicate/constraint hard-fails: a migration that asserts uniqueness can hard-fail on legacy data that
  already contains duplicates; decide whether to fail loudly (safer) or reconcile, and document it.
- Idempotency & resume across retries: re-running a partially-applied migration should converge, not
  double-apply. Filter on the "not yet migrated" predicate.
- Memory/throughput: see Infrastructure — buffering all ids, unbounded batch sizes, or missing pacing.

### Testing quality
- Contract vs. implementation: strong tests assert the observable contract (isolation, status codes,
  error shapes), not internal calls. Note when coverage is real vs. superficial.
- Fakes vs. real dependencies: hand-rolled in-memory fakes for a DB can pass while the real engine
  behaves differently (index semantics, operator handling, error codes). Flag where an integration test
  against the real (or an emulator) dependency is warranted.
- Tests that encode a bug: a test asserting current (buggy) behavior locks the bug in. If you flag a
  bug elsewhere, check whether a test cements it and call that out too.
- Coverage gaps that matter: error/fail-closed paths, the `down()`/rollback path, cross-scope negative
  cases, and empty/`undefined` scope inputs.

### Documentation accuracy
- Docs must match shipped behavior: verify command signatures, flags, and option names against the
  actual code (e.g. a documented `create <name>` positional when the command really uses `--name`).
- Completeness: command/option/endpoint tables must list everything that shipped — subcommands added in
  the PR but missing from the table are doc drift (especially bad where the repo asserts parity).
- Cross-references resolve: check that anchors/links (e.g. an `AGENTS.md` callout linking a heading) point
  to a heading that actually exists; verify the generated anchor (lowercase, spaces→hyphens, punctuation
  removed).
- Removed vs. deprecated wording: if the PR fully removes a field/collection, docs shouldn't still call it
  "deprecated" — confirm the wording matches the actual lifecycle stage.
- New major feature ⇒ docs updated: env vars documented, data-model/architecture doc reflects new
  entities and invariants. A large feature with only incidental doc edits is worth flagging.

---

## Quick DO / DON'T

DO:
- Keep the review read-only on code; post findings as comments and issues **after** approval.
- Start from a change overview + local diffs against the merge-base; delegate security audits to a
  read-only security-review sub-agent when your agent has one.
- Post inline comments via `gh api …/pulls/<n>/comments` (RIGHT side, pushed HEAD SHA); verify each
  returns a discussion URL.
- Give `file:line` + severity + concrete fix; separate blocking vs. non-blocking.

DON'T:
- ❌ Commit, push, or edit files on a branch that isn't the user's — ever, not even a "tiny fix".
- ❌ Bundle "draft/commit the fix" into the same offer as "post comments / open issues".
- ❌ Treat a "yes" to a bundled offer as consent to modify code — confirm code changes separately and
  only on a branch the user owns.
- ❌ Use `gh pr diff` when a local worktree exists; ❌ use `gh pr edit`/GraphQL (SAML failures).
