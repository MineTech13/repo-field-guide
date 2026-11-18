import { phaseLabel } from '../engine/rules/phase';
import type { Advice, RoundState } from '../engine/types';
import { MonsterCard } from './MonsterCard';
import { SpawnCheckPanel } from './SpawnCheckPanel';
import { Section, SevIcon } from './ui';

export function AdvicePanel({ advice, state }: { advice: Advice; state: RoundState }) {
  const { score, label, call, watchOut, combos, map, phase, monsters, modifiers } = advice;
  const memoryBullets = modifiers.filter((m) => m.severity !== 'danger');

  return (
    <div class="advice" aria-live="polite">
      <section class={`threat-banner level-${label.toLowerCase()}`}>
        <div class="threat-top">
          <div>
            <div class="threat-label">Threat</div>
            <div class="threat-word">{label}</div>
          </div>
          <div class="threat-score" aria-label={`Threat score ${score} of 100`}>
            {score}
            <small>/100</small>
          </div>
        </div>
        <div class="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="Threat meter">
          <div class="meter-fill" style={{ width: `${score}%` }} />
        </div>
        <div class="call">
          <strong>{call.title}.</strong> {call.text}
        </div>
        <div class="muted small">
          {map ? `${map.emoji} ${map.name}` : 'No map picked'} · Level {state.level} · {phaseLabel(phase)}
        </div>
      </section>

      <Section title="Watch out for">
        <ul class="bullets">
          {watchOut.map((b) => (
            <li class={`bullet bullet-${b.severity}`}>
              <SevIcon severity={b.severity} />
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
      </Section>

      <SpawnCheckPanel state={state} />

      {combos.length > 0 && (
        <Section title="Dangerous combos" aside={<span class="muted small">{combos.length}</span>}>
          <ul class="bullets">
            {combos.map((c) => (
              <li class={`bullet bullet-${c.severity}`}>
                <SevIcon severity={c.severity} />
                <span>
                  <strong>{c.title}.</strong> {c.text}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {map && (
        <Section title={`${map.emoji} ${map.name}`} aside={<span class={`phase-tag phase-${phase}`}>{phase}</span>}>
          <p class="muted">{map.summary}</p>
          <ul class="bullets">
            {map.hazards[phase].map((h) => (
              <li class={`bullet bullet-${phase === 'early' ? 'info' : 'warn'}`}>
                <SevIcon severity={phase === 'early' ? 'info' : 'warn'} />
                <span>{h}</span>
              </li>
            ))}
          </ul>
          <dl class="facts">
            <dt>Light</dt>
            <dd>{map.lighting}</dd>
            <dt>Hiding</dt>
            <dd>{map.hiding}</dd>
          </dl>
          {map.tips.length > 0 && (
            <ul class="tips">
              {map.tips.map((t) => (
                <li>💡 {t}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {memoryBullets.length > 0 && (
        <Section title="From your round memory">
          <ul class="bullets">
            {memoryBullets.map((b) => (
              <li class={`bullet bullet-${b.severity}`}>
                <SevIcon severity={b.severity} />
                <span>{b.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {monsters.length > 0 && (
        <div class="cards">
          <h2 class="cards-title">Monster playbook</h2>
          {monsters.map((ma, i) => (
            <MonsterCard
              key={ma.monster.id}
              monster={ma.monster}
              spotted={ma.spotted}
              usableItems={ma.usableItems}
              noAnswer={ma.noAnswer}
              defaultOpen={i < 2 && !ma.spotted.killed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
