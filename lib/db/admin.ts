import { brew_stage, Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { groupEntriesByStage, type BrewEntryForApp } from "@/lib/db/brews";
import {
  projectBrewView,
  projectBrewViewListItem
} from "@/lib/brews/projectBrewView";
import type { BrewViewDetail, BrewViewListItem } from "@/types/brewView";

export type AdminSummary = {
  users: number;
  brews: number;
  activeBrews: number;
  recipes: number;
  privateRecipes: number;
  yeasts: number;
  ingredients: number;
  additives: number;
};

export async function getAdminSummary(): Promise<AdminSummary> {
  const [
    users,
    brews,
    activeBrews,
    recipes,
    privateRecipes,
    yeasts,
    ingredients,
    additives
  ] = await prisma.$transaction([
    prisma.users.count(),
    prisma.brews.count(),
    prisma.brews.count({ where: { end_date: null } }),
    prisma.recipes.count(),
    prisma.recipes.count({ where: { private: true } }),
    prisma.yeasts.count(),
    prisma.ingredients.count(),
    prisma.additives.count()
  ]);

  return {
    users,
    brews,
    activeBrews,
    recipes,
    privateRecipes,
    yeasts,
    ingredients,
    additives
  };
}

export type AdminBrewsPage = {
  brews: BrewViewListItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  limit: number;
};

export async function getAdminBrewsPage({
  page = 1,
  limit = 10,
  query = "",
  stage,
  status
}: {
  page?: number;
  limit?: number;
  query?: string;
  stage?: string;
  status?: "active" | "complete";
}): Promise<AdminBrewsPage> {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const take = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const search = query.trim();
  const where: Prisma.brewsWhereInput = {};

  if (stage && Object.values(brew_stage).includes(stage as brew_stage)) {
    where.stage = stage as brew_stage;
  }

  if (status === "active") where.end_date = null;
  if (status === "complete") where.end_date = { not: null };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { recipes: { name: { contains: search, mode: "insensitive" } } },
      {
        users: {
          OR: [
            {
              public_username: {
                contains: search,
                mode: "insensitive"
              }
            },
            { email: { contains: search, mode: "insensitive" } }
          ]
        }
      }
    ];
  }

  const [rows, totalCount] = await prisma.$transaction([
    prisma.brews.findMany({
      where,
      skip: (normalizedPage - 1) * take,
      take,
      orderBy: [{ end_date: "desc" }, { start_date: "desc" }],
      select: {
        id: true,
        name: true,
        start_date: true,
        end_date: true,
        stage: true,
        batch_number: true,
        current_volume_liters: true,
        gravity_unit_preference: true,
        public: true,
        latest_gravity: true,
        recipe_id: true,
        recipes: { select: { name: true } },
        users: { select: { public_username: true, email: true } },
        _count: { select: { entries: true } }
      }
    }),
    prisma.brews.count({ where })
  ]);

  return {
    brews: rows.map((brew) =>
      projectBrewViewListItem({
        ...brew,
        recipe_name: brew.recipes?.name ?? null,
        entry_count: brew._count.entries,
        owner: brew.users
          ? {
              displayName:
                brew.users.public_username?.trim() || brew.users.email
            }
          : null
      })
    ),
    totalCount,
    totalPages: Math.ceil(totalCount / take),
    page: normalizedPage,
    limit: take
  };
}

export async function getAdminBrew(
  brewId: string
): Promise<BrewViewDetail | null> {
  const brew = await prisma.brews.findUnique({
    where: { id: brewId },
    select: {
      id: true,
      name: true,
      start_date: true,
      end_date: true,
      stage: true,
      batch_number: true,
      current_volume_liters: true,
      gravity_unit_preference: true,
      public: true,
      latest_gravity: true,
      recipe_id: true,
      recipe_snapshot: true,
      recipes: { select: { name: true } },
      users: { select: { public_username: true, email: true } },
      entries: {
        orderBy: [{ datetime: "asc" }, { id: "asc" }],
        select: {
          id: true,
          datetime: true,
          type: true,
          title: true,
          note: true,
          gravity: true,
          temperature: true,
          temp_units: true,
          data: true
        }
      },
      logs: {
        orderBy: { datetime: "asc" },
        select: {
          datetime: true,
          temperature: true,
          temp_units: true,
          battery: true,
          gravity: true,
          calculated_gravity: true
        }
      },
      _count: { select: { entries: true } }
    }
  });

  if (!brew) return null;

  const entries: BrewEntryForApp[] = brew.entries.map((entry) => ({
    ...entry,
    data: entry.data ?? null,
    user_id: null
  }));

  return projectBrewView({
    ...brew,
    recipe_name: brew.recipes?.name ?? null,
    entry_count: brew._count.entries,
    owner: brew.users
      ? {
          displayName: brew.users.public_username?.trim() || brew.users.email
        }
      : null,
    entries,
    entries_by_stage: groupEntriesByStage(brew.stage, entries),
    logs: brew.logs
  });
}
