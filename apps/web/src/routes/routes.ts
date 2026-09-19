import type { DestinationCapabilityMap, RouteId } from "@ankake/domain";

export const ROUTE_IDS = {
  menu: "menu",
  deckBuilding: "deck-building",
  battlePreparation: "battle-preparation",
  onlineBattlePreparation: "online-battle-preparation",
  battle: "battle"
} as const satisfies Record<string, RouteId>;

export function createUow001DestinationCapabilities(): DestinationCapabilityMap {
  return {
    "online-battle": { actionId: "online-battle", routeId: ROUTE_IDS.onlineBattlePreparation, label: "Online Battle", enabled: true },
    "cpu-battle": {
      actionId: "cpu-battle",
      routeId: ROUTE_IDS.battlePreparation,
      label: "CPU Battle",
      enabled: true
    },
    "deck-building": {
      actionId: "deck-building",
      routeId: ROUTE_IDS.deckBuilding,
      label: "Deck Building",
      enabled: true
    }
  };
}
