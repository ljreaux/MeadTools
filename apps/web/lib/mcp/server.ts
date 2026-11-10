import "server-only";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import {
  executeMcpAgentTool,
  MCP_SCOPE,
  canReadMcpAccount,
  isMcpAccountReadTool,
  isCalculatorTool,
  isPublicReadTool,
  mcpAgentToolDefinitions,
  mcpAgentToolNames,
  mcpServerInstructions
} from "@meadtools/recipe-agent";
import { createAccountReadAdapter } from "@/lib/account-read-adapter";
import { agentCatalogLookups } from "@/lib/ai/agent-catalog-lookups";
import { executeLimitedMcpTool, McpToolLimitError } from "@/lib/mcp/usage";

import {
  defaultRecipeDraftName
} from "@meadtools/recipe-workflows";
import { publicAppOrigin } from "@/lib/public-origin";
import { mcpDraftUrl } from "./draft-link";
import { storeMcpDraft } from "./draft-store";

const MAX_RESULT_BYTES = 64 * 1024;

/** One stateless MCP server per HTTP request. No account state lives in it. */
export function createMeadToolsMcpServer(userId: number, scope = MCP_SCOPE) {
  const server = new Server(
    { name: "meadtools", version: "0.1.0" },
    { capabilities: { tools: {} }, instructions: mcpServerInstructions }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpAgentToolDefinitions
      .filter(
        (tool) => !isMcpAccountReadTool(tool.name) || canReadMcpAccount(scope)
      )
      .map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.parameters as {
          type: "object";
          properties?: Record<string, unknown>;
          required?: string[];
        },
        ...("outputSchema" in tool
          ? {
              outputSchema: tool.outputSchema as {
                type: "object";
                properties?: Record<string, unknown>;
              }
            }
          : {}),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          // Public community records are outside the user's private account.
          openWorldHint: isPublicReadTool(tool.name)
        }
      }))
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (
      isMcpAccountReadTool(request.params.name) &&
      !canReadMcpAccount(scope)
    ) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: "Account read permission is required. Reconnect and explicitly allow access to owned brews and saved recipes."
          }
        ]
      };
    }
    let execution;
    try {
      const run = () =>
        executeMcpAgentTool(
          request.params.name,
          request.params.arguments ?? {},
          {
            ...agentCatalogLookups,
            accountReadAdapter: canReadMcpAccount(scope)
              ? createAccountReadAdapter(userId)
              : undefined
          }
        );
      execution = mcpAgentToolNames.some((name) => name === request.params.name)
        ? await executeLimitedMcpTool(userId, request.params.name, run)
        : await run();
    } catch (error) {
      execution = {
        status: "error" as const,
        message:
          error instanceof McpToolLimitError
            ? error.message
            : "MCP tool execution failed."
      };
    }
    let builderUrl: string | undefined;
    if (execution.status === "ok" && "result" in execution && execution.result &&
        typeof execution.result === "object" && "status" in execution.result &&
        execution.result.status === "recipe" && "recipeData" in execution.result) {
      const result = execution.result;
      try {
        const origin = publicAppOrigin();
        const id = await storeMcpDraft(userId, {
          version: 1,
          name: defaultRecipeDraftName({
            recipeData: result.recipeData,
            recipeDraftInput: {
              name: typeof request.params.arguments?.name === "string" ? request.params.arguments.name : undefined,
              style: typeof request.params.arguments?.style === "string" ? request.params.arguments.style : undefined,
            },
          }),
          recipeData: result.recipeData,
          warnings: result.warnings,
          assumptions: result.assumptions,
        });
        builderUrl = mcpDraftUrl(origin, id);
        execution = { ...execution, result: { ...result, builderUrl } };
      } catch {
        execution = { ...execution, result: { ...result, builderLinkError: "Could not create a recipe draft link. Try building the draft again." } };
      }
    }
    const response = {
      isError: execution.status !== "ok",
      content: [
        { type: "text" as const, text: JSON.stringify(execution) },
        ...(builderUrl
          ? [{ type: "text" as const, text: `[Open unsaved draft in MeadTools](${builderUrl})` }]
          : [])
      ],
      ...(isMcpAccountReadTool(request.params.name) ||
      isPublicReadTool(request.params.name) ||
      (isCalculatorTool(request.params.name) && execution.status === "ok")
        ? { structuredContent: execution }
        : {})
    };
    // Count additional link and structured content blocks in the byte limit.
    const size = Buffer.byteLength(
      JSON.stringify(
        builderUrl || isMcpAccountReadTool(request.params.name) ||
          isPublicReadTool(request.params.name) ||
          isCalculatorTool(request.params.name)
          ? response
          : execution
      ),
      "utf8"
    );
    if (size > MAX_RESULT_BYTES) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: "Tool result exceeds the MCP response limit. Request a smaller page."
          }
        ]
      };
    }
    return response;
  });

  return server;
}
