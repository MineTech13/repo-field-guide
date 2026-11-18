import { MAPS } from '../data';
import { PHASES } from '../engine/rules/phase';

export function MapsPage() {
  return (
    <div class="stack">
      <div class="page-head">
        <h1>Maps</h1>
        <p class="muted">Each level loads one of these at random. Hazards ramp up with the level number.</p>
      </div>
      <div class="maps-grid">
        {MAPS.map((m) => (
          <section class="panel map-card">
            <h2>
              <span aria-hidden="true">{m.emoji}</span> {m.name}
            </h2>
            <p>{m.summary}</p>
            <span class="chips">
              {m.tags.map((t) => (
                <span class="chip">{t}</span>
              ))}
            </span>
            <dl class="facts">
              <dt>Light</dt>
              <dd>{m.lighting}</dd>
              <dt>Hiding</dt>
              <dd>{m.hiding}</dd>
            </dl>
            {PHASES.map((p) => (
              <div class="phase-block">
                <h3 class={`phase-tag phase-${p.phase}`}>{p.label}</h3>
                <ul>
                  {m.hazards[p.phase].map((h) => (
                    <li>{h}</li>
                  ))}
                </ul>
              </div>
            ))}
            <ul class="tips">
              {m.tips.map((t) => (
                <li>💡 {t}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
