import { useMemo } from 'preact/hooks';
import { advise } from '../engine/advise';
import { useRound } from '../hooks';
import { defaultRound } from '../state/round';
import { AdvicePanel } from './AdvicePanel';
import { MonsterPicker } from './MonsterPicker';
import { RoundMemory } from './RoundMemory';
import { RoundSetup } from './RoundSetup';

export function RoundPage() {
  const [state, update, replace] = useRound();
  const advice = useMemo(() => advise(state), [state]);

  return (
    <div class="round-grid">
      <div class="area-setup">
        <RoundSetup
          state={state}
          update={update}
          onReset={() => {
            if (confirm('Clear the whole round, including the optional memory?')) replace(defaultRound());
          }}
        />
      </div>
      <div class="area-picker">
        <MonsterPicker state={state} update={update} />
      </div>
      <div class="area-advice">
        <AdvicePanel advice={advice} state={state} />
      </div>
      <div class="area-memory">
        <RoundMemory state={state} update={update} />
      </div>
    </div>
  );
}
