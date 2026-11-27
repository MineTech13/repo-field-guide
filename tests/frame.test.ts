import { describe, expect, it } from 'vitest';
import { frameView } from '../src/components/round/LiveMap';

describe('minimap camera', () => {
  const content: [number, number, number, number] = [0, 100, 0, 40]; // a long, flat explored map

  it('fills a wide box: the view takes the box shape', () => {
    const [a, b, c, d] = frameView(content, [50, 0, 20], 25, 2);
    expect(b - a).toBe(100);
    expect(d - c).toBe(50);
  });

  it('stays centred on you', () => {
    const [a, b, c, d] = frameView(content, [2, 0, 20], 25, 1);
    expect((a + b) / 2).toBe(2);
    expect((c + d) / 2).toBe(20);
  });

  it('All: the whole map, padded to the box shape', () => {
    const [a, b, c, d] = frameView(content, null, null, 1);
    expect(b - a).toBe(100);
    expect(d - c).toBe(100);
    expect(a).toBe(0);
  });
});
