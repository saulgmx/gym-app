import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PainNotice, PainSelector, RedFlagsChecklist, type RedFlag } from '..';

// The pain components of the Cierre and "Hoy" (contract v1.8, §4 "Componentes", decision 10;
// spec 005 AC-10 to AC-15, AC-39, AC-43). Texts are literal (spec §6.2, contract §6.1).

const NORMAL = 'Molestia leve, dentro de lo normal. Sigue con el plan.';
const ATTENTION =
  'Molestia alta. Baja la carga la próxima sesión y evita los ejercicios que la provocaron.';
const ALERT =
  'Dolor alto. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta.';
const RED_FLAG = 'Consulta a un médico antes de seguir entrenando. No se sugerirá subir carga.';
const EMERGENCY = 'Acude a urgencias. No sigas entrenando hasta que te revise un médico.';

const LABELS = [
  'Dolor que baja por la pierna',
  'Hormigueo o adormecimiento',
  'Debilidad en el pie',
  'Problemas de control de vejiga o intestino',
];

// The live region under the selector: the element with aria-live after the group.
function liveRegion(container: HTMLElement) {
  const regions = container.querySelectorAll('[aria-live="polite"]');
  expect(regions).toHaveLength(1);
  return regions[0] as HTMLElement;
}

describe('PainSelector', () => {
  const renderSelector = (value: number | null, onChange = vi.fn()) => ({
    onChange,
    ...render(<PainSelector value={value} onChange={onChange} />),
  });

  it('AC-10: h2 "Dolor lumbar" y un grupo con ese nombre, descrito por la ayuda, con 11 botones del 0 al 10', () => {
    renderSelector(null);

    expect(screen.getByRole('heading', { level: 2, name: 'Dolor lumbar' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Dolor lumbar' });
    expect(group).toHaveAccessibleDescription('0 = nada, 10 = el peor dolor');
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(
      Array.from({ length: 11 }, (_, i) => String(i)),
    );
    for (const button of buttons) expect(button).toHaveAttribute('type', 'button');
  });

  it('AC-10: sin nivel, ninguno pulsado y la región aria-live presente y vacía', () => {
    const { container } = renderSelector(null);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    expect(liveRegion(container)).toBeEmptyDOMElement();
  });

  it('AC-11: con 2, solo el "2" pulsado y el mensaje de su banda en la región', () => {
    const { container } = renderSelector(2);

    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect(liveRegion(container)).toHaveTextContent(NORMAL);
    expect(liveRegion(container)).toHaveAttribute('data-band', 'normal');
  });

  it('AC-12: con 5 y con 8, el mensaje y el data-band de su banda', () => {
    const { container, rerender } = renderSelector(5);
    expect(liveRegion(container)).toHaveTextContent(ATTENTION);
    expect(liveRegion(container)).toHaveAttribute('data-band', 'attention');

    rerender(<PainSelector value={8} onChange={vi.fn()} />);

    expect(liveRegion(container)).toHaveTextContent(ALERT);
    expect(liveRegion(container)).toHaveAttribute('data-band', 'alert');
    expect(screen.getAllByRole('button', { pressed: true }).map((b) => b.textContent)).toEqual([
      '8',
    ]);
  });

  it('AC-12: cada botón lleva el data-band de su propio nivel', () => {
    renderSelector(null);

    const bands = screen.getAllByRole('button').map((b) => b.getAttribute('data-band'));
    expect(bands).toEqual([
      ...Array<string>(4).fill('normal'),
      ...Array<string>(3).fill('attention'),
      ...Array<string>(4).fill('alert'),
    ]);
  });

  it('AC-11: tocar un botón llama a onChange con su número', async () => {
    const { onChange } = renderSelector(null);

    await userEvent.click(screen.getByRole('button', { name: '7' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('contrato v1.8: tocar el elegido llama a onChange con el mismo nivel (no se quita)', async () => {
    const { onChange } = renderSelector(4);

    await userEvent.click(screen.getByRole('button', { name: '4' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(4);
  });
});

describe('RedFlagsChecklist', () => {
  const renderChecklist = (value: RedFlag[], onChange = vi.fn()) => ({
    onChange,
    ...render(<RedFlagsChecklist value={value} onChange={onChange} />),
  });

  it('AC-13: grupo "Señales de alarma (opcional)" con su h2 y cuatro casillas sin marcar, en orden', () => {
    renderChecklist([]);

    const group = screen.getByRole('group', { name: 'Señales de alarma (opcional)' });
    expect(group.tagName).toBe('FIELDSET');
    expect(
      within(group).getByRole('heading', { level: 2, name: 'Señales de alarma (opcional)' }),
    ).toBeInTheDocument();
    const boxes = within(group).getAllByRole('checkbox');
    expect(boxes.map(labelOf)).toEqual(LABELS); // native <label>, no aria-label
    for (const box of boxes) {
      expect(box).not.toBeChecked();
      expect(box).toHaveAttribute('type', 'checkbox');
    }
  });

  it('AC-14: marcar "Hormigueo o adormecimiento" llama a onChange con numbness', async () => {
    const { onChange } = renderChecklist([]);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Hormigueo o adormecimiento' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(['numbness']);
  });

  it('contrato v1.8: las banderas vuelven en el orden de RED_FLAGS, no en el de los toques', async () => {
    const { onChange } = renderChecklist(['weakness']);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Dolor que baja por la pierna' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(['radiating', 'weakness']);
  });

  it('AC-15: desmarcar quita la bandera', async () => {
    const { onChange } = renderChecklist(['numbness', 'bladder_bowel']);

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Problemas de control de vejiga o intestino' }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith(['numbness']);
  });

  it('AC-13: las casillas marcadas son las de value', () => {
    renderChecklist(['radiating', 'bladder_bowel']);

    expect(screen.getAllByRole('checkbox').map((b) => (b as HTMLInputElement).checked)).toEqual([
      true,
      false,
      false,
      true,
    ]);
  });

  it('AC-14: con numbness, el aviso de consultar a un médico en la región aria-live', () => {
    const { container } = renderChecklist(['numbness']);

    expect(liveRegion(container)).toHaveTextContent(RED_FLAG);
  });

  it('AC-15: con numbness y bladder_bowel, el aviso de urgencias', () => {
    const { container } = renderChecklist(['numbness', 'bladder_bowel']);

    expect(liveRegion(container)).toHaveTextContent(EMERGENCY);
    expect(liveRegion(container)).not.toHaveTextContent(RED_FLAG);
  });

  it('AC-15: sin banderas, la región aria-live está presente y vacía', () => {
    const { container } = renderChecklist([]);

    expect(liveRegion(container)).toBeEmptyDOMElement();
  });
});

// The visible text of the label that names a checkbox.
function labelOf(box: HTMLElement): string | null {
  return (box as HTMLInputElement).labels?.[0]?.textContent.trim() ?? null;
}

describe('PainNotice', () => {
  const text =
    'Espalda baja 5/10 en la última sesión. Hoy baja la carga y evita los ejercicios que la provocaron.';

  it('AC-39: role="note" con el texto y data-cause', () => {
    render(<PainNotice notice={{ cause: 'attention', message: text }} />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(text);
    expect(note).toHaveAttribute('data-cause', 'attention');
    expect(note).not.toHaveAttribute('aria-live');
  });

  it('AC-43: el icono es decorativo; el nombre del aviso sale solo del texto', () => {
    const message =
      'En la última sesión marcaste problemas de control de vejiga o intestino. Acude a urgencias antes de volver a entrenar.';
    const { container } = render(<PainNotice notice={{ cause: 'bladder_bowel', message }} />);

    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('note')).toHaveTextContent(message, { normalizeWhitespace: true });
    expect(screen.getByRole('note').textContent.trim()).toBe(message);
  });
});
