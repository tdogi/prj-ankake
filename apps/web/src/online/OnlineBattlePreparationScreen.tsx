import { type SavedDeckSummary, type StaticCatalogSnapshot } from "@ankake/domain";
import type { DeckRepository, OnlineDisplayNameRepository } from "@ankake/persistence";
import { BackgroundScene, BattleDeckSelector, uiText, type UiLocale } from "@ankake/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  startOnlineCpuBattle,
  type OnlineCpuBattleConnection,
  type OnlineCpuBattlePreferences
} from "./localCpuBattleClient";

export interface OnlineBattlePreparationScreenProps {
  readonly repository: DeckRepository;
  readonly displayNameRepository: OnlineDisplayNameRepository;
  readonly catalog: StaticCatalogSnapshot;
  readonly locale: UiLocale;
  readonly onLocaleChange: (locale: UiLocale) => void;
  readonly onReturn: () => void;
  readonly initialPreferences?: OnlineCpuBattlePreferences;
  readonly onMatched: (connection: OnlineCpuBattleConnection, preferences: OnlineCpuBattlePreferences) => void;
}

export function OnlineBattlePreparationScreen(props: OnlineBattlePreparationScreenProps) {
  const [name, setName] = usePersistedDisplayName(
    props.displayNameRepository,
    props.initialPreferences?.displayName
  );
  const [passphrase, setPassphrase] = useState(props.initialPreferences?.passphrase ?? "");
  const [deckOptions, setDeckOptions] = useState<readonly SavedDeckSummary[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>();
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [deckLoadFailed, setDeckLoadFailed] = useState(false);
  const [status, setStatus] = useState<"match-failed" | "config-error">();
  const [matching, setMatching] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const preferredDeckId = props.initialPreferences?.playerDeckId;
    props.repository.listDecks().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setDeckLoadFailed(true);
        setLoadingDecks(false);
        return;
      }
      setDeckOptions(result.value);
      setSelectedDeckId(
        result.value.some((deck) => deck.deckId === preferredDeckId && deck.battleReady)
          ? preferredDeckId
          : result.value.find((deck) => deck.battleReady)?.deckId
      );
      setLoadingDecks(false);
      nameInputRef.current?.focus();
    });
    return () => { cancelled = true; };
  }, [props.initialPreferences?.playerDeckId, props.repository]);

  const selectedDeck = useMemo(
    () => deckOptions.find((deck) => deck.deckId === selectedDeckId),
    [deckOptions, selectedDeckId]
  );
  const startDisabledReason = getStartDisabledReason({ name, selectedDeck, loadingDecks, deckLoadFailed, matching });

  async function match(): Promise<void> {
    if (startDisabledReason || !selectedDeck) return;
    setMatching(true);
    setStatus(undefined);
    try {
      const deckResult = await props.repository.loadDeck(selectedDeck.deckId);
      if (!deckResult.ok) throw new Error("Selected deck could not be loaded.");
      const connection = await startOnlineCpuBattle({
        playerName: name.trim(),
        passphrase,
        playerDeck: deckResult.value,
        catalog: props.catalog
      });
      props.onMatched(connection, {
        displayName: name.trim(),
        passphrase,
        playerDeckId: selectedDeck.deckId
      });
    } catch {
      setStatus(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "match-failed" : "config-error");
      setMatching(false);
    }
  }

  return (
    <main className="battle-prep-screen online-battle-prep-screen" data-testid="online-battle-preparation-screen">
      <BackgroundScene />
      <header className="battle-prep-header">
        <button className="battle-button battle-button--quiet" disabled={matching} onClick={props.onReturn} type="button">{uiText(props.locale, "battle.back")}</button>
        <div>
          <p className="battle-kicker">{uiText(props.locale, "online.kicker")}</p>
          <h1>{uiText(props.locale, "online.title")}</h1>
        </div>
        <LanguageSwitcher locale={props.locale} onChange={props.onLocaleChange} />
      </header>
      <section className="battle-prep-grid">
        <label className="battle-panel battle-deck-selector">
          <span>{uiText(props.locale, "online.display-name")}</span>
          <input aria-label={uiText(props.locale, "online.display-name")} ref={nameInputRef} disabled={matching} value={name} onChange={(event) => setName(event.currentTarget.value)} />
          <small>{uiText(props.locale, "online.display-name.help")}</small>
        </label>
        <label className="battle-panel battle-deck-selector">
          <span>{uiText(props.locale, "online.passphrase")}</span>
          <input aria-label={uiText(props.locale, "online.passphrase")} disabled={matching} value={passphrase} onChange={(event) => setPassphrase(event.currentTarget.value)} />
          <small>{passphrase.trim() ? uiText(props.locale, "online.passphrase-match") : uiText(props.locale, "online.random-match")}</small>
        </label>
        <BattleDeckSelector
          label={uiText(props.locale, "online.deck")}
          testId="online-battle-deck-selector"
          deckId={selectedDeckId}
          decks={deckOptions}
          disabled={matching || loadingDecks || deckLoadFailed}
          onChange={setSelectedDeckId}
          locale={props.locale}
        />
        <section className="battle-panel battle-start-panel">
          <h2>{uiText(props.locale, "online.status")}</h2>
          <p data-testid="online-match-status">{matching ? uiText(props.locale, "online.status.matching") : status ? uiText(props.locale, status === "config-error" ? "online.connection.config-error" : "online.match.failed") : startDisabledReason ? uiText(props.locale, startDisabledReason) : uiText(props.locale, "online.status.ready")}</p>
          <p><strong>{uiText(props.locale, "online.connection")}: </strong>{uiText(props.locale, "online.connection.ready")}</p>
          <button className="battle-button battle-button--primary" data-testid="online-match-start-button" disabled={Boolean(startDisabledReason)} onClick={() => void match()} type="button">{uiText(props.locale, "online.match.start")}</button>
        </section>
      </section>
      {matching ? <div className="online-matching-overlay" role="status"><div><h2>{uiText(props.locale, "online.status.matching")}</h2><p>{uiText(props.locale, "online.deck")}: {selectedDeck?.name}</p></div></div> : null}
    </main>
  );
}

function usePersistedDisplayName(repository: OnlineDisplayNameRepository, initialName?: string): readonly [string, (value: string) => void] {
  const [name, setName] = useState(initialName ?? "");
  const hasEdited = useRef(false);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    repository.loadDisplayName().then((result) => {
      if (!cancelled && !hasEdited.current && result.ok) {
        setName(result.value);
      }
    });
    return () => { cancelled = true; };
  }, [repository]);

  function updateDisplayName(value: string): void {
    hasEdited.current = true;
    setName(value);
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => repository.saveDisplayName(value));
  }

  return [name, updateDisplayName];
}

function getStartDisabledReason(input: { readonly name: string; readonly selectedDeck?: SavedDeckSummary; readonly loadingDecks: boolean; readonly deckLoadFailed: boolean; readonly matching: boolean }): "online.status.name-required" | "online.status.deck-required" | "online.deck.loading" | "online.deck.load-failed" | "online.status.matching" | undefined {
  if (input.loadingDecks) return "online.deck.loading";
  if (input.deckLoadFailed) return "online.deck.load-failed";
  if (!input.name.trim()) return "online.status.name-required";
  if (!input.selectedDeck?.battleReady) return "online.status.deck-required";
  if (input.matching) return "online.status.matching";
  return undefined;
}

function LanguageSwitcher({ locale, onChange }: { readonly locale: UiLocale; readonly onChange: (locale: UiLocale) => void }) {
  return <div className="online-language-switcher" data-testid="online-language-switcher"><button aria-pressed={locale === "ja"} onClick={() => onChange("ja")} type="button">日本語</button><button aria-pressed={locale === "en"} onClick={() => onChange("en")} type="button">English</button></div>;
}
