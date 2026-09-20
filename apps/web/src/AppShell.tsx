import {
  appStateReducer,
  createInitialAppSnapshot,
  projectMenuViewModel,
  type AppEvent,
  type DiagnosticEvent,
  type MenuActionId,
  type StaticCatalogSnapshot
} from "@ankake/domain";
import {
  BattlePreparationScreen,
  BattleScreen,
  DeckBuildingScreen,
  DialogOverlayHost,
  MenuScreen
} from "@ankake/ui";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { cardNameMap, localizeBattleLogEntries, localizeBattleView } from "./i18n/cardLocalization";
import type { AppLocale } from "./i18n/localization";
import { useBattleController } from "./battle/useBattleController";
import { createDeckRepository } from "./deck/createDeckRepository";
import { useDeckBuildingController } from "./deck/useDeckBuildingController";
import { createUow001DestinationCapabilities } from "./routes/routes";
import { runStartup } from "./startup/startupOrchestrator";
import { OnlineBattlePreparationScreen } from "./online/OnlineBattlePreparationScreen";
import { IndexedDbOnlineDisplayNameRepository } from "@ankake/persistence";

export function AppShell() {
  const destinationCapabilities = useMemo(() => createUow001DestinationCapabilities(), []);
  const [snapshot, dispatch] = useReducer(appStateReducer, createInitialAppSnapshot());
  const [locale, setLocale] = useState<AppLocale>("ja");
  const [onlineBattleDeckId, setOnlineBattleDeckId] = useState<string>();
  const viewModel = projectMenuViewModel(snapshot, destinationCapabilities);

  useEffect(() => {
    let cancelled = false;

    runStartup({
      destinationCapabilities,
      recordDiagnostic: recordLocalDiagnostic
    }).then((event: AppEvent) => {
      if (!cancelled) {
        dispatch(event);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [destinationCapabilities]);

  useEffect(() => {
    if (snapshot.kind === "navigation-pending") {
      dispatch({
        type: "transition-succeeded",
        routeId: snapshot.targetRoute
      });
    }
  }, [snapshot]);

  function handleActionSelected(actionId: MenuActionId): void {
    dispatch({
      type: "menu-action-requested",
      actionId
    });
  }

  function handleReloadRequested(): void {
    window.location.reload();
  }

  function handleReturnToMenu(): void {
    setOnlineBattleDeckId(undefined);
    dispatch({
      type: "route-selected",
      routeId: "menu"
    });
  }

  if (snapshot.kind === "ready" && snapshot.currentRoute === "deck-building") {
    return <DeckBuildingRoute catalog={snapshot.catalog} locale={locale} onReturnToMenu={handleReturnToMenu} />;
  }

  if (snapshot.kind === "ready" && snapshot.currentRoute === "battle-preparation") {
    return <BattleRoute catalog={snapshot.catalog} locale={locale} onReturnToMenu={handleReturnToMenu} autoStart={Boolean(onlineBattleDeckId)} initialPlayerDeckId={onlineBattleDeckId} />;
  }
  if (snapshot.kind === "ready" && snapshot.currentRoute === "online-battle-preparation") {
    return <OnlineBattleRoute catalog={snapshot.catalog} locale={locale} onLocaleChange={setLocale} onReturn={handleReturnToMenu} onMatched={(playerDeckId) => { setOnlineBattleDeckId(playerDeckId); dispatch({ type: "route-selected", routeId: "battle-preparation" }); }} />;
  }

  return (
    <>
      <MenuScreen viewModel={viewModel} locale={locale} onLocaleChange={setLocale} onActionSelected={handleActionSelected} />
      <DialogOverlayHost viewModel={viewModel} locale={locale} onReloadRequested={handleReloadRequested} />
    </>
  );
}

function OnlineBattleRoute({ catalog, locale, onLocaleChange, onReturn, onMatched }: { readonly catalog: StaticCatalogSnapshot; readonly locale: AppLocale; readonly onLocaleChange: (locale: AppLocale) => void; readonly onReturn: () => void; readonly onMatched: (playerDeckId: string) => void }) {
  const repository = useMemo(() => createDeckRepository(catalog), [catalog]);
  const displayNameRepository = useMemo(() => new IndexedDbOnlineDisplayNameRepository(), []);
  return <OnlineBattlePreparationScreen repository={repository} displayNameRepository={displayNameRepository} locale={locale} onLocaleChange={onLocaleChange} onReturn={onReturn} onMatched={onMatched} />;
}

interface BattleRouteProps {
  readonly catalog: StaticCatalogSnapshot;
  readonly locale: AppLocale;
  readonly onReturnToMenu: () => void;
  readonly autoStart?: boolean;
  readonly initialPlayerDeckId?: string;
}

function BattleRoute({ catalog, locale, onReturnToMenu, autoStart, initialPlayerDeckId }: BattleRouteProps) {
  const repository = useMemo(() => createDeckRepository(catalog), [catalog]);
  const hasAutoStarted = useRef(false);
  const controller = useBattleController({
    catalog,
    repository,
    onReturnToMenu,
    initialPlayerDeckId
  });
  useEffect(() => {
    if (hasAutoStarted.current || !autoStart || controller.viewModel.kind !== "preparation" || controller.viewModel.preparation.loading || controller.viewModel.startDisabledReason) return;
    hasAutoStarted.current = true;
    void controller.actions.startBattle();
  }, [autoStart, controller]);

  if (controller.viewModel.kind === "preparation") {
    return (
      <BattlePreparationScreen
        viewModel={controller.viewModel.preparation}
        startDisabledReason={controller.viewModel.startDisabledReason}
        onReturnToMenu={controller.actions.returnToMenu}
        onSelectPlayerDeck={controller.actions.selectPlayerDeck}
        onSelectCpuDeck={controller.actions.selectCpuDeck}
        onFirstPlayerModeChange={controller.actions.setFirstPlayerMode}
        onStartBattle={() => {
          void controller.actions.startBattle();
        }}
        locale={locale}
      />
    );
  }

  return (
    <BattleScreen
      viewModel={localizeBattleView(controller.viewModel.publicView, locale)}
      locale={locale}
      interaction={controller.viewModel.interaction}
      logEntries={localizeBattleLogEntries(controller.viewModel.logEntries, locale)}
      cpuStatus={controller.viewModel.cpuStatus}
      resonanceIssueCode={controller.viewModel.lastValidationIssueCode}
      animationEvent={controller.viewModel.animationEvent}
      activeAttackerInstanceId={controller.viewModel.activeAttackerInstanceId}
      defeatedCreature={controller.viewModel.defeatedCreature}
      destroyedCreatureInstanceIds={controller.viewModel.destroyedCreatureInstanceIds}
      isAnimating={controller.viewModel.isAnimating}
      onReturnToPreparation={controller.actions.quitBattle}
      onReturnToMenu={controller.actions.returnToMenu}
      onEndPlayPhase={() => {
        void controller.actions.endPlayPhase();
      }}
      onHandCardIntent={controller.actions.selectHandCard}
      onBoardCreatureIntent={controller.actions.selectBoardCreature}
      onBoardSquareIntent={controller.actions.selectBoardSquare}
      onEffectCandidateIntent={controller.actions.selectEffectCandidate}
      onCancelInteraction={controller.actions.cancelInteraction}
      onUndoInteraction={controller.actions.undoInteraction}
      onRematch={() => {
        void controller.actions.rematch();
      }}
      onQuitBattle={controller.actions.quitBattle}
    />
  );
}

interface DeckBuildingRouteProps {
  readonly catalog: StaticCatalogSnapshot;
  readonly locale: AppLocale;
  readonly onReturnToMenu: () => void;
}

function DeckBuildingRoute({ catalog, locale, onReturnToMenu }: DeckBuildingRouteProps) {
  const repository = useMemo(() => createDeckRepository(catalog), [catalog]);
  const controller = useDeckBuildingController({
    catalog,
    repository,
    onReturnToMenu
  });

  return (
    <DeckBuildingScreen
      viewModel={{ ...controller.viewModel, criteria: { ...controller.viewModel.criteria, comparisonLocale: locale, localizedNames: cardNameMap(catalog.cards, locale) } }}
      locale={locale}
      saveDisabledReason={controller.actions.getSaveDisabledReason()}
      onReturnToMenu={controller.actions.returnToMenu}
      onSaveDeck={() => {
        void controller.actions.saveDeck();
      }}
      onCreateNewDeck={controller.actions.createNewDeck}
      onSelectSavedDeck={(deckId) => {
        void controller.actions.selectSavedDeck(deckId);
      }}
      onDeckNameChange={controller.actions.updateDeckName}
      onCriteriaChange={controller.actions.updateSearchCriteria}
      onResetCriteria={controller.actions.resetSearchCriteria}
      onAddCard={controller.actions.addCard}
      onAutoBuildDeck={controller.actions.autoBuildDeck}
      onRemoveCard={controller.actions.removeCard}
      onOpenCardDetail={controller.actions.openCardDetail}
      onCloseDialog={controller.actions.closeDialog}
      onRequestDeleteDeck={controller.actions.requestDeleteDeck}
      onConfirmDeleteDeck={(deckId) => {
        void controller.actions.confirmDeleteDeck(deckId);
      }}
      onResolveUnsavedChanges={(choice) => {
        void controller.actions.resolveUnsavedChanges(choice);
      }}
    />
  );
}

function recordLocalDiagnostic(event: DiagnosticEvent): void {
  if (event.level === "error") {
    console.error("[ankake]", event.category, event.message, event.details ?? []);
    return;
  }

  console.info("[ankake]", event.category, event.message, event.details ?? []);
}
