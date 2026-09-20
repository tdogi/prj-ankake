import type {
  StaticCatalogSnapshot,
  StaticCatalogValidationIssue
} from "../catalog/types";

export type RouteId = "menu" | "deck-building" | "battle-preparation" | "online-battle-preparation" | "battle";
export type MenuActionId = "online-battle" | "cpu-battle" | "deck-building";

export interface DestinationCapability {
  readonly actionId: MenuActionId;
  readonly routeId: RouteId;
  readonly label: string;
  readonly enabled: boolean;
  readonly disabledReason?: string;
}

export type DestinationCapabilityMap = Readonly<Partial<Record<MenuActionId, DestinationCapability>>>;

export interface DeckSummary {
  readonly id: string;
  readonly name: string;
  readonly cardCount: number;
  readonly updatedAt?: string;
}

export interface FatalErrorState {
  readonly title: string;
  readonly message: string;
  readonly issues: readonly string[];
  readonly canReload: true;
}

export type AppSnapshot =
  | {
      readonly kind: "initializing";
      readonly currentRoute: "menu";
    }
  | {
      readonly kind: "ready";
      readonly currentRoute: RouteId;
      readonly catalog: StaticCatalogSnapshot;
      readonly destinationCapabilities: DestinationCapabilityMap;
      readonly deckSummaries: readonly DeckSummary[];
    }
  | {
      readonly kind: "navigation-pending";
      readonly currentRoute: RouteId;
      readonly targetRoute: RouteId;
      readonly catalog: StaticCatalogSnapshot;
      readonly destinationCapabilities: DestinationCapabilityMap;
      readonly deckSummaries: readonly DeckSummary[];
    }
  | {
      readonly kind: "fatal-error";
      readonly currentRoute: "menu";
      readonly error: FatalErrorState;
    };

export type AppEvent =
  | {
      readonly type: "startup-succeeded";
      readonly catalog: StaticCatalogSnapshot;
      readonly destinationCapabilities: DestinationCapabilityMap;
      readonly deckSummaries: readonly DeckSummary[];
    }
  | {
      readonly type: "startup-failed";
      readonly error: FatalErrorState;
    }
  | {
      readonly type: "menu-action-requested";
      readonly actionId: MenuActionId;
    }
  | {
      readonly type: "transition-succeeded";
      readonly routeId: RouteId;
    }
  | {
      readonly type: "route-selected";
      readonly routeId: RouteId;
    }
  | {
      readonly type: "transition-failed";
      readonly error: FatalErrorState;
    };

export interface StartupFailureInput {
  readonly issues?: readonly StaticCatalogValidationIssue[];
  readonly unknownError?: unknown;
}
