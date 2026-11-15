import { ZodSchemaConverter } from "next-openapi-gen/dist/lib/zod-converter.js";

// next-openapi-gen 0.10.5 intends to scan once, but tests an empty mapping
// object to determine readiness. Our const aliases leave that map empty,
// causing a full project rescan for every schema lookup. Track completion
// independently, preserving the original scanner and all schema resolution.
const scan = ZodSchemaConverter.prototype.preScanForTypeMappings;
if (typeof scan !== "function") throw new Error("Review the OpenAPI type-scan adapter after upgrading next-openapi-gen.");
const scanned = new WeakSet();
ZodSchemaConverter.prototype.preScanForTypeMappings = function () {
  if (scanned.has(this)) return;
  scanned.add(this);
  try { return scan.call(this); }
  catch (error) { scanned.delete(this); throw error; }
};
