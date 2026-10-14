import "server-only";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  executeMcpAgentTool,
  MCP_SCOPE,
  canReadMcpAccount,
  isMcpAccountReadTool,
  mcpAgentToolDefinitions,
  mcpAgentToolNames,
} from "@meadtools/recipe-agent";
import { agentCatalogLookups } from "@/lib/ai/agent-catalog-lookups";
import { executeLimitedMcpTool, McpToolLimitError } from "@/lib/mcp/usage";

const MAX_RESULT_BYTES = 64 * 1024;

/** One stateless MCP server per HTTP request. No account state lives in it. */
export function createMeadToolsMcpServer(userId: number, scope = MCP_SCOPE) {
  const server = new Server(
    { name: "meadtools", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpAgentToolDefinitions.filter(tool => !isMcpAccountReadTool(tool.name) || canReadMcpAccount(scope)).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters as {
        type: "object";
        properties?: Record<string, unknown>;
        required?: string[];
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (isMcpAccountReadTool(request.params.name) && !canReadMcpAccount(scope)) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: "Account read permission is required. Reconnect and explicitly allow access to owned brews and saved recipes." }],
      };
    }
    let execution;
    try {
      const run = () => executeMcpAgentTool(
        request.params.name,
        request.params.arguments ?? {},
        agentCatalogLookups,
      );
      execution = mcpAgentToolNames.some((name) => name === request.params.name)
        ? await executeLimitedMcpTool(userId, request.params.name, run)
        : await run();
    } catch (error) {
      execution = {
        status: "error" as const,
        message: error instanceof McpToolLimitError
          ? error.message
          : "MCP tool execution failed.",
      };
    }
    const serialized = JSON.stringify(execution);
    if (Buffer.byteLength(serialized, "utf8") > MAX_RESULT_BYTES) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: "Tool result exceeds the MCP response limit." }],
      };
    }
    return {
      isError: execution.status !== "ok",
      content: [{ type: "text" as const, text: serialized }],
    };
  });

  return server;
}
