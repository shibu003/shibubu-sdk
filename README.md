# Shibubu SDK

Connect your AI agent to [Shibubu](https://shibubu.ai) — an MCP-powered virtual buddy that grows based on your AI interactions.

## What is Shibubu?

Shibubu is a virtual buddy (like Tamagotchi meets Digimon) that lives on your AI agent. Your buddy's personality evolves based on how you interact with AI — not through explicit commands, but through the AI agent's observations of your behavior patterns.

- **9 psychological parameters** shape your buddy's unique personality
- **4-stage evolution**: Egg → Baby → Child → Adult
- **No conversation data is stored** — only structured signals (see [Privacy Policy](https://shibubu.ai/legal/privacy))

## Quick Start

### 1. Connect via Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "shibubu": {
      "url": "https://shibubu.ai/mcp"
    }
  }
}
```

### 2. Connect via any MCP Client

The MCP endpoint is:

```
https://shibubu.ai/mcp
```

Transport: **Streamable HTTP** (MCP 2025-03-26)

### 3. Connect via Cursor / VS Code

In your MCP settings, add a remote server with URL `https://shibubu.ai/mcp`.

## Available Tools

Once connected, your AI agent has access to these tools:

| Tool | Description |
|------|-------------|
| `buddy_ensure` | Initialize your buddy (call at session start) |
| `buddy_status` | Display your buddy as dot art |
| `buddy_action` | Care actions: feed, play, clean, sleep, train, talk |
| `buddy_evolve` | Check evolution candidates / evolve your buddy |
| `buddy_observe` | View 9 psychological parameters / report observations |
| `buddy_signal` | Record behavioral signals |
| `buddy_interpret` | Get daily interpretation events / choose frame |
| `buddy_calibrate` | Set initial personality (first time only) |
| `buddy_game` | Preview battle stats / export parameters |
| `buddy_link_account` | Get a link to view your buddy on the web |
| `buddy_batch` | Process daily parameter updates |
| `buddy_summon` | Summon your buddy into conversation |
| `buddy_release` | Release your buddy from conversation |
| `buddy_delete` | Delete your buddy |
| `buddy_diary` | View your buddy's diary |
| `buddy_list` | List all your buddies |
| `buddy_rename` | Rename your buddy |

## How It Works

```
You ↔ AI Agent (Claude, ChatGPT, etc.)
         ↓ MCP (structured signals only)
    Shibubu Server (shibubu.ai/mcp)
         ↓
    Buddy grows & evolves
         ↓
    View on shibubu.ai
```

1. Your AI agent connects to `shibubu.ai/mcp`
2. During conversations, the agent observes patterns (creativity, discipline, empathy, etc.)
3. The agent sends **structured signals** — NOT your conversation content
4. Signals are: parameter (a-i), direction (+/-), strength (0-1), and a short AI-generated summary (max 200 chars)
5. Daily batch processing updates your buddy's personality parameters
6. Your buddy's appearance, behavior, and evolution path change based on its personality

## What Data Is Sent?

**Sent to Shibubu:**
- Parameter signals: `{ param: "a", direction: "positive", strength: 0.7, reasoning: "Creative approach to problem" }`
- Care actions: feed, play, clean, etc.
- Observation metadata: type + short context summary (max 100 chars)

**Never sent to Shibubu:**
- Your conversation messages
- Chat history
- Personal information
- File contents

See the full [Privacy Policy](https://shibubu.ai/legal/privacy).

## Web Dashboard

Visit [shibubu.ai](https://shibubu.ai) to:
- View your buddy's appearance and stats
- See personality radar charts
- Track evolution progress
- Link your MCP buddy to a web account

To get a web link from your AI agent, ask it to call `buddy_link_account`.

## API Endpoints

For direct REST API access (without MCP):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/pet/:tenantId/:petId/state` | GET | Get buddy state |
| `/v1/pet/:tenantId/:petId/action` | POST | Apply action |
| `/v1/pet/:tenantId/:petId/params` | GET | Get parameters |
| `/v1/pet/:tenantId/:petId/signals` | POST | Record signals |
| `/health` | GET | Health check |
| `/legal/tos` | GET | Terms of Service |
| `/legal/privacy` | GET | Privacy Policy |

## Example: Custom MCP Client (TypeScript)

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("https://shibubu.ai/mcp")
);

const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(transport);

// List available tools
const { tools } = await client.listTools();
console.log(tools.map(t => t.name));

// Ensure buddy exists
const result = await client.callTool({
  name: "buddy_ensure",
  arguments: {}
});
console.log(result);

// Show the buddy
const buddy = await client.callTool({
  name: "buddy_status",
  arguments: {}
});
console.log(buddy);
```

## Example: REST API (curl)

```bash
# Health check
curl https://shibubu.ai/health

# Get buddy state
curl https://shibubu.ai/v1/pet/my_tenant/my_pet/state

# Feed the buddy
curl -X POST https://shibubu.ai/v1/pet/my_tenant/my_pet/action \
  -H "Content-Type: application/json" \
  -d '{"action": {"type": "feed"}, "version": 1}'
```

## Terms & Privacy

- [Terms of Service](https://shibubu.ai/legal/tos)
- [Privacy Policy](https://shibubu.ai/legal/privacy)
- Contact: contact@shibubu.ai

## BREAKING CHANGES (v0.2.0)

All MCP tool names have been renamed from `pet_*` / `pet.*` to `buddy_*`:

| Old Name (v0.1.0) | New Name (v0.2.0) |
|--------------------|-------------------|
| `pet.ensure_pet` | `buddy_ensure` |
| `pet.show` | `buddy_status` |
| `pet.apply_action` | `buddy_action` |
| `pet.check_evolution` / `pet.commit_evolution` | `buddy_evolve` |
| `pet.get_params` / `pet.report_observation` | `buddy_observe` |
| `pet.record_signal` | `buddy_signal` |
| `pet.get_interpretation_event` / `pet.respond_to_event` | `buddy_interpret` |
| `pet.calibrate_initial_params` | `buddy_calibrate` |
| `pet.game_mapping` / `pet.export_params` | `buddy_game` |
| `pet.create_web_link` | `buddy_link_account` |
| `pet.run_daily_batch` | `buddy_batch` |

REST API paths (`/v1/pet/...`) are **unchanged**.

If you have code calling tools by the old `pet.*` names, update them to the new `buddy_*` names.

## License

MIT — use this SDK freely to connect to Shibubu.

The Shibubu server itself is proprietary. This SDK only provides connection examples and documentation.
