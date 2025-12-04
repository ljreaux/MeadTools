"use client";
import { useTheme } from "next-themes";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight
} from "react-syntax-highlighter/dist/cjs/styles/prism";

interface Endpoint {
  method: string;
  path: string;
  description: string;
  auth?: string;
  request?: Record<string, string>;
  response?: Record<string, any>;
}

export default function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const { resolvedTheme } = useTheme();
  return (
    <div className="bg-card p-6 rounded-lg border border-border shadow-sm space-y-2 max-w-full">
      <h3 className="sm:text-xl text-lg font-semibold text-foreground mb-6">
        {endpoint.description}
      </h3>
      <p className="text-primary">
        <strong>Method:</strong> <span>{endpoint.method}</span>
      </p>
      <p>
        <strong className="text-primary">Path:</strong>{" "}
        <code className="bg-muted text-background px-2 py-1 rounded">
          {endpoint.path}
        </code>
      </p>
      {endpoint.auth && (
        <p className="text-destructive">
          <strong>Authentication:</strong> {endpoint.auth}
        </p>
      )}

      {/* Ensure code blocks don't cause overflow */}
      {endpoint.request && (
        <>
          <h4 className="font-semibold mt-2 text-foreground">Request Body</h4>
          <div className="overflow-x-auto max-w-full ">
            <SyntaxHighlighter
              language="json"
              style={resolvedTheme === "dark" ? oneDark : oneLight}
              customStyle={{
                fontSize: "0.9rem",
                padding: "1rem",
                whiteSpace: "pre-wrap"
              }}
            >
              {JSON.stringify(endpoint.request, null, 2)}
            </SyntaxHighlighter>
          </div>
        </>
      )}

      {endpoint.response && (
        <>
          <h4 className="font-semibold mt-2 text-foreground">Response</h4>
          <div className="overflow-x-auto max-w-full">
            <SyntaxHighlighter
              language="json"
              style={resolvedTheme === "dark" ? oneDark : oneLight}
              customStyle={{
                fontSize: "0.9rem",
                padding: "1rem",
                whiteSpace: "pre-wrap"
              }}
            >
              {JSON.stringify(endpoint.response, null, 2)}
            </SyntaxHighlighter>
          </div>
        </>
      )}
    </div>
  );
}
