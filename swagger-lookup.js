#!/usr/bin/env node

/**
 * swagger-lookup.js — Fetch, cache, and filter large Swagger/OpenAPI 2.0 JSON.
 *
 * Usage:
 *   node swagger-lookup.js fetch                          # Fetch via $SWAGGER_CURL and cache
 *   node swagger-lookup.js tags                           # List all tags (controllers) with counts
 *   node swagger-lookup.js get --tags "Tag1,Tag2"         # Paths for specific tags
 *   node swagger-lookup.js get --path "/api/v1/users"     # Specific path detail
 *   node swagger-lookup.js search "keyword"               # Search paths + summaries
 *   node swagger-lookup.js models --tags "Tag1"           # Referenced DTOs for a tag
 *
 * Environment:
 *   SWAGGER_CURL   — Full curl command to fetch swagger JSON (required for `fetch`)
 *   SWAGGER_CACHE  — Cache file path (default: .swagger-cache/api-docs.json)
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const CACHE_DIR = process.env.SWAGGER_CACHE_DIR || path.join(process.cwd(), '.swagger-cache')
const CACHE_FILE = process.env.SWAGGER_CACHE || path.join(CACHE_DIR, 'api-docs.json')

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) {
    console.error(`Cache not found at ${CACHE_FILE}. Run "fetch" first.`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
}

/**
 * Recursively resolve all $ref pointers in an object, collecting referenced definitions.
 * Returns { resolved, definitions } where definitions is a map of referenced model names.
 */
function resolveRefs(obj, rootDoc, collected = new Map(), depth = 0) {
  if (depth > 15) return obj // guard against circular refs

  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveRefs(item, rootDoc, collected, depth + 1))
  }

  // Handle $ref
  if (obj['$ref'] && typeof obj['$ref'] === 'string') {
    const refPath = obj['$ref'] // e.g. "#/definitions/UserDTO"
    const match = refPath.match(/^#\/definitions\/(.+)$/)
    if (match) {
      const modelName = match[1]
      if (!collected.has(modelName) && rootDoc.definitions && rootDoc.definitions[modelName]) {
        // Mark as collected first to prevent circular resolution
        collected.set(modelName, null)
        const resolved = resolveRefs(rootDoc.definitions[modelName], rootDoc, collected, depth + 1)
        collected.set(modelName, resolved)
      }
      // Keep the $ref in place but also note it's been collected
      return obj
    }
    return obj
  }

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = resolveRefs(value, rootDoc, collected, depth + 1)
  }
  return result
}

function collectRefsFromPaths(paths, rootDoc) {
  const collected = new Map()
  resolveRefs(paths, rootDoc, collected)
  const definitions = {}
  for (const [name, def] of collected) {
    if (def !== null) {
      definitions[name] = def
    } else if (rootDoc.definitions && rootDoc.definitions[name]) {
      definitions[name] = rootDoc.definitions[name]
    }
  }
  return definitions
}

function formatOutput(data) {
  console.log(JSON.stringify(data, null, 2))
}

// ── Commands ─────────────────────────────────────────────────────────────────

function cmdFetch(args) {
  const curlCmd = args['--curl'] || process.env.SWAGGER_CURL
  if (!curlCmd) {
    console.error('Error: No curl command provided.')
    console.error('Pass via --curl or $SWAGGER_CURL, e.g.:')
    console.error('  node swagger-lookup.js fetch --curl "curl -s \'https://example.com/v2/api-docs?group=all\' -H \'Cookie: ...\'"')
    process.exit(1)
  }

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }

  console.error(`Fetching swagger docs...`)
  try {
    const result = execSync(curlCmd, { maxBuffer: 100 * 1024 * 1024, encoding: 'utf-8' })
    // Validate it's JSON
    JSON.parse(result)
    fs.writeFileSync(CACHE_FILE, result)
    const stats = fs.statSync(CACHE_FILE)
    console.error(`Cached to ${CACHE_FILE} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`)

    // Show summary
    const doc = JSON.parse(result)
    const pathCount = Object.keys(doc.paths || {}).length
    const tagCount = (doc.tags || []).length
    const defCount = Object.keys(doc.definitions || {}).length
    console.error(`Summary: ${pathCount} paths, ${tagCount} tags, ${defCount} definitions`)
  } catch (err) {
    console.error(`Fetch failed: ${err.message}`)
    process.exit(1)
  }
}

function cmdTags() {
  const doc = loadCache()
  const tagMap = new Map()

  // Initialize from doc.tags
  for (const tag of doc.tags || []) {
    tagMap.set(tag.name, { description: tag.description || '', count: 0, paths: [] })
  }

  // Count paths per tag
  for (const [pathStr, methods] of Object.entries(doc.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (method === 'parameters') continue
      for (const tag of operation.tags || ['_untagged']) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, { description: '', count: 0, paths: [] })
        }
        const entry = tagMap.get(tag)
        entry.count++
        if (!entry.paths.includes(pathStr)) {
          entry.paths.push(pathStr)
        }
      }
    }
  }

  // Sort by name
  const sorted = [...tagMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  console.log(`Total: ${sorted.length} tags\n`)
  console.log('Tag Name'.padEnd(50) + 'Endpoints'.padEnd(12) + 'Paths'.padEnd(8) + 'Description')
  console.log('-'.repeat(110))
  for (const [name, info] of sorted) {
    console.log(
      name.padEnd(50) +
        String(info.count).padEnd(12) +
        String(info.paths.length).padEnd(8) +
        (info.description || '').slice(0, 50)
    )
  }
}

function cmdGet(args) {
  const doc = loadCache()
  const tagsArg = args['--tags']
  const pathArg = args['--path']

  if (!tagsArg && !pathArg) {
    console.error('Usage: get --tags "Tag1,Tag2" or get --path "/api/path"')
    process.exit(1)
  }

  let filteredPaths = {}

  if (pathArg) {
    // Filter by path (supports partial match)
    for (const [pathStr, methods] of Object.entries(doc.paths || {})) {
      if (pathStr.includes(pathArg)) {
        filteredPaths[pathStr] = methods
      }
    }
  }

  if (tagsArg) {
    const targetTags = tagsArg.split(',').map((t) => t.trim().toLowerCase())

    for (const [pathStr, methods] of Object.entries(doc.paths || {})) {
      for (const [method, operation] of Object.entries(methods)) {
        if (method === 'parameters') continue
        const opTags = (operation.tags || []).map((t) => t.toLowerCase())
        if (opTags.some((t) => targetTags.some((target) => t.includes(target)))) {
          if (!filteredPaths[pathStr]) filteredPaths[pathStr] = {}
          filteredPaths[pathStr][method] = operation
        }
      }
    }
  }

  const pathCount = Object.keys(filteredPaths).length
  if (pathCount === 0) {
    console.error('No matching paths found.')
    process.exit(0)
  }

  // Resolve referenced definitions
  const definitions = collectRefsFromPaths(filteredPaths, doc)

  const output = {
    _meta: {
      matchedPaths: pathCount,
      matchedDefinitions: Object.keys(definitions).length,
      filter: tagsArg ? { tags: tagsArg } : { path: pathArg },
    },
    paths: filteredPaths,
    definitions,
  }

  formatOutput(output)
}

function cmdSearch(keyword) {
  if (!keyword) {
    console.error('Usage: search "keyword"')
    process.exit(1)
  }

  const doc = loadCache()
  const kw = keyword.toLowerCase()
  const results = []

  for (const [pathStr, methods] of Object.entries(doc.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (method === 'parameters') continue
      const searchable = [
        pathStr,
        operation.summary || '',
        operation.description || '',
        operation.operationId || '',
        ...(operation.tags || []),
      ]
        .join(' ')
        .toLowerCase()

      if (searchable.includes(kw)) {
        results.push({
          method: method.toUpperCase(),
          path: pathStr,
          tags: operation.tags || [],
          summary: operation.summary || '',
          operationId: operation.operationId || '',
        })
      }
    }
  }

  console.log(`Found ${results.length} matching endpoints for "${keyword}":\n`)
  for (const r of results) {
    console.log(`  ${r.method.padEnd(8)} ${r.path}`)
    if (r.summary) console.log(`           ${r.summary}`)
    console.log(`           Tags: [${r.tags.join(', ')}]  ID: ${r.operationId}`)
    console.log()
  }
}

function cmdModels(args) {
  const doc = loadCache()
  const tagsArg = args['--tags']

  if (!tagsArg) {
    console.error('Usage: models --tags "Tag1,Tag2"')
    process.exit(1)
  }

  // First get paths for these tags
  const targetTags = tagsArg.split(',').map((t) => t.trim().toLowerCase())
  const filteredPaths = {}

  for (const [pathStr, methods] of Object.entries(doc.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (method === 'parameters') continue
      const opTags = (operation.tags || []).map((t) => t.toLowerCase())
      if (opTags.some((t) => targetTags.some((target) => t.includes(target)))) {
        if (!filteredPaths[pathStr]) filteredPaths[pathStr] = {}
        filteredPaths[pathStr][method] = operation
      }
    }
  }

  // Collect and resolve all referenced definitions
  const definitions = collectRefsFromPaths(filteredPaths, doc)

  console.log(`Referenced models for tags [${tagsArg}]:\n`)
  console.log(`Found ${Object.keys(definitions).length} models:\n`)
  formatOutput(definitions)
}

function cmdSummary() {
  const doc = loadCache()
  const info = doc.info || {}
  console.log(`API: ${info.title || 'Unknown'} v${info.version || '?'}`)
  console.log(`Base path: ${doc.basePath || '/'}`)
  console.log(`Host: ${doc.host || 'unknown'}`)
  console.log(`Paths: ${Object.keys(doc.paths || {}).length}`)
  console.log(`Definitions: ${Object.keys(doc.definitions || {}).length}`)
  console.log(`Tags: ${(doc.tags || []).length}`)

  // Size estimate
  const stats = fs.statSync(CACHE_FILE)
  console.log(`Cache size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`)
}

// ── CLI Router ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {}
  let positional = []
  let i = 0
  while (i < argv.length) {
    if (argv[i].startsWith('--')) {
      args[argv[i]] = argv[i + 1] || true
      i += 2
    } else {
      positional.push(argv[i])
      i++
    }
  }
  return { args, positional }
}

const rawArgs = process.argv.slice(2)
const command = rawArgs[0]
const { args, positional } = parseArgs(rawArgs.slice(1))

switch (command) {
  case 'fetch':
    cmdFetch(args)
    break
  case 'tags':
    cmdTags()
    break
  case 'get':
    cmdGet(args)
    break
  case 'search':
    cmdSearch(positional[0] || args['--keyword'])
    break
  case 'models':
    cmdModels(args)
    break
  case 'summary':
    cmdSummary()
    break
  case 'help':
  case '--help':
  case undefined:
    console.log(`swagger-lookup — Filter large Swagger JSON by controller/tag/path

Commands:
  fetch --curl "curl -s '...'"   Fetch swagger JSON and cache locally
  tags                           List all tags (controllers) with endpoint counts
  summary                        Show API summary info
  get --tags "Tag1,Tag2"         Get paths for specific tags (fuzzy match)
  get --path "/api/v1/users"     Get specific path detail (partial match)
  search "keyword"               Search paths, summaries, operationIds
  models --tags "Tag1"           Get referenced DTO definitions for a tag

Options:
  --curl "..."         Curl command to fetch swagger JSON (or set $SWAGGER_CURL)
  SWAGGER_CACHE        Cache file path (default: .swagger-cache/api-docs.json)

Examples:
  node swagger-lookup.js fetch --curl "curl -s 'https://api.example.com/v2/api-docs?group=all' -H 'Cookie: SESSION=abc'"
  node swagger-lookup.js tags
  node swagger-lookup.js get --tags "UserController,DepartmentController"
  node swagger-lookup.js search "employee"
`)
    break
  default:
    console.error(`Unknown command: ${command}. Run with --help for usage.`)
    process.exit(1)
}
