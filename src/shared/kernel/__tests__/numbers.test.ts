import { describe, expect, it } from 'vitest';
import { floorToStep, kgToLb, lbToKg, roundToStep } from '@/shared/kernel';

describe('roundToStep', () => {
  it.each([
    [61.3, 2.5, 62.5],
    [61.2, 2.5, 60],
    [61.25, 2.5, 62.5],
    [60, 2.5, 60],
    [23, 2, 24],
    [22.9, 2, 22],
    [47, 5, 45],
    [47.5, 5, 50],
    [0.1 + 0.2, 0.1, 0.3],
    [1.15, 0.05, 1.15],
  ])('AC-17: %d con paso %d → %d', (value, step, expected) => {
    expect(roundToStep(value, step)).toBe(expected);
  });
});

describe('floorToStep', () => {
  it.each([
    [61.3, 2.5, 60],
    [62.5, 2.5, 62.5],
    [62.49, 2.5, 60],
    [23.9, 2, 22],
    [49.9, 5, 45],
    [0.1 + 0.2, 0.1, 0.3],
    [0.7, 0.1, 0.7],
  ])('AC-17: %d con paso %d → %d', (value, step, expected) => {
    expect(floorToStep(value, step)).toBe(expected);
  });
});

describe('kgToLb y lbToKg', () => {
  it.each([
    [100, 220.46],
    [61.3, 135.14],
    [2.5, 5.51],
    [0, 0],
  ])('AC-17: %d kg = %d lb', (kg, lb) => {
    expect(kgToLb(kg)).toBe(lb);
  });

  it.each([
    [45, 20.41],
    [135, 61.23],
    [1, 0.45],
    [0, 0],
  ])('AC-17: %d lb = %d kg', (lb, kg) => {
    expect(lbToKg(lb)).toBe(kg);
  });

  it('AC-17: ida y vuelta conserva el peso a 2 decimales', () => {
    for (const kg of [2.5, 20, 61.3, 102.5]) {
      expect(lbToKg(kgToLb(kg))).toBe(kg);
    }
  });
});
