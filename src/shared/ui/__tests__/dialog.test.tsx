import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from '..';

// modules/shared.md §4, Dialog (spec 004 plan §6.1, T1). jsdom uses the stand-in of tests/setup:
// showModal and close only toggle `open`; inertness and the real backdrop run in the E2E tests.

interface PageProps {
  onClose?: () => void;
  dismissOnBackdrop?: boolean;
  placement?: 'bottom' | 'top';
  withInitialFocus?: boolean;
  children?: ReactNode;
}

// A page that opens the dialog from a button and closes it whenever the dialog asks.
function Page({
  onClose = vi.fn(),
  dismissOnBackdrop,
  placement = 'bottom',
  withInitialFocus = false,
  children,
}: PageProps) {
  const [open, setOpen] = useState(false);
  const second = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Abrir
      </button>
      <Dialog
        open={open}
        placement={placement}
        labelledBy="dialog-title"
        describedBy="dialog-text"
        className="custom"
        {...(dismissOnBackdrop === undefined ? {} : { dismissOnBackdrop })}
        {...(withInitialFocus ? { initialFocus: second } : {})}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      >
        <h2 id="dialog-title">¿Salir de la sesión?</h2>
        <p id="dialog-text">Llevas 1 de 7 ejercicios.</p>
        {children ?? (
          <>
            <button type="button" disabled>
              Deshabilitado
            </button>
            <button type="button">Primero</button>
            <button ref={second} type="button">
              Segundo
            </button>
          </>
        )}
      </Dialog>
    </>
  );
}

const opener = () => screen.getByRole('button', { name: 'Abrir' });
const dialog = () => screen.getByRole('dialog', { name: '¿Salir de la sesión?' });

async function openPage(props: PageProps = {}) {
  render(<Page {...props} />);
  await userEvent.click(opener());
}

describe('Dialog', () => {
  it('cerrado no está en el árbol accesible', () => {
    render(<Page />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abierto: nombre y descripción por id, la clase y data-placement', async () => {
    await openPage({ placement: 'top' });

    expect(dialog()).toHaveAccessibleDescription('Llevas 1 de 7 ejercicios.');
    expect(dialog()).toHaveAttribute('data-placement', 'top');
    expect(dialog()).toHaveClass('custom');
    expect(dialog()).toHaveAttribute('open');
  });

  it('data-placement="bottom" cuando se pide abajo', async () => {
    await openPage({ placement: 'bottom' });
    expect(dialog()).toHaveAttribute('data-placement', 'bottom');
  });

  it('el foco va a initialFocus si llega', async () => {
    await openPage({ withInitialFocus: true });
    expect(screen.getByRole('button', { name: 'Segundo' })).toHaveFocus();
  });

  it('sin initialFocus, el foco va al primer control habilitado', async () => {
    await openPage();
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus();
  });

  it('el primer control puede ser un enlace, un input o un [tabindex]', async () => {
    await openPage({
      children: (
        <>
          <a>Sin href</a>
          <input aria-label="Campo" />
        </>
      ),
    });
    expect(screen.getByRole('textbox', { name: 'Campo' })).toHaveFocus();
  });

  it('sin controles, el foco va al propio dialog', async () => {
    await openPage({ children: <p>Solo texto</p> });
    expect(dialog()).toHaveFocus();
    expect(dialog()).toHaveAttribute('tabindex', '-1');
  });

  it('al cerrarse, el foco vuelve al botón que lo abrió', async () => {
    await openPage({ dismissOnBackdrop: true });

    fireEvent(dialog(), new Event('cancel', { cancelable: true }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener()).toHaveFocus();
  });

  it('al desmontarse abierto, se cierra y el foco vuelve al que lo abrió', async () => {
    // Mounted already open (like the menu of a screen that goes away), then unmounted.
    function Host() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setShown(true);
            }}
          >
            Abrir
          </button>
          {shown && (
            <Dialog open placement="bottom" labelledBy="t" onClose={vi.fn()}>
              <h2 id="t">Menú</h2>
              <button
                type="button"
                onClick={() => {
                  setShown(false);
                }}
              >
                Cerrar desde dentro
              </button>
            </Dialog>
          )}
        </>
      );
    }
    render(<Host />);
    await userEvent.click(opener());
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close');

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar desde dentro' }));

    expect(close).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener()).toHaveFocus();
    close.mockRestore();
  });

  it('el foco no vuelve a un elemento que ya no está en el documento', async () => {
    // Like the menu: choosing an exercise mounts a new screen, whose title takes the focus.
    function Screen({ index, onPick }: { index: number; onPick: () => void }) {
      const [open, setOpen] = useState(false);
      const title = useRef<HTMLHeadingElement>(null);
      return (
        <>
          <h1 ref={title} tabIndex={-1} data-testid={`title-${String(index)}`}>
            Ejercicio {index}
          </h1>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            Menú {index}
          </button>
          <Dialog open={open} placement="top" labelledBy="m" onClose={vi.fn()}>
            <h2 id="m">Full body A</h2>
            <button type="button" onClick={onPick}>
              Ir al 2
            </button>
          </Dialog>
        </>
      );
    }
    function Host() {
      const [index, setIndex] = useState(1);
      return (
        <Screen
          key={index}
          index={index}
          onPick={() => {
            setIndex(2);
          }}
        />
      );
    }
    render(<Host />);
    const oldOpener = screen.getByRole('button', { name: 'Menú 1' });
    await userEvent.click(oldOpener);
    const focus = vi.spyOn(oldOpener, 'focus');

    await userEvent.click(screen.getByRole('button', { name: 'Ir al 2' }));

    expect(oldOpener.isConnected).toBe(false);
    expect(focus).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Ejercicio 2' })).toBeInTheDocument();
  });

  it('Escape (evento cancel) llama a onClose y evita el cierre nativo', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open placement="bottom" labelledBy="t" onClose={onClose}>
        <h2 id="t">Menú</h2>
      </Dialog>,
    );
    const event = new Event('cancel', { cancelable: true });

    fireEvent(screen.getByRole('dialog', { name: 'Menú' }), event);

    expect(onClose).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    // Not closed by itself: the owner decides.
    expect(screen.getByRole('dialog', { name: 'Menú' })).toHaveAttribute('open');
  });

  it('con dismissOnBackdrop, tocar el fondo llama a onClose', async () => {
    const onClose = vi.fn();
    await openPage({ onClose, dismissOnBackdrop: true });

    await userEvent.click(dialog());

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sin dismissOnBackdrop, tocar el fondo no hace nada', async () => {
    const onClose = vi.fn();
    await openPage({ onClose });

    await userEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
    expect(dialog()).toBeInTheDocument();
  });

  it('un toque dentro del panel nunca cierra', async () => {
    const onClose = vi.fn();
    await openPage({ onClose, dismissOnBackdrop: true });

    await userEvent.click(screen.getByText('Llevas 1 de 7 ejercicios.'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('un arrastre que empieza dentro y se suelta en el fondo no cierra', async () => {
    const onClose = vi.fn();
    await openPage({ onClose, dismissOnBackdrop: true });

    // The browser sends the click to the common ancestor: the dialog itself.
    fireEvent.pointerDown(screen.getByText('Llevas 1 de 7 ejercicios.'));
    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
  });
});
