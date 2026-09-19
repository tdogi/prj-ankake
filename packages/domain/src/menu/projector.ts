import type {
  AppSnapshot,
  DestinationCapability,
  DestinationCapabilityMap,
  FatalErrorState,
  MenuActionId
} from "../app-state/types";

export interface MenuActionViewModel {
  readonly id: MenuActionId;
  readonly label: string;
  readonly description: string;
  readonly routeLabel: string;
  readonly enabled: boolean;
  readonly disabledReason?: string;
  readonly dataTestId: string;
  readonly tone: "primary" | "secondary";
}

export interface LoadingOverlayViewModel {
  readonly visible: boolean;
  readonly label: string;
}

export interface MenuViewModel {
  readonly title: string;
  readonly subtitle: string;
  readonly versionText: string;
  readonly actions: readonly MenuActionViewModel[];
  readonly loadingOverlay: LoadingOverlayViewModel;
  readonly fatalErrorDialog?: FatalErrorState;
}

const MENU_ACTION_ORDER: readonly MenuActionId[] = ["online-battle", "cpu-battle", "deck-building"];

const MENU_ACTION_COPY: Record<MenuActionId, Pick<MenuActionViewModel, "description" | "dataTestId" | "tone" | "routeLabel">> = {
  "online-battle": { description: "Match locally against CPU.", dataTestId: "menu-action-online-battle", tone: "primary", routeLabel: "Online battle" },
  "cpu-battle": {
    description: "Play a local CPU match after battle rules arrive.",
    dataTestId: "menu-action-cpu-battle",
    tone: "primary",
    routeLabel: "CPU battle"
  },
  "deck-building": {
    description: "Prepare and tune local decks after deck storage arrives.",
    dataTestId: "menu-action-deck-building",
    tone: "secondary",
    routeLabel: "Deck building"
  }
};

export function projectMenuViewModel(
  state: AppSnapshot,
  configuredCapabilities: DestinationCapabilityMap
): MenuViewModel {
  const readiness = state.kind === "ready" ? state : undefined;
  const capabilities = readiness?.destinationCapabilities ?? configuredCapabilities;

  return {
    title: "Project Ankake",
    subtitle: "Original digital card game prototype",
    versionText: readiness ? `Catalog ${readiness.catalog.version.catalogVersion}` : "Catalog loading",
    actions: MENU_ACTION_ORDER.map((actionId) => projectAction(actionId, capabilities[actionId], state.kind === "ready")),
    loadingOverlay: {
      visible: state.kind === "initializing" || state.kind === "navigation-pending",
      label: state.kind === "navigation-pending" ? "Opening destination" : "Loading catalog"
    },
    fatalErrorDialog: state.kind === "fatal-error" ? state.error : undefined
  };
}

function projectAction(
  actionId: MenuActionId,
  capability: DestinationCapability | undefined,
  isReady: boolean
): MenuActionViewModel {
  const copy = MENU_ACTION_COPY[actionId];
  const enabled = isReady && Boolean(capability?.enabled);

  return {
    id: actionId,
    label: capability?.label ?? copy.routeLabel,
    description: copy.description,
    routeLabel: copy.routeLabel,
    enabled,
    disabledReason: enabled ? undefined : capability?.disabledReason ?? "Available in a later unit of work.",
    dataTestId: copy.dataTestId,
    tone: copy.tone
  };
}
