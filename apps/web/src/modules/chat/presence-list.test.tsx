import type { PresenceUser } from "@relay/shared";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PresenceList } from "./presence-list";

const ANA: PresenceUser = { id: "user-ana", displayName: "Ana Ruiz" };
const MARTA: PresenceUser = { id: "user-marta", displayName: "Marta Ibáñez" };

describe("PresenceList", () => {
  it("concuerda el recuento en singular y en plural", () => {
    const { rerender } = render(<PresenceList members={[ANA]} currentUserId={ANA.id} />);

    expect(screen.getByText("1 persona en la sala")).toBeInTheDocument();

    rerender(<PresenceList members={[ANA, MARTA]} currentUserId={ANA.id} />);

    expect(screen.getByText("2 personas en la sala")).toBeInTheDocument();
  });

  it("marca cuál eres tú", () => {
    render(<PresenceList members={[ANA, MARTA]} currentUserId={ANA.id} />);

    const mine = screen.getByText("Ana Ruiz").closest("li");

    expect(within(mine as HTMLElement).getByText("(tú)")).toBeInTheDocument();
  });

  it("dice quién está escribiendo en su propia fila", () => {
    render(<PresenceList members={[ANA, MARTA]} currentUserId={ANA.id} typingIds={[MARTA.id]} />);

    const marta = screen.getByText("Marta Ibáñez").closest("li");

    expect(within(marta as HTMLElement).getByText("escribiendo…")).toBeInTheDocument();
  });

  it("anuncia quién entra y quién sale", () => {
    // Sin aria-live, quien no ve la pantalla nunca sabe con quién habla.
    render(<PresenceList members={[ANA]} currentUserId={ANA.id} />);

    expect(screen.getByRole("list")).toHaveAttribute("aria-live", "polite");
  });
});
