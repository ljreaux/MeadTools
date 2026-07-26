export function buildUnitApprovalPayload(unit) {
  if (!Array.isArray(unit.target) || unit.target.length === 0) {
    throw new Error(`Weblate unit ${unit.id} has no translation target to approve.`);
  }

  return {
    state: 30,
    target: unit.target,
  };
}

export function getPullRequestPayload(event) {
  const pullRequest = event?.pull_request || event;
  if (!pullRequest?.labels || !pullRequest?.user?.login) {
    throw new Error("Expected a GitHub pull request payload.");
  }
  return pullRequest;
}

export function findExpectedWeblateUnit(units, { context, target }) {
  return units.find(
    (candidate) => candidate.context === context && candidate.target?.[0] === target,
  );
}

export async function loadWeblateComponentUnits({
  weblateUrl,
  headers,
  component,
}) {
  const query = new URLSearchParams({
    q: `component:${component} language:de`,
    page_size: "10000",
  });
  const response = await fetch(`${weblateUrl}/api/units/?${query}`, { headers });
  if (!response.ok) {
    throw new Error(`Unable to load Weblate units for component ${component}.`);
  }

  const { results } = await response.json();
  return results;
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
