"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

export default function ApiDocsPage() {
  return (
    <ApiReferenceReact
      configuration={{
        _integration: "nextjs",
        url: "/openapi.json",
        title: "MeadTools API",
        theme: "kepler",
        layout: "modern",
        customCss: `
          .light-mode {
            --scalar-background-1: hsl(38, 54%, 56%);
            --scalar-background-2: hsl(38, 54%, 50%);
            --scalar-background-3: hsl(210, 40%, 96.1%);
            --scalar-color-1: hsl(0, 0%, 14%);
            --scalar-color-2: hsl(215.4, 16.3%, 46.9%);
            --scalar-color-3: hsl(215.4, 16.3%, 38%);
            --scalar-color-accent: hsl(222.2, 47.4%, 11.2%);
            --scalar-border-color: hsl(214.3, 31.8%, 91.4%);
          }

          .dark-mode {
            --scalar-background-1: hsl(0, 0%, 14%);
            --scalar-background-2: hsl(0, 0%, 18%);
            --scalar-background-3: hsl(210, 13%, 35%);
            --scalar-color-1: hsl(36, 16%, 82%);
            --scalar-color-2: hsl(215, 20.2%, 65.1%);
            --scalar-color-3: hsl(36, 16%, 68%);
            --scalar-color-accent: hsl(36, 16%, 82%);
            --scalar-border-color: hsl(210, 13%, 35%);
          }
        `,

        hideClientButton: true,
        showDeveloperTools: "never",
        persistAuth: true,
        agent: {
          disabled: true
        },
        mcp: {
          disabled: true
        },
        authentication: {
          preferredSecurityScheme: "BearerAuth"
        },
        defaultOpenFirstTag: false,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
        telemetry: false
      }}
    />
  );
}
