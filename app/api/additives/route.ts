import prisma from "@/lib/prisma";
import { verifyAdmin } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");

  try {
    const additives = await prisma.additives.findMany({
      where: name
        ? {
            name: {
              equals: name,
              mode: "insensitive",
            },
          }
        : undefined,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(additives);
  } catch (err) {
    console.error("Failed to fetch additives:", err);
    return NextResponse.json(
      { error: "Failed to fetch additives" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) return adminOrResponse;

  try {
    const body = await req.json();
    const { name, dosage, unit } = body;

    if (!name || dosage == null || !unit) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const additive = await prisma.additives.create({
      data: {
        name,
        dosage: parseFloat(String(dosage)),
        unit: unit === "fl oz" ? "fl_oz" : unit,
      },
    });

    return NextResponse.json(additive);
  } catch (error: any) {
    console.error("Error creating additive:", error);
    return NextResponse.json(
      { error: "Failed to create additive" },
      { status: 500 }
    );
  }
}
