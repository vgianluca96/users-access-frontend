import type { CapabilityDetail, GrantCapabilityDetail, GrantCapabilityUpdateEntry, RoleCapabilityPreset } from '../types';

/**
 * Shared "Select Capabilities" matrix logic (spec003 §10.4 / spec004 §6 /
 * spec005 / spec006 §7), factored out so both `GrantEditorDialog.tsx` (edits
 * an existing grant) and `AddGrantDialog.tsx` (spec007 §4, starts from an
 * empty baseline) drive the same matrix off the same rules instead of two
 * copies drifting apart.
 */

export interface MatrixRow {
  resourceId: number;
  resourceName: string;
  cellsByActionId: Map<number, CapabilityDetail>;
}

export interface MatrixColumn {
  actionId: number;
  actionName: string;
}

export type BadgeState = 'preset' | 'added' | 'denied' | 'neutral';
export type PendingColor = 'red' | 'blue' | 'green';
export type Baseline = Pick<GrantCapabilityDetail, 'preset' | 'added' | 'denied'>;
// spec006 §7: 0 = no bulk override applied (baseline), 1 = row/column forced
// to "added", 2 = forced to "denied" — clicking cycles 0 → 1 → 2 → 0.
export type RowCycleState = 0 | 1 | 2;

export const ADDED_TARGET: Baseline = { preset: false, added: true, denied: false };
export const REMOVED_TARGET: Baseline = { preset: false, added: false, denied: false };

export function buildMatrix(capabilities: CapabilityDetail[]): { rows: MatrixRow[]; columns: MatrixColumn[] } {
  const rowsByResourceId = new Map<number, MatrixRow>();
  const columnsByActionId = new Map<number, string>();

  for (const capability of capabilities) {
    if (!rowsByResourceId.has(capability.resourceId)) {
      rowsByResourceId.set(capability.resourceId, {
        resourceId: capability.resourceId,
        resourceName: capability.resourceName,
        cellsByActionId: new Map(),
      });
    }

    rowsByResourceId.get(capability.resourceId)!.cellsByActionId.set(capability.actionId, capability);
    columnsByActionId.set(capability.actionId, capability.actionName);
  }

  const rows = Array.from(rowsByResourceId.values()).sort((a, b) => a.resourceId - b.resourceId);
  const columns = Array.from(columnsByActionId.entries())
    .map(([actionId, actionName]) => ({ actionId, actionName }))
    .sort((a, b) => a.actionId - b.actionId);

  return { rows, columns };
}

export function badgeStateFor(baseline: Baseline | undefined): BadgeState {
  if (!baseline) return 'neutral';
  if (baseline.added) return 'added';
  if (baseline.denied) return 'denied';
  if (baseline.preset) return 'preset';
  return 'neutral';
}

// spec006 §7: derives the pending ring color from the override's own shape,
// not from the baseline it's overriding — this is what lets one function
// cover both individual-click targets (spec005 §2) and bulk row/column
// targets (spec006 §7) uniformly.
export function pendingColorForOverride(override: Baseline): PendingColor {
  if (override.added) return 'green';
  if (override.denied) return 'red';
  if (override.preset) return 'blue';
  return 'red';
}

// spec005 §2's four individual-click transitions, keyed off the capability's
// current baseline state.
export function computeIndividualClickTarget(base: Baseline): Baseline {
  const state = badgeStateFor(base);
  if (state === 'preset') return { preset: true, added: false, denied: true };
  if (state === 'denied') return { preset: true, added: false, denied: false };
  if (state === 'neutral') return ADDED_TARGET;
  return REMOVED_TARGET;
}

// spec005 §2: clicking an individual badge toggles its override on/off.
export function toggleCapabilityOverride(
  current: Map<number, Baseline>,
  capabilityId: number,
  baseline: Map<number, Baseline>,
): Map<number, Baseline> {
  const next = new Map(current);
  if (next.has(capabilityId)) {
    next.delete(capabilityId);
  } else {
    next.set(capabilityId, computeIndividualClickTarget(baseline.get(capabilityId) ?? REMOVED_TARGET));
  }
  return next;
}

// spec006 §7: applies one step of the shared 3-state cycle (added → denied →
// reset) to a set of capabilities — used by both row and column clicks.
export function applyCycleToOverride(
  current: Map<number, Baseline>,
  capabilityIds: number[],
  nextState: RowCycleState,
  baseline: Map<number, Baseline>,
): Map<number, Baseline> {
  const next = new Map(current);

  for (const capabilityId of capabilityIds) {
    if (nextState === 0) {
      next.delete(capabilityId);
    } else if (nextState === 1) {
      next.set(capabilityId, ADDED_TARGET);
    } else {
      const preservedPreset = baseline.get(capabilityId)?.preset ?? false;
      next.set(capabilityId, { preset: preservedPreset, added: false, denied: true });
    }
  }

  return next;
}

// spec005 §3 / spec007 §4: rebuilds the whole baseline from a role's bundle
// (GET /capabilities-preset, spec004 §3) — every capability in the bundle
// becomes {preset: true, added: false, denied: false}; roleId: null (or a
// role with no bundle rows) yields an empty map.
export function buildRoleBundleBaseline(
  rolePresetCapabilities: RoleCapabilityPreset[],
  roleId: number | null,
): Map<number, Baseline> {
  const next = new Map<number, Baseline>();

  if (roleId === null) {
    return next;
  }

  for (const preset of rolePresetCapabilities) {
    if (preset.roleId === roleId) {
      next.set(preset.capabilityId, { preset: true, added: false, denied: false });
    }
  }

  return next;
}

// spec006 §5 (resolved): Save's payload is a direct read of pendingOverride
// (already holds the literal target) falling back to baseline.
export function computeFinalCapabilities(
  baseline: Map<number, Baseline>,
  pendingOverride: Map<number, Baseline>,
): GrantCapabilityUpdateEntry[] {
  const capabilityIds = new Set([...baseline.keys(), ...pendingOverride.keys()]);
  const result: GrantCapabilityUpdateEntry[] = [];

  for (const capabilityId of capabilityIds) {
    const final = pendingOverride.get(capabilityId) ?? baseline.get(capabilityId) ?? REMOVED_TARGET;

    if (final.preset || final.added || final.denied) {
      result.push({ capabilityId, ...final });
    }
  }

  return result;
}

// spec005 §1/§2: background reflects the immutable baseline (never changes on
// click); a constant-width border also reflects baseline — only the inset
// ring (spec006 §6) changes with a pending click, so dimensions never shift.
export const BADGE_BACKGROUND_CLASSES: Record<BadgeState, string> = {
  preset: 'bg-blue-100 text-blue-800',
  added: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  neutral: 'bg-transparent text-slate-500',
};

export const DEFAULT_BORDER_CLASSES: Record<BadgeState, string> = {
  preset: 'border border-blue-500',
  added: 'border border-green-500',
  denied: 'border border-red-500',
  neutral: 'border border-slate-900',
};

// spec006 §6: inset ring (box-shadow), not a border — never affects layout.
export const PENDING_RING_CLASSES: Record<PendingColor, string> = {
  red: 'ring-4 ring-inset ring-red-600',
  blue: 'ring-4 ring-inset ring-blue-600',
  green: 'ring-4 ring-inset ring-green-600',
};

export const LEGEND_BACKGROUND_ITEMS: Array<{ state: BadgeState; label: string }> = [
  { state: 'preset', label: 'Preset' },
  { state: 'added', label: 'Added' },
  { state: 'denied', label: 'Denied' },
  { state: 'neutral', label: 'Neutral' },
];

export const LEGEND_BORDER_ITEMS: Array<{ color: PendingColor; label: string }> = [
  { color: 'red', label: 'Will be removed / denied' },
  { color: 'blue', label: 'Will be restored to preset' },
  { color: 'green', label: 'Will be added' },
];
