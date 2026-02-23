# SUIPort AI Agent Instructions

## Project Overview

**SUIPort** is an enterprise-grade DeFi portfolio tracking service for the SUI blockchain. It provides real-time wallet tracking, multi-source price aggregation, DeFi position monitoring, and AI integration via Model Context Protocol (MCP).

**Key Architecture**: Cloudflare Workers (edge computing) + Hono.js + D1 (SQLite) + GraphQL + MCP

---

## Critical Architecture Patterns

### 1. **Edge-First Deployment Model**
- All code runs on Cloudflare Workers (global edge distribution)
- No traditional server infrastructure
- D1 database is SQLite-backed and globally available
- Cron jobs trigger price/token updates via `wrangler.toml` schedules (5min SUI prices, 30min zero-price tokens)

### 2. **Multi-Source Price Aggregation**
Price resolution uses **fallback chains** (see [services/price.service.ts](../src/services/price.service.ts)):
1. **Database cache** (5-minute TTL)
2. **7K Protocol SDK** (`getTokenPrice()` for mainnet prices)
3. **CoinGecko API** (fallback for obscure tokens)
4. **DexScreener** (last resort for DEX pairs)

This pattern ensures resilience; every failed source triggers retry with exponential backoff (1s base, 3 retries).

### 3. **Service Initialization Pattern**
Services require explicit initialization with D1 database binding in middleware:
```typescript
app.use('*', async (c, next) => {
  PriceService.initialize(c.env.DB);
  CronService.initialize(c.env.DB);
  await next();
});
```
Always initialize dependent services before using them.

### 4. **Three-API Architecture**
- **REST API**: Traditional `GET /wallet/:address`, `/price/:tokenType` endpoints
- **GraphQL**: Single `/graphql` endpoint for flexible querying (queries, mutations, subscriptions schema in [schema.ts](../src/graphql/schema.ts))
- **MCP Server**: JSON-RPC interface for AI assistants via `/mcp` (tools: `get_wallet_balance`, `get_token_price`)

---

## Core Services & Responsibilities

| Service | File | Purpose |
|---------|------|---------|
| **PriceService** | [price.service.ts](../src/services/price.service.ts) | Token price resolution with caching & multi-source fallback |
| **DatabaseService** | [database.service.ts](../src/services/database.service.ts) | D1 CRUD operations for tokens, wallets, histories |
| **CronService** | [cron.service.ts](../src/services/cron.service.ts) | Scheduled price/token updates via Cloudflare cron triggers |
| **MMT Finance** | [mmt2.service.ts](../src/services/mmt2.service.ts) | CLMM liquidity position tracking |
| **Cetus Protocol** | [cetus.service.ts](../src/services/cetus.service.ts) | Cetus DEX position extraction |
| **DeepBook** | [deepbook.service.ts](../src/services/deepbook.service.ts) | Market maker balance queries |
| **MCP Server** | [mcp/server.ts](../src/mcp/server.ts) | Model Context Protocol handler + tool registration |

---

## Data Flow & Key Workflows

### Wallet Portfolio Query Flow
1. **REST/GraphQL**: Client requests `/wallet/:address`
2. **Index.ts** routes to handler → calls `DatabaseService.getWalletTokens()`
3. **Price Resolution**: For each token, `PriceService.getTokenPrice()` applies fallback chain
4. **Response**: Aggregated portfolio with USD values, metadata, and 24h changes

### Price Update Cron Flow
1. **Cron trigger** (*/5 * * * *): Cloudflare fires scheduled event
2. **[src/index.ts](../src/index.ts) `scheduled` handler** → `CronService.updateSuiPrice()`
3. **PriceService.getSuiPrice()** → fetches from 7K Protocol → stores in D1
4. **Zero-price token update** (*/30 * * * *): Re-attempts pricing for tokens with `price_usd = 0`

### MCP Tool Request Flow
1. **AI Client** sends JSON-RPC call to `/mcp` with tool name (e.g., `get_wallet_balance`)
2. **SuiPortMCPServer** [mcp/server.ts](../src/mcp/server.ts) dispatches to `getWalletBalance()` (in [mcp/tools.ts](../src/mcp/tools.ts))
3. **Tool** queries D1 via DatabaseService, returns JSON response
4. **MCP** wraps in JSON-RPC response with mime type

---

## Key Developer Workflows

### Local Development
```bash
# Terminal 1: Start backend (Cloudflare Workers dev)
cd suiport
wrangler dev  # Runs on http://localhost:8787

# Terminal 2: Start frontend
cd suiport/suiwatch-front
bun run dev   # Vue 3 dev server (Vite)
```

### Deployment
```bash
# Backend
cd suiport && wrangler deploy --minify

# Frontend (if configured)
cd suiwatch-front && bun run build
```

### Database Migrations
- Migrations stored in [migrations/](../migrations/) (SQL files)
- Run via Cloudflare D1 CLI: `wrangler d1 migrations apply`
- Current schema: `tokens`, `wallets`, `wallet_tokens`, `wallet_history`, `sui_price_history`

---

## Common Patterns & Conventions

### Error Handling
- **Network errors**: Use retry wrapper `retryOperation<T>()` with exponential backoff
- **Database errors**: Gracefully degrade to `null` and log to console (edge logging)
- **Missing prices**: Store `price_usd = 0` as sentinel; cron job attempts resolution later

### Caching Strategy
- **Token prices**: 5-minute TTL in D1 (checked via `last_update` timestamp)
- **Wallet data**: Not cached; queried fresh each request (portfolio changes frequently)
- **Token metadata**: Embedded in price records as JSON string in `metadata` column

### Type Safety
- Prefer TypeScript interfaces over `any`; core types in [database.service.ts](../src/services/database.service.ts)
- GraphQL schema defines API contract; resolvers in [resolvers.ts](../src/graphql/resolvers.ts) must match schema types

### Cloudflare Bindings
- D1 database exposed as `c.env.DB` (Hono context)
- Must pass to services during initialization (see middleware pattern above)

---

## External Integrations

| SDK | Usage | Key File |
|-----|-------|----------|
| `@mysten/sui` | SUI client, wallet queries | [index.ts](../src/index.ts) |
| `@7kprotocol/sdk-ts` | Primary price oracle `getTokenPrice()` | [price.service.ts](../src/services/price.service.ts) |
| `@cetusprotocol/common-sdk` | Cetus DEX pool/position data | [cetus.service.ts](../src/services/cetus.service.ts) |
| `@mmt-finance/clmm-sdk` | MMT Finance CLMM positions | [mmt2.service.ts](../src/services/mmt2.service.ts) |
| `@mysten/deepbook-v3` | DeepBook market maker info | [deepbook.service.ts](../src/services/deepbook.service.ts) |
| `@modelcontextprotocol/sdk` | MCP JSON-RPC server | [mcp/server.ts](../src/mcp/server.ts) |

---

## Front-End (Vue 3)

- **Location**: [suiwatch-front/](../suiwatch-front/)
- **Framework**: Vue 3 + TypeScript + Tailwind CSS + Vite
- **Wallet Integration**: `@reown/appkit` (Web3 wallet support)
- **Key Component**: [App.vue](../suiwatch-front/src/App.vue) - Main portfolio dashboard
- **API Calls**: Direct GraphQL queries to backend `/graphql`

---

## Debugging Tips

1. **Check Cloudflare logs**: `wrangler tail` streams live edge logs
2. **Price failures**: Look for 0 prices in DB; check cron job execution in Workers admin
3. **GraphQL issues**: Test queries in `/graphql` (GraphQL Yoga introspection available)
4. **MCP tool calls**: Verify `ListToolsRequestSchema` returns expected tools before testing `CallToolRequestSchema`
5. **Token missing**: Check if token exists in D1 `tokens` table; if not, cron will eventually populate it

---

## When Adding Features

1. **New API endpoint?** Add to [index.ts](../src/index.ts), match GraphQL schema in [schema.ts](../src/graphql/schema.ts)
2. **New DeFi protocol?** Create service in [services/](../src/services/) following `MMT Finance` pattern
3. **New price source?** Add fallback option in `PriceService.getTokenPrice()` and increase retry attempts
4. **New MCP tool?** Register in `setupToolHandlers()` [mcp/server.ts](../src/mcp/server.ts) and implement in [mcp/tools.ts](../src/mcp/tools.ts)
5. **Database schema change?** Create new migration file in [migrations/](../migrations/), test with `wrangler d1 migrations apply`
