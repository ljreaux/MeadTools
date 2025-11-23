export async function deleteRecipeApi(
  id: number,
  token: string | null,
  nextAuthAccessToken?: string | null
) {
  const res = await fetch(`/api/recipes/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${nextAuthAccessToken || token}`
    }
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to delete recipe");
  }

  return res.json(); // whatever your route returns
}
