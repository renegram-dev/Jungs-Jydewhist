import { describe, it, expect } from 'vitest';
import {
  PLAYERS,
  getContractList,
  getContract,
  calculateHandScore,
  validateScoreDelta,
  summarizeHand,
  isValidTricks,
} from '../lib/scoring.js';

const [RENE, THOMAS, CARSTEN, TOM] = PLAYERS;

// Convenience: index into the contract list by exact label.
function idOf(label) {
  const c = getContractList().find((x) => x.label === label);
  if (!c) throw new Error(`No contract labelled ${label}`);
  return c.id;
}

describe('contract list', () => {
  it('has 30 contracts with index === id === rank', () => {
    const list = getContractList();
    expect(list).toHaveLength(30);
    list.forEach((c, i) => expect(c.id).toBe(i));
  });

  it('uses basePoints = 10 + 7 * rank for every contract', () => {
    for (const c of getContractList()) {
      expect(c.basePoints).toBe(10 + 7 * c.id);
    }
  });

  it('places the contracts in the exact bidding order', () => {
    const labels = getContractList().map((c) => c.label);
    expect(labels).toEqual([
      '7', '7 halve', '7 gode', '7 VIP',
      '8', '8 halve', '8 gode', '8 VIP',
      '9', 'Sol', '9 halve', '9 gode', '9 VIP',
      '10', 'Ren sol', '10 halve', '10 gode', '10 VIP',
      '11', '11 halve', '11 gode', '11 VIP',
      '12', '12 halve', '12 gode', '12 VIP',
      '13', '13 halve', '13 gode', '13 VIP',
    ]);
  });

  it('marks Sol (id 9) and Ren sol (id 14) as solo with the documented bases', () => {
    expect(getContract(9)).toMatchObject({ label: 'Sol', isSolo: true, basePoints: 73 });
    expect(getContract(14)).toMatchObject({ label: 'Ren sol', isSolo: true, basePoints: 108 });
  });

  it('derives the required tricks from the label for ordinary contracts', () => {
    expect(getContract(idOf('7')).requiredTricks).toBe(7);
    expect(getContract(idOf('9 gode')).requiredTricks).toBe(9);
    expect(getContract(idOf('10 VIP')).requiredTricks).toBe(10);
    expect(getContract(idOf('13 halve')).requiredTricks).toBe(13);
  });
});

describe('calculateHandScore — the 9 worked scoring cases', () => {
  it('1) René declares 7 with Thomas, 7 tricks -> +-10', () => {
    const r = calculateHandScore({
      contractId: idOf('7'), declarer: RENE, partnerMode: 'partner', partner: THOMAS, tricks: 7,
    });
    expect(r.success).toBe(true);
    expect(r.basePoints).toBe(10);
    expect(r.handPoints).toBe(10);
    expect(r.delta).toEqual({ [RENE]: 10, [THOMAS]: 10, [CARSTEN]: -10, [TOM]: -10 });
  });

  it('2) René declares 7 with Thomas, 9 tricks -> +2 over, +-12', () => {
    const r = calculateHandScore({
      contractId: idOf('7'), declarer: RENE, partnerMode: 'partner', partner: THOMAS, tricks: 9,
    });
    expect(r.overtricks).toBe(2);
    expect(r.handPoints).toBe(12);
    expect(r.delta).toEqual({ [RENE]: 12, [THOMAS]: 12, [CARSTEN]: -12, [TOM]: -12 });
  });

  it('3) René declares 7 with Thomas, 6 tricks -> 1 under, lost', () => {
    const r = calculateHandScore({
      contractId: idOf('7'), declarer: RENE, partnerMode: 'partner', partner: THOMAS, tricks: 6,
    });
    expect(r.success).toBe(false);
    expect(r.undertricks).toBe(1);
    expect(r.handPoints).toBe(15);
    expect(r.delta).toEqual({ [RENE]: -15, [THOMAS]: -15, [CARSTEN]: 15, [TOM]: 15 });
  });

  it('4) René declares 8, self-partner, 8 tricks -> +114 / -38', () => {
    const r = calculateHandScore({
      contractId: idOf('8'), declarer: RENE, partnerMode: 'self', partner: null, tricks: 8,
    });
    expect(r.basePoints).toBe(38);
    expect(r.handPoints).toBe(38);
    expect(r.delta).toEqual({ [RENE]: 114, [THOMAS]: -38, [CARSTEN]: -38, [TOM]: -38 });
  });

  it('5) René declares Sol, 1 trick -> +219 / -73', () => {
    const r = calculateHandScore({
      contractId: idOf('Sol'), declarer: RENE, partnerMode: 'solo', partner: null, tricks: 1,
    });
    expect(r.success).toBe(true);
    expect(r.handPoints).toBe(73);
    expect(r.delta).toEqual({ [RENE]: 219, [THOMAS]: -73, [CARSTEN]: -73, [TOM]: -73 });
  });

  it('6) René declares Sol, 0 tricks -> +222 / -74', () => {
    const r = calculateHandScore({
      contractId: idOf('Sol'), declarer: RENE, partnerMode: 'solo', partner: null, tricks: 0,
    });
    expect(r.handPoints).toBe(74);
    expect(r.delta).toEqual({ [RENE]: 222, [THOMAS]: -74, [CARSTEN]: -74, [TOM]: -74 });
  });

  it('7) René declares Sol, 2 tricks -> lost, -234 / +78', () => {
    const r = calculateHandScore({
      contractId: idOf('Sol'), declarer: RENE, partnerMode: 'solo', partner: null, tricks: 2,
    });
    expect(r.success).toBe(false);
    expect(r.handPoints).toBe(78);
    expect(r.delta).toEqual({ [RENE]: -234, [THOMAS]: 78, [CARSTEN]: 78, [TOM]: 78 });
  });

  it('8) René declares Ren sol, 0 tricks -> +324 / -108', () => {
    const r = calculateHandScore({
      contractId: idOf('Ren sol'), declarer: RENE, partnerMode: 'solo', partner: null, tricks: 0,
    });
    expect(r.success).toBe(true);
    expect(r.handPoints).toBe(108);
    expect(r.delta).toEqual({ [RENE]: 324, [THOMAS]: -108, [CARSTEN]: -108, [TOM]: -108 });
  });

  it('9) René declares Ren sol, 1 trick -> lost, -339 / +113', () => {
    const r = calculateHandScore({
      contractId: idOf('Ren sol'), declarer: RENE, partnerMode: 'solo', partner: null, tricks: 1,
    });
    expect(r.success).toBe(false);
    expect(r.handPoints).toBe(113);
    expect(r.delta).toEqual({ [RENE]: -339, [THOMAS]: 113, [CARSTEN]: 113, [TOM]: 113 });
  });

  it('forces solo mode for Sol/Ren sol even if a partner is supplied', () => {
    const r = calculateHandScore({
      contractId: idOf('Sol'), declarer: RENE, partnerMode: 'partner', partner: THOMAS, tricks: 0,
    });
    expect(r.delta).toEqual({ [RENE]: 222, [THOMAS]: -74, [CARSTEN]: -74, [TOM]: -74 });
  });
});

describe('validateScoreDelta — case 10 and friends', () => {
  it('accepts a zero-sum delta', () => {
    expect(validateScoreDelta({ [RENE]: 10, [THOMAS]: 10, [CARSTEN]: -10, [TOM]: -10 })).toBe(true);
  });

  it('rejects a non-zero-sum manual override', () => {
    expect(validateScoreDelta({ [RENE]: 10, [THOMAS]: 10, [CARSTEN]: -10, [TOM]: -9 })).toBe(false);
  });

  it('rejects deltas missing a player or with extra keys', () => {
    expect(validateScoreDelta({ [RENE]: 0, [THOMAS]: 0, [CARSTEN]: 0 })).toBe(false);
    expect(validateScoreDelta({ ...{ [RENE]: 0, [THOMAS]: 0, [CARSTEN]: 0, [TOM]: 0 }, Extra: 0 })).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(validateScoreDelta({ [RENE]: 0.5, [THOMAS]: -0.5, [CARSTEN]: 0, [TOM]: 0 })).toBe(false);
  });
});

describe('every computed delta is zero-sum (property check)', () => {
  it('holds across many contracts, modes and trick counts', () => {
    const list = getContractList();
    for (const c of list) {
      for (let tricks = 0; tricks <= 13; tricks++) {
        const modes = c.isSolo
          ? [{ mode: 'solo', partner: null }]
          : [
              { mode: 'partner', partner: THOMAS },
              { mode: 'self', partner: null },
            ];
        for (const { mode, partner } of modes) {
          const r = calculateHandScore({
            contractId: c.id, declarer: RENE, partnerMode: mode, partner, tricks,
          });
          const sum = PLAYERS.reduce((acc, p) => acc + r.delta[p], 0);
          expect(sum).toBe(0);
          expect(validateScoreDelta(r.delta)).toBe(true);
        }
      }
    }
  });
});

describe('isValidTricks', () => {
  it('accepts 0..13 integers only', () => {
    expect(isValidTricks(0)).toBe(true);
    expect(isValidTricks(13)).toBe(true);
    expect(isValidTricks(-1)).toBe(false);
    expect(isValidTricks(14)).toBe(false);
    expect(isValidTricks(3.5)).toBe(false);
  });
});

describe('summarizeHand', () => {
  it('produces the documented compact line for a partner hand', () => {
    const hand = {
      handNumber: 3,
      declarer: RENE,
      partnerMode: 'partner',
      partner: TOM,
      contractId: idOf('9 gode'),
      contractLabel: '9 gode',
      tricks: 10,
      success: true,
      delta: { [RENE]: 68, [TOM]: 68, [THOMAS]: -68, [CARSTEN]: -68 },
    };
    expect(summarizeHand(hand, 3)).toBe(
      '#3 René + Tom — 9 gode — 10 stik — Vundet — René +68, Thomas -68, Carsten -68, Tom +68',
    );
  });

  it('uses the derived display number, not the stored hand number', () => {
    const hand = {
      handNumber: 7,
      declarer: RENE,
      partnerMode: 'solo',
      partner: null,
      contractId: idOf('Sol'),
      contractLabel: 'Sol',
      tricks: 1,
      success: true,
      delta: { [RENE]: 219, [THOMAS]: -73, [CARSTEN]: -73, [TOM]: -73 },
    };
    expect(summarizeHand(hand, 2).startsWith('#2 René — Sol')).toBe(true);
  });
});
