import { McpGuide } from "@/components/account/McpGuide";
import { mcpResource } from "@/lib/mcp/metadata";

export const dynamic = "force-dynamic";

export default function McpGuidePage() {
  return <McpGuide endpoint={mcpResource()} />;
}
