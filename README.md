# swagger-lookup

Fetch, cache, and selectively query large Swagger/OpenAPI 2.0 JSON docs without exceeding context limits.

## Problem

Large Swagger specs (e.g. 1000+ endpoints, multi-MB JSON) blow up the context window when fetched directly. This tool caches the full spec locally and provides filtered queries by controller/tag, path, or keyword — with full `$ref` resolution.

## Install

```bash
# Option 1: npx (no install needed)
npx swagger-lookup tags

# Option 2: global install
npm install -g swagger-lookup
swagger-lookup tags

# Option 3: clone and run directly
git clone https://github.com/yuquanwang/swagger-lookup.git
node swagger-lookup/swagger-lookup.js tags
```

## Usage

### 1. Fetch and cache

```bash
swagger-lookup fetch --curl "curl -s 'https://your-api/v2/api-docs?group=all' -H 'Cookie: ...'"
```

Or via environment variable:

```bash
export SWAGGER_CURL="curl -s 'https://your-api/v2/api-docs?group=all' -H 'Cookie: ...'"
swagger-lookup fetch
```

### 2. Query

```bash
swagger-lookup tags                                          # List all controllers
swagger-lookup get --tags "UserController,DepartmentController"  # Filter by controller
swagger-lookup get --path "/api/v1/users"                    # Filter by path
swagger-lookup search "employee"                             # Search keywords
swagger-lookup models --tags "UserController"                # Get referenced DTOs only
swagger-lookup summary                                       # API overview
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

## Use with AI Coding Agents

Works with any AI coding agent that can run shell commands:

| Environment | How to use |
|-------------|-----------|
| **Claude Code** | Install as skill to `~/.claude/skills/swagger-lookup/`, auto-discovered |
| **Cursor** | Add to project rules or run via terminal |
| **Copilot CLI** | Run commands directly in terminal |
| **Codex / Gemini CLI** | Run commands directly in terminal |
| **Any terminal** | `npx swagger-lookup <command>` |

### Claude Code Skill Setup

```bash
git clone git@github.com:yuquanwang/swagger-lookup.git ~/.claude/skills/swagger-lookup
```

### Cursor / Windsurf Rules

Add to your `.cursorrules` or project rules:

```
When looking up API endpoints from Swagger, use the swagger-lookup CLI:
  npx swagger-lookup fetch --curl "<curl command>"
  npx swagger-lookup tags
  npx swagger-lookup get --tags "<controller>"
Cache is stored at .swagger-cache/api-docs.json
```

## Cache

The swagger JSON is cached at `.swagger-cache/api-docs.json` in the current working directory. Re-run `fetch` when the API changes. Add `.swagger-cache/` to `.gitignore`.

## License

MIT
