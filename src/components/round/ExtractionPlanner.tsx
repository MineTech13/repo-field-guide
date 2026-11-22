import { BIG_VALUE, dollarsK, type ExtractionPlan, type PlannedPoint } from '../../engine/extraction';

const ROLE: Record<PlannedPoint['role'], string> = { done: 'done', now: 'now', next: 'next', last: 'last · by the truck' };

/**
 * Strategic extraction plan: big items to their closest extraction, small ones topped up
 * along the way, and the extraction nearest the truck saved for last.
 */
export function ExtractionPlanner({ plan, total, compact }: { plan: ExtractionPlan; total?: number; completed?: number; compact?: boolean }) {
  const open = plan.points.filter((p) => !p.done);
  const done = plan.points.filter((p) => p.done);
  const shown = compact ? 3 : Infinity;
  return (
    <div class="ext-plan">
      <p class="muted small">
        {plan.points.length} of {total ?? '?'} found · {dollarsK(plan.discoveredValue)} discovered
        {plan.inHaul ? ` · ${dollarsK(plan.inHaul)} already in` : ''}. Big items (bulky or {dollarsK(BIG_VALUE)}+) go to their closest extraction, small ones are grabbed along the way
        {plan.truckKnown ? ', and the one nearest the truck is saved for last' : ''}.
      </p>
      {plan.points.length === 0 && <p class="muted small">No extraction point found yet. Explore to find one.</p>}
      {open.map((p) => {
        const pct = p.goal ? Math.min(100, Math.round((p.planned / p.goal) * 100)) : null;
        return (
          <div class={`ext-point role-${p.role}`}>
            <div class="ext-head">
              <span class="ext-order">{p.order}</span>
              <strong>Extraction</strong>
              <span class="badge">{ROLE[p.role]}</span>
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
            {p.big.length > 0 && (
              <ol class="ext-items">
                {p.big.slice(0, shown).map((it) => (
                  <li>
                    <span>📦 {it.name}</span>
                    <span class="muted small">~{it.distance} m</span>
                    <strong>{dollarsK(it.value)}</strong>
                  </li>
                ))}
              </ol>
            )}
            {p.big.length > shown && <p class="muted small">+{p.big.length - shown} more big</p>}
            {p.topUp.length > 0 && (
              <p class="ext-topup small">
                <span class="muted">{p.role === 'last' ? 'Small ones, any time before this:' : 'Grab on the way:'}</span>{' '}
                {p.topUp
                  .slice(0, compact ? 4 : 12)
                  .map((it) => `${it.name} ${dollarsK(it.value)}`)
                  .join(' · ')}
                {p.topUp.length > (compact ? 4 : 12) ? ` · +${p.topUp.length - (compact ? 4 : 12)}` : ''}
              </p>
            )}
            {p.big.length === 0 && p.topUp.length === 0 && <p class="muted small">Nothing discovered for this one yet.</p>}
            {p.shortfall > 0 && <p class="ext-short small">Still {dollarsK(p.shortfall)} short: find more nearby.</p>}
          </div>
        );
      })}
      {plan.notFound > 0 && (
        <p class="muted small">
          {plan.notFound} extraction point{plan.notFound === 1 ? '' : 's'} not found yet: the order may change once found.
        </p>
      )}
      {done.length > 0 && <p class="muted small">Done: {done.length}.</p>}
      {plan.unassigned.length > 0 && <p class="muted small">Waiting for an extraction point: {plan.unassigned.map((u) => `${u.name} ${dollarsK(u.value)}`).join(', ')}.</p>}
    </div>
  );
}
