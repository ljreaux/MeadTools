export function refreshTokenBelongsToUser(
  payload: string | object,
  userId: number
) {
  return (
    typeof payload !== "string" &&
    "id" in payload &&
    payload.id === userId
  );
}
