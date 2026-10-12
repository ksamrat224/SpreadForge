import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClusterProvider } from "./cluster-context";
import { ClusterSelect } from "./cluster-select";

describe("ClusterSelect", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("offers only devnet and testnet", () => {
    render(
      <ClusterProvider>
        <ClusterSelect />
      </ClusterProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Solana cluster" }));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent)
    ).toEqual(["Devnet", "Testnet"]);
  });
});
