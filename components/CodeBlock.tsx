"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useTheme } from "next-themes";
import {
  oneDark,
  oneLight
} from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Copy, CopyCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CopyableCodeBlockProps {
  text: string;
  language?: string;
}

export default function CopyableCodeBlock({
  text,
  language = "json"
}: CopyableCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      toast({
        description: (
          <div className="flex items-center justify-center gap-2">
            <CopyCheck className="text-xl text-green-500" />
            Copied to clipboard
          </div>
        )
      });

      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const syntaxStyle = mounted && resolvedTheme === "dark" ? oneDark : oneLight;

  return (
    <div className="relative">
      <Button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10"
        variant="ghost"
        size="sm"
      >
        {copied ? <CopyCheck className="text-green-500" /> : <Copy />}
      </Button>

      <SyntaxHighlighter
        language={language}
        style={syntaxStyle}
        customStyle={{
          fontSize: "0.9rem",
          margin: 0,
          padding: "1rem",
          whiteSpace: "pre-wrap"
        }}
      >
        {text}
      </SyntaxHighlighter>
    </div>
  );
}
