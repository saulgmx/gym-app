import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '..';

// modules/shared.md §4, ConfirmDialog (spec 002 T17). jsdom uses the stand-in of tests/setup.

const props = {
  title: '¿Descartar la sesión?',
  message: 'Las series registradas no contarán en tu historial.',
  confirmLabel: 'Descartar',
};

// A page that opens the dialog from a button and closes it on either answer.
function Page({ onConfirm = vi.fn(), onCancel = vi.fn() }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Descartar sesión
      </button>
      <ConfirmDialog
        {...props}
        destructive
        open={open}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
        onCancel={() => {
          setOpen(false);
          onCancel();
        }}
      />
    </>
  );
}

const opener = () => screen.getByRole('button', { name: 'Descartar sesión' });

describe('ConfirmDialog', () => {
  it('cerrado no está en el árbol accesible', () => {
    render(<Page />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abierto: nombre, descripción y los dos botones; el foco en Cancelar', async () => {
    render(<Page />);
    await userEvent.click(opener());

    const dialog = screen.getByRole('dialog', { name: '¿Descartar la sesión?' });
    expect(dialog).toHaveAccessibleDescription(
      'Las series registradas no contarán en tu historial.',
    );
    expect(screen.getByRole('button', { name: 'Descartar' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('Confirmar llama a onConfirm y no a onCancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<Page onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(opener());

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Cancelar llama a onCancel', async () => {
    const onCancel = vi.fn();
    render(<Page onCancel={onCancel} />);
    await userEvent.click(opener());

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Escape (evento cancel) llama a onCancel y evita el cierre nativo', async () => {
    const onCancel = vi.fn();
    render(<Page onCancel={onCancel} />);
    await userEvent.click(opener());

    const event = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog'), event);

    expect(onCancel).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('tocar fuera (el propio dialog, como el backdrop) no lo cierra', async () => {
    const onCancel = vi.fn();
    render(<Page onCancel={onCancel} />);
    await userEvent.click(opener());

    await userEvent.click(screen.getByRole('dialog'));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('al cerrarse, el foco vuelve al botón que lo abrió', async () => {
    render(<Page />);
    await userEvent.click(opener());

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(opener()).toHaveFocus();
  });

  it('cancelLabel cambia el texto de Cancelar', async () => {
    render(
      <ConfirmDialog {...props} open cancelLabel="Seguir" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(await screen.findByRole('button', { name: 'Seguir' })).toHaveFocus();
  });
});
