export type HydrometerTokenState = {
  token: string | null | undefined;
  busy: boolean;
  failed: boolean;
};
const hidden = (): HydrometerTokenState => ({ token: undefined, busy: false, failed: false });

/** Memory-only reveal session. Late responses cannot reveal a token after blur/background. */
export function createHydrometerTokenSession(update: (state: HydrometerTokenState) => void) {
  let active = false;
  let revision = 0;
  let pending = false;
  return {
    activate() {
      active = true;
      update({ ...hidden(), busy: pending });
    },
    hide() {
      active = false;
      revision++;
      update(hidden());
    },
    async load(operation: () => Promise<string | null>) {
      if (!active || pending) return;
      const requestRevision = revision;
      pending = true;
      update({ token: undefined, busy: true, failed: false });
      try {
        const token = await operation();
        if (active && revision === requestRevision) update({ token, busy: false, failed: false });
      } catch {
        if (active && revision === requestRevision) update({ ...hidden(), failed: true });
      } finally {
        pending = false;
        if (active && revision !== requestRevision) update(hidden());
      }
    }
  };
}
