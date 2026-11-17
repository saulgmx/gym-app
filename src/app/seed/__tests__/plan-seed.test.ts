import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPlan, planStores, type PlanApi, type TodayPlan } from '@/modules/plan';
import { fixedClock, type LocalDate } from '@/shared/kernel';
import planSeed from '../plan-seed.json';
import expectedSummary from './plan-seed.summary.md?raw';

// The real seed (spec 001 AC-4, AC-8 to AC-14). Loaded on Wednesday 2026-11-18, so the program
// starts on Monday 2026-11-16; dates and rounding checked with Node.

const date = (s: string) => s as LocalDate;

// Structural view of the JSON for the summary; `plan` validates it with its own schema.
type Range = [number, number];
interface SeedView {
  exercises: {
    id: string;
    name: string;
    muscleGroup: string;
    equipment: string;
    metric: string;
    lumbarRisk: string;
    isPrimary: boolean;
    beltRecommended?: boolean;
    restSeconds: Range;
  }[];
  program: { name: string; totalWeeks: number; blockIds: string[] };
  blocks: {
    id: string;
    name: string;
    startWeek: number;
    endWeek: number;
    targetRir: Range;
    weekRir?: Record<string, Range>;
    weekFactors: Record<string, number>;
    isDeload: boolean;
    schedule: (
      | { weekday: number; kind: 'workout'; templateId: string; weekParity?: 'odd' | 'even' }
      | { weekday: number; kind: 'cardio'; note: string }
      | { weekday: number; kind: 'rest' }
    )[];
  }[];
  templates: {
    id: string;
    blockId: string;
    name: string;
    items: {
      exerciseId: string;
      alternatives?: string[];
      order: number;
      sets: Range;
      reps: Range;
      note?: string;
    }[];
  }[];
}

const seed = planSeed as unknown as SeedView;

// Readable summary, in the same format as plan-seed.summary.md (plan §6.5).
function summarize(s: SeedView): string {
  const range = ([min, max]: Range) =>
    min === max ? String(min) : `${String(min)}-${String(max)}`;
  const yesNo = (b: boolean | undefined) => (b ? 'sí' : 'no');
  const byId = <T extends { id: string }>(rows: T[], id: string): T => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error(`Missing ${id}`);
    return row;
  };
  const exerciseName = (id: string) => byId(s.exercises, id).name;
  const templateName = (id: string) => byId(s.templates, id).name;
  const perWeek = <V>(record: Record<string, V> | undefined, show: (v: V) => string) => {
    const entries = Object.entries(record ?? {}).sort(([a], [b]) => Number(a) - Number(b));
    return entries.length ? entries.map(([k, v]) => `${k} → ${show(v)}`).join(', ') : '—';
  };
  const days: [number, string][] = [
    [1, 'Lunes'],
    [2, 'Martes'],
    [3, 'Miércoles'],
    [4, 'Jueves'],
    [5, 'Viernes'],
    [6, 'Sábado'],
    [0, 'Domingo'],
  ];

  const lines = [
    '# Resumen del seed del plan',
    '',
    'Escrito a mano a partir de docs/plan.md; plan-seed.test.ts genera este mismo texto desde plan-seed.json y exige que sean idénticos (spec 001, plan §4.1 y §6.5).',
    '',
    '## Programa',
    '',
    `${s.program.name} · ${String(s.program.totalWeeks)} semanas · ${String(s.blocks.length)} bloques`,
    '',
    '## Catálogo',
    '',
    '| Ejercicio | Músculo | Equipo | Métrica | Riesgo lumbar | Principal | Faja | Descanso |',
    '|---|---|---|---|---|---|---|---|',
    ...s.exercises.map(
      (e) =>
        `| ${e.name} | ${e.muscleGroup} | ${e.equipment} | ${e.metric} | ${e.lumbarRisk} | ${yesNo(e.isPrimary)} | ${yesNo(e.beltRecommended)} | ${range(e.restSeconds)} s |`,
    ),
    '',
    '## Bloques',
  ];

  for (const b of s.blocks) {
    lines.push(
      '',
      `### ${b.name}`,
      '',
      `- Semanas: ${range([b.startWeek, b.endWeek])}`,
      `- RIR: ${range(b.targetRir)}`,
      `- RIR por semana: ${perWeek(b.weekRir, range)}`,
      `- Factores por semana: ${perWeek(b.weekFactors, String)}`,
      `- Descarga: ${yesNo(b.isDeload)}`,
      '',
      '| Día | Sesión |',
      '|---|---|',
    );
    for (const [weekday, dayName] of days) {
      const session = b.schedule
        .filter((e) => e.weekday === weekday)
        .sort(
          (x, y) =>
            (x.kind === 'workout' && x.weekParity === 'even' ? 1 : 0) -
            (y.kind === 'workout' && y.weekParity === 'even' ? 1 : 0),
        )
        .map((e) => {
          if (e.kind === 'cardio') return `Cardio: ${e.note}`;
          if (e.kind === 'rest') return 'Descanso';
          const parity = { odd: ' (impar)', even: ' (par)' };
          return templateName(e.templateId) + (e.weekParity ? parity[e.weekParity] : '');
        })
        .join(' / ');
      lines.push(`| ${dayName} | ${session} |`);
    }
  }

  lines.push('', '## Plantillas');
  for (const t of s.templates) {
    lines.push('', `### ${t.name} · ${byId(s.blocks, t.blockId).name}`, '');
    for (const item of [...t.items].sort((a, b) => a.order - b.order)) {
      const exercise = byId(s.exercises, item.exerciseId);
      const alternatives = item.alternatives?.length
        ? ` (o ${item.alternatives.map(exerciseName).join(' o ')})`
        : '';
      const seconds = exercise.metric === 'time' ? ' s' : '';
      const note = item.note ? ` · ${item.note}` : '';
      lines.push(
        `${String(item.order)}. ${exercise.name}${alternatives} — ${range(item.sets)} × ${range(item.reps)}${seconds}${note}`,
      );
    }
  }
  return lines.join('\n') + '\n';
}

let db: Dexie;
let plan: PlanApi;
let seeded: Awaited<ReturnType<PlanApi['ensureSeeded']>>;

beforeAll(async () => {
  db = new Dexie(crypto.randomUUID());
  db.version(1).stores(planStores);
  plan = createPlan({ db, clock: fixedClock('2026-11-18T08:00:00-06:00') });
  seeded = await plan.ensureSeeded(planSeed);
});

afterAll(async () => {
  db.close();
  await Dexie.delete(db.name);
});

const label = (day: TodayPlan) => {
  if (day.kind === 'workout') return day.template.name;
  if (day.kind === 'cardio') return day.note;
  return day.kind === 'rest' ? 'Descanso' : 'Fuera del programa';
};

async function workout(day: string) {
  const today = await plan.getTodayPlan(date(day));
  if (today.kind !== 'workout') throw new Error(`${day} is not a workout day`);
  return today;
}

const setsOf = (today: Awaited<ReturnType<typeof workout>>, name: string) =>
  today.plannedItems.find((i) => i.exercise.name === name)?.plannedSets;

describe('seed real del plan', () => {
  describe('AC-4: validación', () => {
    it('ensureSeeded acepta el seed real', () => {
      expect(seeded).toEqual({ ok: true, value: undefined });
    });

    it('15 semanas sin huecos ni solapes en 4 bloques, 11 plantillas y 36 ejercicios', () => {
      expect(seed.program.totalWeeks).toBe(15);
      expect(seed.blocks).toHaveLength(4);
      expect(seed.templates).toHaveLength(11);
      expect(seed.exercises).toHaveLength(36);
      const weeks = seed.blocks.flatMap((b) =>
        Array.from({ length: b.endWeek - b.startWeek + 1 }, (_, i) => b.startWeek + i),
      );
      expect(weeks).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    });

    it('ningún ejercicio high en el catálogo (P-1, RN-PLN-07)', () => {
      expect(seed.exercises.filter((e) => e.lumbarRisk === 'high')).toEqual([]);
    });

    it('el resumen legible coincide con el escrito a mano desde docs/plan.md', () => {
      expect(summarize(seed)).toBe(expectedSummary);
    });
  });

  it('AC-8: posición antes, al inicio, al final y después del programa', async () => {
    const positions = await Promise.all(
      ['2026-11-15', '2026-11-16', '2027-02-28', '2027-03-01'].map((d) =>
        plan.getPosition(date(d)),
      ),
    );
    expect(positions.map((p) => [p.status, p.week])).toEqual([
      ['not_started', null],
      ['active', 1],
      ['active', 15],
      ['finished', null],
    ]);
  });

  it('AC-9: semana 1 (impar) del bloque 1, de lunes a domingo', async () => {
    const week = await plan.getWeekPlan(date('2026-11-16'));
    expect(week.map(label)).toEqual([
      'Full body A',
      'Cardio suave 30-40 min (bici, elíptica o caminata inclinada)',
      'Full body B',
      'Descanso',
      'Full body A',
      'Cardio moderado 20-30 min (sin impacto)',
      'Descanso',
    ]);
  });

  it('AC-10: semana 2 (par): lunes, miércoles y viernes → B, A, B', async () => {
    const days = await Promise.all(
      ['2026-11-23', '2026-11-25', '2026-11-27'].map((d) => workout(d)),
    );
    expect(days.map(label)).toEqual(['Full body B', 'Full body A', 'Full body B']);
  });

  it('AC-11: series planificadas de Full body A en las semanas 1 y 2', async () => {
    const week1 = await workout('2026-11-16'); // Monday, week 1: factor 0.7
    expect(setsOf(week1, 'Prensa de piernas')).toBe(2);
    expect(setsOf(week1, 'Curl femoral')).toBe(1);

    const week2 = await workout('2026-11-25'); // Wednesday, week 2: Full body A, factor 1
    expect(week2.template.name).toBe('Full body A');
    expect(setsOf(week2, 'Prensa de piernas')).toBe(3);
    expect(setsOf(week2, 'Curl femoral')).toBe(2);
  });

  it('AC-12: RIR objetivo de las semanas 1, 2, 9, 10 y 15', async () => {
    const mondays = ['2026-11-16', '2026-11-23', '2027-01-11', '2027-01-18', '2027-02-22'];
    const rir = await Promise.all(
      mondays.map(async (d) => (await workout(d)).plannedItems[0]?.targetRir),
    );
    expect(rir).toEqual([
      [3, 4],
      [2, 3],
      [3, 3],
      [1, 3],
      [4, 4],
    ]);
  });

  it('AC-13: lunes de la semana 15 → Push del bloque 3 al 50% y RIR 4', async () => {
    const today = await workout('2027-02-22');
    expect(today.template.name).toBe('Push');
    expect(today.position).toMatchObject({ week: 15, isDeloadWeek: true, volumeFactor: 0.5 });
    expect(today.position.block?.name).toBe('Descarga');
    expect(today.template.blockId).not.toBe(today.position.block?.id); // RN-PLN-12
    expect(setsOf(today, 'Press de banca con barra')).toBe(2);
    expect(today.plannedItems.every((i) => i.targetRir[0] === 4 && i.targetRir[1] === 4)).toBe(
      true,
    );
  });

  it('AC-14: el plan de la semana de un jueves tiene 7 días, de lunes a domingo', async () => {
    const week = await plan.getWeekPlan(date('2027-01-14'));
    expect(week.map(label)).toEqual([
      'Push',
      'Pull',
      'Legs',
      'Cardio muy suave 30-40 min',
      'Upper',
      'Lower',
      'Cardio moderado o descanso',
    ]);
    expect(new Set(week.map((d) => d.position.week))).toEqual(new Set([9]));
  });
});
