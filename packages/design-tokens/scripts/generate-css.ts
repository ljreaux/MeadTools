import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { renderDesignTokenCss } from "../src/css";

const outputPath = fileURLToPath(new URL("../tokens.css", import.meta.url));

await writeFile(outputPath, renderDesignTokenCss());
