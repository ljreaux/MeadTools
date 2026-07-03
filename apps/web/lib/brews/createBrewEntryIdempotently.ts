export type BrewEntryIdentity = {
  id: string;
  brew_id: string;
  user_id: number | null;
};

export class BrewEntryIdConflictError extends Error {
  constructor() {
    super("Entry ID is already in use");
    this.name = "BrewEntryIdConflictError";
  }
}

export async function createBrewEntryIdempotently({
  brewId,
  userId,
  clientEntryId,
  create
}: {
  brewId: string;
  userId: number;
  clientEntryId?: string;
  create: (clientEntryId?: string) => Promise<BrewEntryIdentity>;
}) {
  const entry = await create(clientEntryId);

  if (
    clientEntryId &&
    (entry.id !== clientEntryId ||
      entry.brew_id !== brewId ||
      entry.user_id !== userId)
  ) {
    throw new BrewEntryIdConflictError();
  }

  return entry;
}
