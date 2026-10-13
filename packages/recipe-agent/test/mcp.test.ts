import assert from "node:assert/strict";
import test from "node:test";
import {
  executeHostedAgentTool,
  executeMcpAgentTool,
  mcpAgentToolDefinitions,
  mcpAgentToolNames,
} from "../src/index";

test("MCP advertises only the reviewed read-only tool allowlist", () => {
  assert.deepEqual(
    mcpAgentToolDefinitions.map((tool) => tool.name).sort(),
    [...mcpAgentToolNames].sort(),
  );
});

test("MCP calculation uses the same result as hosted chat", async () => {
  const input = { targetAbv: 12, fermentationFinalGravity: 1.005 };
  assert.deepEqual(
    await executeMcpAgentTool("calculate_gravity_target", input),
    await executeHostedAgentTool("calculate_gravity_target", input),
  );
});

test("MCP refuses hosted-only context and proposal tools", async () => {
  for (const name of [
    "get_selected_account_context",
    "record_recipe_plan",
    "explain_recipe",
    "prepare_brew_action",
  ]) {
    assert.deepEqual(await executeMcpAgentTool(name, {}), {
      status: "unknown_tool",
      toolName: name,
    });
  }
});
