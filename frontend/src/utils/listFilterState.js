/** Copy draft list filters into applied state (explicit Apply UX). */
export function applyDraftListFilters(draft, setApplied) {
  setApplied({ ...draft });
}

/** Reset draft and applied list filters to the same empty defaults. */
export function clearListFilters(emptyDefaults, setDraft, setApplied) {
  const cleared = { ...emptyDefaults };
  setDraft(cleared);
  setApplied(cleared);
  return cleared;
}
