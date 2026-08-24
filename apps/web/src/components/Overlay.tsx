"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  /** Nombre accesible del diálogo. */
  label: string;
  /** De dónde entra: cajón lateral u hoja inferior. */
  placement?: "left" | "bottom";
  children: ReactNode;
}

/**
 * Un panel modal.
 *
 * Es un `<dialog>` de verdad abierto con `showModal()`, no un `div` con
 * `position:fixed`. El navegador aporta cuatro cosas que a mano salen mal:
 *
 * - **Trampa de foco real.** Declarar `aria-modal="true"` sobre un `div` es una
 *   promesa que nadie cumple: con Tab se recorre lo que está tapado por el
 *   velo, sin ninguna pista de haber salido del panel.
 * - **Escape**, que dispara el evento `close`.
 * - **Devolver el foco** a quien abrió el panel, sin guardarlo en una ref.
 * - **`::backdrop`**, que evita tener que poner un elemento a pantalla completa
 *   haciendo de velo — y que sería una parada de tabulación colocada *antes*
 *   del contenido.
 *
 * 📖 https://developer.mozilla.org/docs/Web/API/HTMLDialogElement/showModal
 */
export function Overlay({ open, onClose, label, placement = "left", children }: OverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  /**
   * El efecto depende sólo de `open`.
   *
   * Si dependiera también de `onClose`, cualquier flecha en línea lo haría
   * correr en cada render del componente padre — y una pantalla de chat
   * renderiza con cada mensaje. Quien use este componente debe pasar un
   * callback estable; aquí no se depende de él para nada.
   */
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  /**
   * Al pulsar el velo, el objetivo del evento es el propio `<dialog>`: el
   * contenido vive en su hijo. Es la forma de distinguir «fuera» de «dentro»
   * sin añadir un elemento que capture el clic.
   */
  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    // jsx-a11y pide un manejador de teclado junto a `onClick`, pero aquí lo
    // pone el navegador: en un diálogo modal Escape dispara `close`, que es
    // justamente el equivalente por teclado de pulsar el velo.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-label={label}
      // `close` cubre las dos salidas del navegador — Escape y `dialog.close()`
      // — así que el estado de React se entera pase lo que pase.
      onClose={onClose}
      onClick={onBackdropClick}
      // El diálogo es sólo el marco: transparente y del tamaño de la ventana.
      // El velo lo pinta `::backdrop`. Las clases `max-*-none` y `m-0` deshacen
      // los estilos por defecto del navegador, que lo centra y lo limita a
      // `calc(100% - 6px - 2em)`.
      className="backdrop:bg-ink/14 m-0 h-dvh max-h-none w-dvw max-w-none border-0 bg-transparent p-0"
    >
      <div className={`flex h-full ${placement === "bottom" ? "items-end" : ""}`}>
        {children}
      </div>
    </dialog>
  );
}
