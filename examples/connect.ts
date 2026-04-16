/**
 * Example: Connect to Shibubu MCP server using the official MCP SDK.
 *
 * Install dependencies:
 *   npm install @modelcontextprotocol/sdk
 *
 * Run:
 *   npx tsx examples/connect.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  const transport = new StreamableHTTPClientTransport(
    new URL("https://shibubu.ai/mcp")
  );

  const client = new Client({
    name: "shibubu-example",
    version: "1.0.0",
  });

  await client.connect(transport);
  console.log("Connected to Shibubu MCP server");

  // List available tools
  const { tools } = await client.listTools();
  console.log(`\n${tools.length} tools available:`);
  for (const tool of tools) {
    console.log(`  - ${tool.name}: ${tool.description}`);
  }

  // Ensure buddy exists (creates one if it doesn't)
  console.log("\nEnsuring buddy exists...");
  const ensureResult = await client.callTool({
    name: "buddy_ensure",
    arguments: {},
  });
  console.log(ensureResult);

  // Show the buddy
  console.log("\nShowing buddy...");
  const showResult = await client.callTool({
    name: "buddy_status",
    arguments: {},
  });
  console.log(showResult);

  // Get psychological parameters
  console.log("\nGetting parameters...");
  const paramsResult = await client.callTool({
    name: "buddy_observe",
    arguments: {},
  });
  console.log(paramsResult);

  await client.close();
  console.log("\nDisconnected.");
}

main().catch(console.error);
