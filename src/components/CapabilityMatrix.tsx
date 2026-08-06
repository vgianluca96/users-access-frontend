import type { CapabilityDetail } from '../types';
import {
  BADGE_BACKGROUND_CLASSES,
  DEFAULT_BORDER_CLASSES,
  LEGEND_BACKGROUND_ITEMS,
  LEGEND_BORDER_ITEMS,
  PENDING_RING_CLASSES,
  badgeStateFor,
  buildMatrix,
  pendingColorForOverride,
  type Baseline,
  type MatrixColumn,
  type MatrixRow,
  type RowCycleState,
} from '../lib/capabilityMatrix';

interface CapabilityMatrixProps {
  capabilities: CapabilityDetail[];
  baseline: Map<number, Baseline>;
  pendingOverride: Map<number, Baseline>;
  roleSwitchHighlight: Set<number>;
  rowCycleState: Map<number, RowCycleState>;
  columnCycleState: Map<number, RowCycleState>;
  onToggleCapability: (capabilityId: number) => void;
  onToggleRow: (row: MatrixRow) => void;
  onToggleColumn: (column: MatrixColumn, rows: MatrixRow[]) => void;
}

/**
 * The "Select Capabilities" legend + resource×action matrix, shared between
 * `GrantEditorDialog.tsx` (edits an existing grant's capabilities) and
 * `AddGrantDialog.tsx` (spec007 §4, starts from an empty baseline) — same
 * rendering rules (spec003 §10.4 / spec005 / spec006 §6-7) driven by
 * whatever `baseline`/`pendingOverride` state the caller owns.
 */
export function CapabilityMatrix({
  capabilities,
  baseline,
  pendingOverride,
  roleSwitchHighlight,
  rowCycleState,
  columnCycleState,
  onToggleCapability,
  onToggleRow,
  onToggleColumn,
}: CapabilityMatrixProps) {
  const { rows, columns } = buildMatrix(capabilities);

  return (
    <>
      {/* spec005 §4: legend for both color channels. */}
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-slate-500">Background:</span>
          {LEGEND_BACKGROUND_ITEMS.map((item) => (
            <span key={item.state} className="flex items-center gap-1.5">
              <span
                className={`h-3 w-3 rounded-full ${DEFAULT_BORDER_CLASSES[item.state]} ${BADGE_BACKGROUND_CLASSES[item.state]}`}
              />
              {item.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-slate-500">Border (pending):</span>
          {LEGEND_BORDER_ITEMS.map((item) => (
            <span key={item.color} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-full bg-white ${PENDING_RING_CLASSES[item.color]}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Resource</th>
              {columns.map((column) => {
                const columnState = columnCycleState.get(column.actionId) ?? 0;
                const columnRingClass =
                  columnState === 1
                    ? PENDING_RING_CLASSES.green
                    : columnState === 2
                      ? PENDING_RING_CLASSES.red
                      : '';

                return (
                  <th key={column.actionId} className="px-3 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => onToggleColumn(column, rows)}
                      title="Click to cycle: add column, deny column, reset column"
                      className={`cursor-pointer rounded px-1.5 py-0.5 hover:bg-slate-200 ${columnRingClass}`}
                    >
                      {column.actionName}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const rowState = rowCycleState.get(row.resourceId) ?? 0;
              const rowRingClass =
                rowState === 1 ? PENDING_RING_CLASSES.green : rowState === 2 ? PENDING_RING_CLASSES.red : '';

              return (
                <tr key={row.resourceId}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">
                    <button
                      type="button"
                      onClick={() => onToggleRow(row)}
                      title="Click to cycle: add row, deny row, reset row"
                      className={`cursor-pointer rounded px-1.5 py-0.5 hover:bg-slate-100 ${rowRingClass}`}
                    >
                      {row.resourceName}
                    </button>
                  </td>
                  {columns.map((column) => {
                    const capability = row.cellsByActionId.get(column.actionId);

                    if (!capability) {
                      return <td key={column.actionId} className="px-3 py-2" />;
                    }

                    const state = badgeStateFor(baseline.get(capability.id));
                    const override = pendingOverride.get(capability.id);
                    const borderClass = override
                      ? PENDING_RING_CLASSES[pendingColorForOverride(override)]
                      : roleSwitchHighlight.has(capability.id)
                        ? PENDING_RING_CLASSES.blue
                        : DEFAULT_BORDER_CLASSES[state];

                    return (
                      <td key={column.actionId} className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onToggleCapability(capability.id)}
                          title={`${row.resourceName}:${column.actionName}`}
                          className={`cursor-pointer rounded-full px-2 py-1 text-xs font-medium ${BADGE_BACKGROUND_CLASSES[state]} ${borderClass}`}
                        >
                          {column.actionName}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
