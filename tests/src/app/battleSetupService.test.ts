import { loadBattlePreparation } from "../../../apps/web/src/battle/battleSetupService";
import { InMemoryDeckRepository } from "../fakes/inMemoryDeckRepository";
import { validCatalogSnapshotFixture } from "../generators/catalogGenerators";

const readyCards = [...validCatalogSnapshotFixture.cardsById.keys()].slice(0, 10).map((cardId) => ({ cardId, count: 4 }));

describe("battle setup service", () => {
  it("uses a valid deck selected during online matching when preparing the battle", async () => {
    const repository = new InMemoryDeckRepository({
      catalog: validCatalogSnapshotFixture,
      initialDecks: [
        { deckId: "latest", name: "Latest", cards: readyCards, createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-03-02T00:00:00.000Z" },
        { deckId: "online-choice", name: "Online choice", cards: readyCards, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" }
      ]
    });

    await expect(loadBattlePreparation(repository, "online-choice")).resolves.toMatchObject({
      playerDeckId: "online-choice"
    });
  });
});
