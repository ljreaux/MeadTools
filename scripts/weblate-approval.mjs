export function buildUnitApprovalPayload(unit) {
  if (!Array.isArray(unit.target) || unit.target.length === 0) {
    throw new Error(`Weblate unit ${unit.id} has no translation target to approve.`);
  }

  return {
    state: 30,
    target: unit.target,
  };
}

export async function approveWeblateUnit({ weblateUrl, headers, unit }) {
  const response = await fetch(`${weblateUrl}/api/units/${unit.id}/`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(buildUnitApprovalPayload(unit)),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Unable to approve Weblate unit ${unit.id} (${response.status}): ${detail}`,
    );
  }
}
