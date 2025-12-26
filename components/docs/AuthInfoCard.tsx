"use client";
import { useTheme } from "next-themes";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight
} from "react-syntax-highlighter/dist/cjs/styles/prism";

interface Props {
  type: string;
  header: string;
  description: string;
}

export default function AuthInfoCard({ cardInfo }: { cardInfo: Props }) {
  const { resolvedTheme } = useTheme();
  return (
    <section className="pt-4">
      <h2 className="text-2xl font-semibold text-foreground">
        Authenticated Request Info
      </h2>
      <div className="mt-4 p-4 border rounded-md bg-card">
        <h3 className="text-lg font-medium">Type: {cardInfo.type}</h3>
        <div className="mt-2">
          <p>{cardInfo.description}</p>
          <div className="mt-4">
            <h4 className="font-medium">Header Format:</h4>
            <SyntaxHighlighter
              language="json"
              style={resolvedTheme === "dark" ? oneDark : oneLight}
              customStyle={{
                fontSize: "0.9rem",
                padding: "1rem",
                whiteSpace: "pre-wrap"
              }}
            >
              {cardInfo.header}
            </SyntaxHighlighter>
          </div>
          <div className="mt-4">
            <h4 className="font-medium">Example:</h4>
            <SyntaxHighlighter
              language="js"
              style={resolvedTheme === "dark" ? oneDark : oneLight}
              customStyle={{
                fontSize: "0.9rem",
                padding: "1rem",
                whiteSpace: "pre-wrap"
              }}
            >
              {`fetch('/api/auth/account-info', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  }
})`}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>
    </section>
  );
}
