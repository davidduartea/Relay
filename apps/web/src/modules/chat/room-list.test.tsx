import type { Room } from "@relay/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoomList } from "./room-list";

const ROOMS: Room[] = [
  { id: "r1", name: "General", slug: "general" },
  { id: "r2", name: "Frontend", slug: "frontend" },
];

describe("RoomList", () => {
  it("marca la sala activa para el lector de pantalla", () => {
    render(<RoomList rooms={ROOMS} activeId="r1" onChoose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "General" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Frontend" })).not.toHaveAttribute("aria-current");
  });

  it("no mete «aquí» en el nombre accesible", () => {
    // La palabra es una señal visual más para la sala activa. Si entrara en el
    // nombre, la sala pasaría a llamarse «General aquí» al escucharla.
    render(<RoomList rooms={ROOMS} activeId="r1" onChoose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "General" })).toBeInTheDocument();
  });

  it("avisa con el id de la sala elegida", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();

    render(<RoomList rooms={ROOMS} activeId="r1" onChoose={onChoose} />);
    await user.click(screen.getByRole("button", { name: "Frontend" }));

    expect(onChoose).toHaveBeenCalledWith("r2");
  });
});
