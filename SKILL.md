---
name: swagger-lookup
description: Use when needing to look up API endpoint definitions from a large Swagger/OpenAPI spec, find request/response schemas for specific controllers, or understand available API paths before writing service code. Triggers on "swagger", "api docs", "endpoint definition", "controller API", "request body schema", "response schema".
---

# Swagger Lookup

Fetch, cache, and selectively query large Swagger/OpenAPI 2.0 JSON docs without exceeding context limits.

## When to Use

- Need API endpoint definitions from a Swagger spec too large to load entirely
- Writing or modifying service/API code and need request/response shapes
- Looking up which endpoints a controller exposes
- Finding DTO/model definitions referenced by specific endpoints

## Setup

Fetch and cache the swagger JSON (user provides the curl command directly):

```bash
# From a URL (auto-detects api-docs endpoint):
node <skill-dir>/swagger-lookup.js fetch --url "http://host:port/swagger-ui.html"
node <skill-dir>/swagger-lookup.js fetch --url "http://host:port"

# With custom curl (when auth headers are needed):
node <skill-dir>/swagger-lookup.js fetch --curl "curl -s 'https://api.example.com/v2/api-docs?group=all' -H 'Cookie: ...'"
```

> `<skill-dir>` is the directory where this SKILL.md resides. The agent should resolve the path based on its own skill installation location.

This saves the full JSON to `.swagger-cache/api-docs.json` in the current working directory. Re-run when the API changes.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `fetch --url "http://host:port"` | Auto-detect and cache swagger JSON |
| `fetch --curl "curl ..."` | Cache swagger JSON with custom curl |
| `tags` | List all controllers/tags with endpoint counts |
| `summary` | Show API overview (title, version, counts) |
| `get --tags "Tag1,Tag2"` | Get paths + resolved DTOs for specific controllers |
| `get --path "/api/v1/users"` | Get specific path detail (partial match) |
| `search "keyword"` | Search across paths, summaries, operationIds |
| `models --tags "Tag1"` | Get only the DTO definitions referenced by a tag |

All commands use: `node <skill-dir>/swagger-lookup.js <command> [args]`

## Workflow

```
1. User provides curl command → run `fetch --curl "..."` to cache (skip if cache exists)
2. Use `tags` to find the controller name
3. Use `get --tags "ControllerName"` to get endpoints + DTOs
4. Use output to write/update service code
```

## Tag Matching

Tag matching is **fuzzy and case-insensitive**. `--tags "user"` matches `UserController`, `user-management-controller`, etc. Separate multiple tags with commas.

## Output

- `get` and `models` output JSON with `$ref` references resolved — all referenced DTOs are included in the `definitions` section
- `tags` and `search` output human-readable tables
- Pipe JSON output to a file if needed: `node swagger-lookup.js get --tags "X" > /tmp/x-api.json`

## Example Prompts

Users may ask in various ways. The agent should recognize these and use this skill:

| User prompt | Agent action |
|-------------|-------------|
| "swagger地址是 http://10.0.0.1:8080/swagger-ui.html，帮我查一下 UserController 的接口" | `fetch --url` → `tags` → `get --tags "User"` |
| "Here's my curl: `curl -s 'https://...' -H '...'`, show me the expense endpoints" | `fetch --curl` → `search "expense"` or `get --tags "expense"` |
| "这个服务 172.21.154.130:9298 有哪些 controller？" | `fetch --url` → `tags` |
| "I need the request body schema for POST /api/v1/tasks" | `get --path "/api/v1/tasks"` (cache must exist) |
| "帮我写一个调用 task-management detail 接口的 service 方法" | `get --tags "task-management"` → extract the detail endpoint → write code |
| "What DTOs does the AttendanceController use?" | `models --tags "Attendance"` |
| "搜索所有和 expense 相关的接口" | `search "expense"` |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Running `get` before `fetch` | Run `fetch --curl "..."` first to populate cache |
| Loading full output into context | Filter by specific tags, don't dump everything |
| Tag name mismatch | Use `tags` command first to see exact tag names |
