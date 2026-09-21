import {
  RESONANCE_ACTIVE_THRESHOLD,
  type BattleCardView,
  type BattleLogEntry,
  type BattleLogSourceCard,
  type BattleSide,
  type PublicBattleView
} from "@ankake/domain";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { localizeBattleEvent, localizeBattleSide, uiText } from "../../localization";

export interface BattleStatusPanelProps {
  readonly viewModel: PublicBattleView;
  readonly cpuStatus: string;
  readonly opponentName?: string;
  readonly onReturnToMenu: () => void;
  readonly onQuitBattle: () => void;
  readonly locale?: "ja" | "en";
  readonly interactionDisabled?: boolean;
}

export function BattleStatusPanel(props: BattleStatusPanelProps) {
  const { viewModel } = props;

  return (
    <header className="battle-status-bar" data-testid="battle-status-bar">
      <div>
        <p className="battle-kicker">{props.locale === "ja" ? "ターン" : "Turn"} {viewModel.turnNumber}</p>
        <h1>
          {viewModel.activeSide === "player" ? localizeBattleSide(props.locale, "player") : props.opponentName ?? "CPU"} -{" "}
          {phaseLabel(viewModel.phase, props.locale)}
        </h1>
      </div>
      <span data-testid="battle-turn-timer">90s</span>
      <span aria-live="polite" data-testid="battle-cpu-status">
        CPU {cpuStatusLabel(props.cpuStatus, props.locale)}
      </span>
      <button
        className="battle-button battle-button--quiet"
        data-testid="battle-quit-button"
        disabled={props.interactionDisabled}
        type="button"
        onClick={props.onQuitBattle}
      >
        {uiText(props.locale, "battle.quit")}
      </button>
      <button
        className="battle-button battle-button--quiet"
        data-testid="battle-menu-button"
        disabled={props.interactionDisabled}
        type="button"
        onClick={props.onReturnToMenu}
      >
        {props.locale === "ja" ? "メニュー" : "Menu"}
      </button>
    </header>
  );
}

export interface BattleResourceControlsProps {
  readonly viewModel: PublicBattleView;
  readonly canEndPlayPhase: boolean;
  readonly onEndPlayPhase: () => void;
  readonly locale?: "ja" | "en";
  readonly opponentName?: string;
}

export function BattleResourceControls(props: BattleResourceControlsProps) {
  return (
    <section
      className="battle-panel battle-resource-controls"
      data-testid="battle-resource-controls"
    >
      <span className="battle-resource-controls__pp" data-testid="battle-player-pp">
        {props.viewModel.playerCurrentPp}<small>/{props.viewModel.playerMaxPp} PP</small>
      </span>
      <button
        className="battle-button battle-button--primary"
        data-testid="battle-end-play-phase-button"
        disabled={!props.canEndPlayPhase}
        type="button"
        onClick={props.onEndPlayPhase}
      >
        {uiText(props.locale, "battle.end-play-phase")}
      </button>
    </section>
  );
}

export function BattleInfoPanels(props: {
  readonly viewModel: PublicBattleView;
  readonly onOpenGraveyard: (side: BattleSide) => void;
  readonly locale?: "ja" | "en";
  readonly opponentName?: string;
}) {
  const { viewModel } = props;

  return (
    <>
      <section className="battle-panel battle-card-counts" data-testid="battle-card-counts-panel">
        <h2>{props.locale === "ja" ? "カード枚数" : "Cards"}</h2>
        <CardCounts side="player" handCount={viewModel.playerHand.length} deckCount={viewModel.playerDeckCount} graveyardCount={viewModel.playerGraveyard.length} locale={props.locale} onOpenGraveyard={props.onOpenGraveyard} />
        <CardCounts side="cpu" handCount={viewModel.cpuHandCount} deckCount={viewModel.cpuDeckCount} graveyardCount={viewModel.cpuGraveyard.length} opponentName={props.opponentName} locale={props.locale} onOpenGraveyard={props.onOpenGraveyard} />
      </section>
      <ResonancePanel viewModel={viewModel} opponentName={props.opponentName} locale={props.locale} />
    </>
  );
}

function CardCounts(props: { readonly side: BattleSide; readonly handCount: number; readonly deckCount: number; readonly graveyardCount: number; readonly opponentName?: string; readonly locale?: "ja" | "en"; readonly onOpenGraveyard: (side: BattleSide) => void }) {
  const label = props.side === "player" ? (props.locale === "ja" ? "プレイヤー" : "Player") : props.opponentName ?? "CPU";
  return <section className="battle-card-counts__side" data-testid={`battle-${props.side}-info-panel`}>
    <h3>{label}</h3>
    <p>{props.locale === "ja" ? "手札" : "Hand"}: {props.handCount}</p>
    <p>{props.locale === "ja" ? "山札" : "Deck"}: {props.deckCount}</p>
    <button className="battle-card-counts__graveyard" data-testid={`battle-${props.side}-graveyard-button`} type="button" onClick={() => props.onOpenGraveyard(props.side)}>
      {props.locale === "ja" ? "墓地" : "Graveyard"}: {props.graveyardCount}
    </button>
  </section>;
}

function ResonancePanel(props: { readonly viewModel: PublicBattleView; readonly opponentName?: string; readonly locale?: "ja" | "en" }) {
  const [side, setSide] = useState<BattleSide>("player");
  const playerLabel = props.locale === "ja" ? "味方" : "Player";
  const cpuLabel = props.opponentName ?? (props.locale === "ja" ? "敵" : "CPU");
  return <section className="battle-panel" data-testid="battle-resonance-panel">
    <div className="battle-resonance-tabs" role="group" aria-label={props.locale === "ja" ? "共鳴値の表示対象" : "Resonance display side"}>
      <button className="battle-button battle-button--quiet" data-testid="battle-resonance-player-tab" aria-pressed={side === "player"} type="button" onClick={() => setSide("player")}>{playerLabel}</button>
      <button className="battle-button battle-button--quiet" data-testid="battle-resonance-cpu-tab" aria-pressed={side === "cpu"} type="button" onClick={() => setSide("cpu")}>{cpuLabel}</button>
    </div>
    <ResonanceTable resonance={side === "player" ? props.viewModel.playerResonance : props.viewModel.cpuResonance} side={side} locale={props.locale} />
  </section>;
}

function ResonanceTable(props: { readonly resonance: PublicBattleView["playerResonance"]; readonly side: BattleSide; readonly locale?: "ja" | "en" }) {
  const lanes = ["left", "center", "right"] as const;
  const attributes = ["fire", "water", "wind", "light", "dark"] as const;
  const label = (value: string) => props.locale === "ja" ? ({ left: "左", center: "中央", right: "右", fire: "火", water: "水", wind: "風", light: "光", dark: "闇" }[value] ?? value) : value;
  const [showEffects, setShowEffects] = useState(false);
  return <div
    className="battle-resonance"
    data-testid={`battle-${props.side}-resonance`}
    tabIndex={0}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setShowEffects(false); }}
    onFocus={() => setShowEffects(true)}
    onMouseEnter={() => setShowEffects(true)}
    onMouseLeave={() => setShowEffects(false)}
  >
    <table className="battle-resonance-table">
      <caption>{props.locale === "ja" ? "共鳴" : "Resonance"}</caption>
      <thead><tr><th scope="col">{props.locale === "ja" ? "属性" : "Attribute"}</th>{lanes.map((lane) => <th key={lane} scope="col">{label(lane)}</th>)}</tr></thead>
      <tbody>{attributes.map((attribute) => <tr className={`battle-resonance-table__row--${attribute}`} key={attribute}><th scope="row">{label(attribute)}</th>{lanes.map((lane) => {
        const value = props.resonance[lane]?.[attribute] ?? 0;
        return <td className={value >= RESONANCE_ACTIVE_THRESHOLD ? "battle-resonance-table__cell--active" : undefined} key={lane} data-testid={`battle-resonance-${lane}-${attribute}`}>{value}</td>;
      })}</tr>)}</tbody>
    </table>
    {showEffects ? <ResonanceEffectPopover locale={props.locale} /> : null}
  </div>;
}

function ResonanceEffectPopover(props: { readonly locale?: "ja" | "en" }) {
  const effects = props.locale === "ja" ? [
    ["火", "そのレーンの味方クリーチャーの攻撃力を+1。"],
    ["水", "各レーンで最初に移動する味方クリーチャーの移動力を、そのターン中+1。"],
    ["風", "各レーンで最初に召喚するクリーチャーのコストを1軽減（最低1）。"],
    ["光", "自分のアタックフェーズ終了時、レーン上の味方と味方拠点を1回復。"],
    ["闇", "各ターン最初に破壊された味方クリーチャーのマスへ、1/1トークンを召喚。"]
  ] : [
    ["Fire", "Allied creatures in that lane gain +1 attack."],
    ["Water", "The first allied creature moved in each lane gains +1 movement this turn."],
    ["Wind", "The first creature summoned in each lane costs 1 less (minimum 1)."],
    ["Light", "At your attack phase end, restore 1 HP to allies and controlled bases in that lane."],
    ["Dark", "The first allied creature destroyed in each lane each turn leaves a 1/1 token."]
  ];
  return <section aria-live="polite" className="battle-resonance__effects battle-resonance__effects--left" data-testid="battle-resonance-effects">
    <strong>{props.locale === "ja" ? "属性ごとの共鳴効果" : "Resonance effects"}</strong>
    <ul>{effects.map(([attribute, effect]) => <li className={`battle-resonance__effect--${attribute.toLowerCase()}`} key={attribute}><b>{attribute}</b><span>{effect}</span></li>)}</ul>
  </section>;
}

function phaseLabel(phase: PublicBattleView["phase"], locale?: "ja" | "en"): string {
  switch (phase) {
    case "play":
      return locale === "ja" ? "プレイフェーズ" : "Play phase";
    case "automatic":
      return locale === "ja" ? "自動フェーズ" : "Automatic phase";
    case "terminal":
      return locale === "ja" ? "対戦終了" : "Battle complete";
  }
}

function cpuStatusLabel(status: string, locale?: "ja" | "en"): string {
  if (locale !== "ja") return status;
  return ({ idle: "待機中", thinking: "思考中", executing: "実行中", completed: "完了", "limit-reached": "上限到達" }[status] ?? status);
}

export function BattleLogPanel(props: {
  readonly entries: readonly BattleLogEntry[];
  readonly locale?: "ja" | "en";
  readonly onSourceCardIntent?: (card: BattleLogSourceCard, element: HTMLButtonElement) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const entriesRef = useRef<HTMLOListElement>(null);

  // Only set the initial viewport when the popover opens.  New entries must
  // not pull a reader away from older entries they deliberately scrolled to.
  useLayoutEffect(() => {
    if (isOpen && entriesRef.current) {
      entriesRef.current.scrollTop = entriesRef.current.scrollHeight;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
    };
  }, [isOpen]);

  return (
    <section className="battle-log-control" data-testid="battle-log-control" ref={containerRef}>
      <button
        aria-controls="battle-log-popover"
        aria-expanded={isOpen}
        className="battle-button battle-log-control__button"
        data-testid="battle-log-toggle"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        {uiText(props.locale, "battle.log")}
      </button>
      {isOpen ? (
        <section
          aria-label={uiText(props.locale, "battle.log")}
          className="battle-log-popover"
          data-testid="battle-log-panel"
          id="battle-log-popover"
          role="dialog"
        >
          <header className="battle-log-popover__header">
            <h2>{uiText(props.locale, "battle.log")}</h2>
            <button
              aria-label={props.locale === "ja" ? "対戦ログを閉じる" : "Close battle log"}
              className="battle-button battle-button--quiet"
              data-testid="battle-log-close"
              type="button"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </header>
          <ol data-testid="battle-log-entries" ref={entriesRef}>
            {props.entries.map((entry) => (
              <li key={entry.sequence}>
                <span>{localizeLogMessage(entry, props.locale)}</span>
                {entry.sourceCard ? <span className="battle-log-entry__effect-source">
                  {uiText(props.locale, "battle.log.effect-source")}: <button
                    className="battle-log-entry__source-card"
                    data-testid={`battle-log-effect-source-${entry.sequence}`}
                    type="button"
                    onClick={(event) => props.onSourceCardIntent?.(entry.sourceCard!, event.currentTarget)}
                  >
                    {entry.sourceCard.name}
                  </button>
                </span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </section>
  );
}

function localizeLogMessage(entry: BattleLogEntry, locale?: "ja" | "en"): string {
  return localizeBattleEvent(locale, entry);
}
