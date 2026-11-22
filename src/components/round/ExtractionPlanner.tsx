import { dollarsK, type ExtractionPlan } from '../../engine/extraction';

/** Biggest discovered valuables first, each to its closest found extraction point. */
export function ExtractionPlanner({ plan, total, completed, compact }: { plan: ExtractionPlan; total?: number; completed?: number; compact?: boolean }) {
  const shown = compact ? 3 : Infinity;
  const open = plan.points.filter((p) => !p.done);
  return (
    <div class="ext-plan">
      <p class="muted small">
        {plan.points.length} of {total ?? '?'} extraction points found{completed ? ` · ${completed} done` : ''} · {dollarsK(plan.discoveredValue)} discovered
        {plan.inHaul ? ` · ${dollarsK(plan.inHaul)} already in an extraction` : ''}. Biggest first, each to its closest extraction.
      </p>
      {plan.points.length === 0 && <p class="muted small">No extraction point found yet. Explore to find one.</p>}
      {open.map((p) => {
        const pct = p.goal ? Math.min(100, Math.round((p.planned / p.goal) * 100)) : null;
        return (
          <div class={`ext-point ${p.current ? 'current' : ''}`}>
            <div class="ext-head">
              <strong>Extraction {p.index + 1}</strong>
              {p.current && <span class="badge">active</span>}
              <span class="ext-sum">
                {dollarsK(p.planned)}
                {p.goal ? <span class="muted"> / {dollarsK(p.goal)}</span> : null}
              </span>
            </div>
            {pct != null && (
              <div class="ext-bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} class={pct >= 100 ? 'full' : ''} />
              </div>
            )}
            {p.items.length === 0 ? (
              <p class="muted small">Nothing discovered closest to this one yet.</p>
            ) : (
              <ol class="ext-items">
                {p.items.slice(0, shown).map((it) => (
                  <li>
                    <span>{it.name}</span>
                    <span class="muted small">~{it.distance} m</span>
                    <strong>{dollarsK(it.value)}</strong>
                  </li>
                ))}
              </ol>
            )}
            {p.items.length > shown && <p class="muted small">+{p.items.length - shown} more</p>}
          </div>
        );
      })}
      {plan.points.some((p) => p.done) && (
        <p class="muted small">
          Done:{' '}
          {plan.points
            .filter((p) => p.done)
            .map((p) => `Extraction ${p.index + 1}`)
            .join(', ')}
          .
        </p>
      )}
      {plan.unassigned.length > 0 && <p class="muted small">Waiting for an extraction point: {plan.unassigned.map((u) => `${u.name} ${dollarsK(u.value)}`).join(', ')}.</p>}
    </div>
  );
}
