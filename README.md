# Shibubu SDK

Connect your AI agent to [Shibubu](https://shibubu.ai) — an MCP-powered virtual pet that grows based on your AI interactions.

## What is Shibubu?

Shibubu is a virtual pet (like Tamagotchi meets Digimon) that lives on your AI agent. Your pet's personality evolves based on how you interact with AI — not through explicit commands, but through the AI agent's observations of your behavior patterns.

- **9 psychological parameters** shape your pet's unique personality
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
| `pet.ensure_pet` | Initialize your pet (call at session start) |
| `pet.show` | Display your pet as dot art |
| `pet.apply_action` | Care actions: feed, play, clean, sleep, train, talk |
| `pet.check_evolution` | Check evolution candidates |
| `pet.commit_evolution` | Evolve your pet |
| `pet.get_params` | View 9 psychological parameters |
| `pet.record_signal` | Record behavioral signals |
| `pet.report_observation` | Report behavior observations |
| `pet.get_interpretation_event` | Get daily interpretation events |
| `pet.respond_to_event` | Choose interpretation frame |
| `pet.calibrate_initial_params` | Set initial personality (first time only) |
| `pet.game_mapping` | Preview battle stats |
| `pet.export_params` | Export parameters for game integration |
| `pet.create_web_link` | Get a link to view your pet on the web |
| `pet.run_daily_batch` | Process daily parameter updates |

## How It Works

```
You ↔ AI Agent (Claude, ChatGPT, etc.)
         ↓ MCP (structured signals only)
    Shibubu Server (shibubu.ai/mcp)
         ↓
    Pet grows & evolves
         ↓
    View on shibubu.ai
```

1. Your AI agent connects to `shibubu.ai/mcp`
2. During conversations, the agent observes patterns (creativity, discipline, empathy, etc.)
3. The agent sends **structured signals** — NOT your conversation content
4. Signals are: parameter (a-i), direction (+/-), strength (0-1), and a short AI-generated summary (max 200 chars)
5. Daily batch processing updates your pet's personality parameters
6. Your pet's appearance, behavior, and evolution path change based on its personality

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
- View your pet's appearance and stats
- See personality radar charts
- Track evolution progress
- Link your MCP pet to a web account

To get a web link from your AI agent, ask it to call `pet.create_web_link`.

## API Endpoints

For direct REST API access (without MCP):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/pet/:tenantId/:petId/state` | GET | Get pet state |
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

// Ensure pet exists
const result = await client.callTool({
  name: "pet.ensure_pet",
  arguments: {}
});
console.log(result);

// Show the pet
const pet = await client.callTool({
  name: "pet.show",
  arguments: {}
});
console.log(pet);
```

## Example: REST API (curl)

```bash
# Health check
curl https://shibubu.ai/health

# Get pet state
curl https://shibubu.ai/v1/pet/my_tenant/my_pet/state

# Feed the pet
curl -X POST https://shibubu.ai/v1/pet/my_tenant/my_pet/action \
  -H "Content-Type: application/json" \
  -d '{"action": {"type": "feed"}, "version": 1}'
```

## Terms & Privacy

- [Terms of Service](https://shibubu.ai/legal/tos)
- [Privacy Policy](https://shibubu.ai/legal/privacy)
- Contact: contact@shibubu.ai

## License

MIT — use this SDK freely to connect to Shibubu.

The Shibubu server itself is proprietary. This SDK only provides connection examples and documentation.
