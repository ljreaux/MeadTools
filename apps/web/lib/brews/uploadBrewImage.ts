import { BrewImageError } from "@meadtools/brew-domain/images";
import {
  brewImageErrorResponseSchema,
  brewImageMutationResponseSchema,
} from "@meadtools/api-contract/brew-images";
import type { CreateBrewImageRequestBody } from "@meadtools/api-contract/contracts";

/** Shared browser transport: stable operation IDs make a lost response safe to retry. */
export function uploadBrewImage(
  brewId: string,
  body: CreateBrewImageRequestBody,
  token: string | null,
  progress: (percent: number) => void,
) {
  return new Promise<ReturnType<typeof brewImageMutationResponseSchema.parse>>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/brews/${brewId}/images`);
      xhr.setRequestHeader("Content-Type", "application/json");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.timeout = 65_000;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          progress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        let json: unknown;
        try {
          json = JSON.parse(xhr.responseText);
        } catch {
          reject(new BrewImageError("UPLOAD_FAILED"));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          const result = brewImageMutationResponseSchema.safeParse(json);
          if (result.success) resolve(result.data);
          else reject(new BrewImageError("UPLOAD_FAILED"));
        } else {
          const error = brewImageErrorResponseSchema.safeParse(json);
          reject(
            new BrewImageError(
              error.success ? error.data.code : "UPLOAD_FAILED",
            ),
          );
        }
      };
      xhr.onerror = xhr.ontimeout = () =>
        reject(new BrewImageError("UPLOAD_FAILED"));
      xhr.send(JSON.stringify(body));
    },
  );
}
