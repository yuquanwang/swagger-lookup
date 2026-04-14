# swagger-lookup

An AI agent skill for fetching, caching, and selectively querying large Swagger/OpenAPI 2.0 JSON docs without exceeding context limits.

## Problem

Large Swagger specs (e.g. 1000+ endpoints, multi-MB JSON) blow up the context window when fetched directly. This skill caches the full spec locally and provides filtered queries by controller/tag, path, or keyword — with full `$ref` resolution.

## Install

```bash
# Claude Code
npx skills add https://github.com/yuquanwang/swagger-lookup

# Codex
npx skills add https://github.com/yuquanwang/swagger-lookup --provider codex

# OpenCode
npx skills add https://github.com/yuquanwang/swagger-lookup --provider opencode
```

## Usage

### 1. Fetch and cache

```bash
node <skill-dir>/swagger-lookup.js fetch --curl "curl -s 'https://your-api/v2/api-docs?group=all' -H 'Cookie: ...'"
```

`<skill-dir>` is the directory where this skill was installed. The agent resolves this automatically.

### 2. Query

```bash
node <skill-dir>/swagger-lookup.js tags                                          # List all controllers
node <skill-dir>/swagger-lookup.js get --tags "UserController,DepartmentController"  # Filter by controller
node <skill-dir>/swagger-lookup.js get --path "/api/v1/users"                    # Filter by path
node <skill-dir>/swagger-lookup.js search "employee"                             # Search keywords
node <skill-dir>/swagger-lookup.js models --tags "UserController"                # Get referenced DTOs only
node <skill-dir>/swagger-lookup.js summary                                       # API overview
```

## Commands

| Command | Purpose |
|---------|---------|
| `fetch --curl "curl ..."` | Download and cache swagger JSON |
| `tags` | List all controllers/tags with endpoint counts |
| `summary` | Show API overview (title, version, counts) |
| `get --tags "Tag1,Tag2"` | Get paths + resolved DTOs for specific controllers |
| `get --path "/api/v1/users"` | Get specific path detail (partial match) |
| `search "keyword"` | Search across paths, summaries, operationIds |
| `models --tags "Tag1"` | Get only the DTO definitions referenced by a tag |

## Features

- **Fuzzy tag matching** — `--tags "user"` matches `UserController`, `user-management-controller`, etc.
- **`$ref` resolution** — output includes all referenced DTO/model definitions, not just `$ref` pointers
- **Zero dependencies** — pure Node.js, no npm install needed
- **Large file support** — handles specs up to 100MB
- **Agent-agnostic** — works with Claude Code, Codex, OpenCode, or any agent that can run shell commands

## How it works

Once installed, the agent automatically discovers this skill. In conversation:

> "Here's my curl: `curl -s 'https://...' -H '...'`, show me the UserController endpoints"

The agent will:
1. Run `fetch --curl "..."` to cache the spec
2. Run `get --tags "User"` to filter
3. Return the matching endpoints with full DTO definitions

Subsequent queries in the same session reuse the cache.

## Cache

The swagger JSON is cached at `.swagger-cache/api-docs.json` in the current working directory. Re-run `fetch` when the API changes. Add `.swagger-cache/` to `.gitignore`.

## License

MIT
