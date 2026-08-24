/**
 * El botón de salir.
 *
 * Sólo avisa: quién navega después lo decide la pantalla. Antes llamaba a
 * `useRouter` por su cuenta y redirigía, lo que escondía su efecto más
 * importante detrás de un nombre que sólo dice «botón».
 */
export function SignOutButton({
  onClick,
  block = false,
}: {
  onClick: () => void;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-border flex h-11 items-center border px-3.5 text-[13px] font-medium ${
        block ? "justify-center" : ""
      }`}
    >
      Salir
    </button>
  );
}
