import { Directory, File, Paths } from "expo-file-system";

import type { OutboxFileSystem } from "./entry-outbox-store";

const OUTBOX_ROOT = "meadtools-outbox";

/**
 * Stores outbox files in the app's document directory, which the system does
 * not purge like the cache directory. Measurement data is not secret, so it
 * does not use SecureStore; credentials are never written here.
 */
export function createExpoOutboxFileSystem(): OutboxFileSystem {
  return createExpoDocumentFileSystem(OUTBOX_ROOT);
}

/** The same file operations under another folder of the document directory. */
export function createExpoDocumentFileSystem(rootName: string): OutboxFileSystem {
  const root = () => new Directory(Paths.document, rootName);
  const file = (path: readonly string[]) => new File(root(), ...path);
  const parent = (path: readonly string[]) =>
    new Directory(root(), ...path.slice(0, -1));

  return {
    async list(directory) {
      const target = new Directory(root(), ...directory);
      if (!target.exists) return [];
      return target
        .list()
        .filter((entry): entry is File => entry instanceof File)
        .map((entry) => entry.name);
    },

    async read(path) {
      const target = file(path);
      return target.exists ? target.text() : null;
    },

    async write(path, contents) {
      parent(path).create({ intermediates: true, idempotent: true });
      const target = file(path);
      if (!target.exists) target.create();
      target.write(contents);
    },

    async move(from, to) {
      file(from).moveSync(file(to), { overwrite: true });
    },

    async remove(path) {
      const target = file(path);
      if (target.exists) target.delete();
    }
  };
}
