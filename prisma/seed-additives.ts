import { PrismaClient, additive_unit } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

// This matches what your export likely looks like (loosely)
type ExportAdditive = {
  id?: string; // ignore
  name: string;
  dosage?: string | number;
  unit?: string;
};

function toDosage(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// Map old strings -> prisma enum
function toUnit(u: unknown): additive_unit {
  const raw = (typeof u === "string" ? u : "").trim().toLowerCase();

  // handle legacy weirdness / spacing
  const normalized =
    raw === "fl oz" ? "fl_oz" :
    raw === "floz" ? "fl_oz" :
    raw === "lb" ? "lbs" :
    raw === "l" ? "liters" :
    raw;

  // validate against enum
  const allowed = new Set<string>(Object.values(additive_unit));
  if (allowed.has(normalized)) return normalized as additive_unit;

  // default (pick whatever you want)
  return additive_unit.g;
}

async function main() {
  const file = path.join(process.cwd(), "prisma/seed-data/additives.json");
  const raw = await fs.readFile(file, "utf8");
  const rows = JSON.parse(raw) as ExportAdditive[];

  const cleaned = rows
    .map((r) => ({
      name: (r?.name ?? "").trim(),
      dosage: toDosage(r?.dosage),
      unit: toUnit(r?.unit)
    }))
    .filter((r) => r.name.length > 0);

  let created = 0;
  let updated = 0;

  // Your schema has no unique constraint on name, so we can’t use upsert/createMany+skipDuplicates safely.
  // We'll do "findFirst by name" -> update, else create.
  for (const a of cleaned) {
    const existing = await prisma.additives.findFirst({
      where: { name: a.name }
    });

    if (existing) {
      await prisma.additives.update({
        where: { id: existing.id },
        data: { dosage: a.dosage, unit: a.unit }
      });
      updated++;
    } else {
      await prisma.additives.create({
        data: { name: a.name, dosage: a.dosage, unit: a.unit }
      });
      created++;
    }
  }

  console.log(`Additives seeded. created=${created} updated=${updated} total=${cleaned.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });