/**
 * Los textos de acceso y alta.
 *
 * Fuera del componente porque son lo que más se retoca y lo que menos tiene que
 * ver con la lógica del formulario: cambiar «Regístrate» por otra cosa no
 * debería obligar a abrir un archivo con estado, efectos y llamadas al API.
 */
export type AuthMode = "login" | "register";

interface AuthCopy {
  title: string;
  submit: string;
  question: string;
  action: string;
  href: string;
}

export const AUTH_COPY = {
  login: {
    title: "Entrar",
    submit: "Entrar",
    question: "¿No tienes cuenta?",
    action: "Regístrate",
    href: "/register",
  },
  register: {
    title: "Crear cuenta",
    submit: "Crear cuenta",
    question: "¿Ya tienes cuenta?",
    action: "Entra",
    href: "/login",
  },
  // `satisfies` y no una anotación: comprueba que están los dos modos y que
  // cada uno tiene todos los campos, pero deja que los valores sigan siendo
  // literales para quien los lea desde fuera.
} satisfies Record<AuthMode, AuthCopy>;
