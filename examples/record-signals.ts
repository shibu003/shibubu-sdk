/**
 * Example: Record psychological signals to shape your pet's personality.
 *
 * This is what an AI agent does during conversations —
 * it observes user behavior patterns and sends structured signals.
 *
 * Run:
 *   npx tsx examples/record-signals.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  const transport = new StreamableHTTPClientTransport(
    new URL("https://shibubu.ai/mcp")
  );
  const client = new Client({ name: "signal-example", version: "1.0.0" });
  await client.connect(transport);

  // Ensure pet exists first
  await client.callTool({ name: "pet.ensure_pet", arguments: {} });

  // Record signals — these accumulate and are processed daily
  // Parameters (a-i) map to psychological traits:
  //   a: Openness       b: Conscientiousness  c: Extraversion
  //   d: Agreeableness  e: Neuroticism        f: Curiosity
  //   g: Resilience     h: Empathy            i: Creativity
  const result = await client.callTool({
    name: "pet.record_signal",
    arguments: {
      signals: [
        {
          param: "i",
          direction: "positive",
          strength: 0.8,
          reasoning: "User explored an unconventional solution approach",
        },
        {
          param: "b",
          direction: "positive",
          strength: 0.5,
          reasoning: "User methodically tested each step before proceeding",
        },
      ],
    },
  });

  console.log("Signals recorded:", result);

  // Check current parameters
  const params = await client.callTool({
    name: "pet.get_params",
    arguments: {},
  });
  console.log("\nCurrent parameters:", params);

  await client.close();
}

main().catch(console.error);
