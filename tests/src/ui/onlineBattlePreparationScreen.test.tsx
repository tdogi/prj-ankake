import "@testing-library/jest-dom/vitest";
import { ok, type OnlineDisplayNameRepository } from "@ankake/persistence";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMemo, useState } from "react";
import { OnlineBattlePreparationScreen } from "../../../apps/web/src/online/OnlineBattlePreparationScreen";
import { InMemoryDeckRepository } from "../fakes/inMemoryDeckRepository";
import { validCatalogSnapshotFixture } from "../generators/catalogGenerators";

const humanMatchMocks = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("../../../apps/web/src/online/humanBattleClient", () => ({
  startOnlineHumanBattle: humanMatchMocks.start,
  cancelPendingHumanMatch: vi.fn()
}));

const readyCards = [...validCatalogSnapshotFixture.cardsById.keys()].slice(0, 10).map((cardId) => ({ cardId, count: 4 }));
const repository = new InMemoryDeckRepository({
  catalog: validCatalogSnapshotFixture,
  initialDecks: [
    { deckId: "ready-older", name: "Older Ready", cards: readyCards, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    { deckId: "draft", name: "Incomplete Deck", cards: [{ cardId: readyCards[0]!.cardId, count: 1 }], createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
    { deckId: "ready-newer", name: "Latest Ready", cards: readyCards, createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-03-01T00:00:00.000Z" }
  ]
});

function LocalizedOnlineScreen() {
  const [locale, setLocale] = useState<"ja" | "en">("en");
  const displayNameRepository = useMemo(() => new MemoryDisplayNameRepository(), []);
  return <OnlineBattlePreparationScreen repository={repository} displayNameRepository={displayNameRepository} catalog={validCatalogSnapshotFixture} locale={locale} onLocaleChange={setLocale} onReturn={vi.fn()} onMatched={vi.fn()} />;
}

class MemoryDisplayNameRepository implements OnlineDisplayNameRepository {
  value: string;

  constructor(value = "") {
    this.value = value;
  }

  async loadDisplayName() {
    return ok(this.value);
  }

  async saveDisplayName(value: string) {
    this.value = value;
    return ok(undefined);
  }
}

describe("online battle preparation screen", () => {
  it("selects the newest battle-ready saved deck and blocks matching until a name is provided", async () => {
    render(<LocalizedOnlineScreen />);

    await waitFor(() => expect(screen.getByTestId("online-battle-deck-selector")).toHaveValue("ready-newer"));
    expect(screen.getByTestId("online-match-start-button")).toBeDisabled();
    expect(screen.getByTestId("online-match-status")).toHaveTextContent("Enter a display name.");

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Player One" } });
    expect(screen.getByTestId("online-match-start-button")).toBeEnabled();
  });

  it("uses the CPU battle's deck selector and retains the chosen deck while changing language", async () => {
    render(<LocalizedOnlineScreen />);

    const selector = await screen.findByTestId("online-battle-deck-selector");
    expect(selector.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: /Incomplete Deck/ })).toBeDisabled();
    fireEvent.change(selector, { target: { value: "ready-older" } });
    expect(selector).toHaveValue("ready-older");

    fireEvent.click(screen.getByRole("button", { name: "日本語" }));
    expect(screen.getByText("表示名")).toBeInTheDocument();
    expect(screen.getByTestId("online-battle-deck-selector")).toHaveValue("ready-older");
  });

  it("restores and overwrites only the latest local display name", async () => {
    const displayNameRepository = new MemoryDisplayNameRepository("Remembered Player");
    render(<OnlineBattlePreparationScreen repository={repository} displayNameRepository={displayNameRepository} catalog={validCatalogSnapshotFixture} locale="en" onLocaleChange={vi.fn()} onReturn={vi.fn()} onMatched={vi.fn()} />);

    const input = screen.getByLabelText("Display name");
    await waitFor(() => expect(input).toHaveValue("Remembered Player"));
    fireEvent.change(input, { target: { value: "Latest Player" } });
    await waitFor(() => expect(displayNameRepository.value).toBe("Latest Player"));
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => expect(displayNameRepository.value).toBe(""));
  });

  it("starts a human match through the online battle API", async () => {
    const onMatched = vi.fn();
    humanMatchMocks.start.mockResolvedValue({ battleId: "battle-id", revision: 0, side: "player", opponentName: "Player Two", state: {}, events: [], client: {} });
    try {
      render(<OnlineBattlePreparationScreen repository={repository} displayNameRepository={new MemoryDisplayNameRepository()} catalog={validCatalogSnapshotFixture} locale="en" onLocaleChange={vi.fn()} onReturn={vi.fn()} onMatched={onMatched} />);
      await screen.findByTestId("online-battle-deck-selector");
      fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Player One" } });
      fireEvent.click(screen.getByTestId("online-match-start-button"));

      await waitFor(() => expect(onMatched).toHaveBeenCalledTimes(1));
      expect(humanMatchMocks.start).toHaveBeenCalledWith(expect.objectContaining({ playerName: "Player One" }));
    } finally {
      humanMatchMocks.start.mockReset();
    }
  });
});
