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

```bash
# Option 1: npx (no install)
npx swagger-lookup <command>

# Option 2: global install
npm install -g swagger-lookup
swagger-lookup <command>

# Option 3: run from source
node /path/to/swagger-lookup.js <command>
```

## Workflow

```
1. User provides curl command → run `swagger-lookup fetch --curl "..."` to cache
2. Use `swagger-lookup tags` to find the controller name
3. Use `swagger-lookup get --tags "ControllerName"` to get endpoints + DTOs
4. Use output to write/update service code
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `fetch --curl "curl ..."` | Download and cache swagger JSON |
| `tags` | List all controllers/tags with endpoint counts |
| `summary` | Show API overview (title, version, counts) |
| `get --tags "Tag1,Tag2"` | Get paths + resolved DTOs for specific controllers |
| `get --path "/api/v1/users"` | Get specific path detail (partial match) |
| `search "keyword"` | Search across paths, summaries, operationIds |
| `models --tags "Tag1"` | Get only the DTO definitions referenced by a tag |

## Tag Matching

Tag matching is **fuzzy and case-insensitive**. `--tags "user"` matches `UserController`, `user-management-controller`, etc. Separate multiple tags with commas.

## Output

- `get` and `models` output JSON with `$ref` references resolved — all referenced DTOs are included in the `definitions` section
- `tags` and `search` output human-readable tables
- Pipe JSON output to a file if needed: `swagger-lookup get --tags "X" > /tmp/x-api.json`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Running `get` before `fetch` | Run `fetch --curl "..."` first to populate cache |
| Loading full output into context | Filter by specific tags, don't dump everything |
| Tag name mismatch | Use `tags` command first to see exact tag names |
