import type { BattleCardView, BattleSide, PublicBattleView } from "@ankake/domain";
import { useRef, useState } from "react";
import { CardArtwork } from "../CardArtwork";
import { BattleCardDetailPopover } from "./BattleCardDetailPopover";
import { type UiLocale, uiText } from "../../localization";

export function BattleResultOverlay(props: {
  readonly viewModel: PublicBattleView;
  readonly onRematch: () => void;
  readonly onReturnToPreparation: () => void;
  readonly locale?: UiLocale;
  readonly interactionDisabled?: boolean;
}) {
  const result = props.viewModel.terminalResult;

  if (!result) {
    return null;
  }

  return (
    <div className="battle-modal-backdrop" data-testid="battle-result-overlay">
      <section className="battle-modal">
        <h2>{result.winner === "player" ? uiText(props.locale, "battle.result.victory") : uiText(props.locale, "battle.result.defeat")}</h2>
        <p data-testid="battle-result-reason">{uiText(props.locale, "battle.result.reason")}: {reasonLabel(result, props.locale)}</p>
        <p data-testid="battle-result-turn">{uiText(props.locale, "battle.result.turn")}: {result.turnNumber}</p>
        <div className="battle-modal__actions">
          <button className="battle-button battle-button--primary" data-testid="battle-rematch-button" disabled={props.interactionDisabled} type="button" onClick={props.onRematch}>
            {uiText(props.locale, "battle.result.rematch")}
          </button>
          <button className="battle-button" data-testid="battle-result-return-button" disabled={props.interactionDisabled} type="button" onClick={props.onReturnToPreparation}>
            {uiText(props.locale, "battle.result.return")}
          </button>
        </div>
      </section>
    </div>
  );
}

function reasonLabel(result: NonNullable<PublicBattleView["terminalResult"]>, locale: UiLocale | undefined): string {
  if (result.reason === "quit" && result.loser === "player") {
    return uiText(locale, "battle.result.quit-self");
  }
  return uiText(locale, `battle.result.${result.reason}`);
}

export function BattleGraveyardDialog(props: {
  readonly side: BattleSide;
  readonly cards: readonly BattleCardView[];
  readonly selectableCardIds?: readonly string[];
  readonly selectedCardIds?: readonly string[];
  readonly onSelectCard?: (id: string) => void;
  readonly onClose: () => void;
  readonly locale?: UiLocale;
}) {
  const selectable = props.selectableCardIds ? new Set(props.selectableCardIds) : undefined;
  const selected = new Set(props.selectedCardIds);
  const sideLabel = props.side === "player" ? (props.locale === "ja" ? "プレイヤー" : "Player") : "CPU";
  const [detail, setDetail] = useState<{ readonly card: BattleCardView; readonly element: HTMLElement; readonly position: { readonly left: number; readonly top: number } }>();
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();

  function showDetail(card: BattleCardView, element: HTMLElement): void {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setDetail({ card, element, position: calculateDetailPosition(element) });
  }

  function scheduleDetailClose(): void {
    leaveTimer.current = setTimeout(() => setDetail(undefined), 80);
  }

  return <div className="battle-modal-backdrop battle-graveyard-backdrop" role="presentation">
    <section aria-label={`${sideLabel} ${props.locale === "ja" ? "墓地" : "graveyard"}`} aria-modal="true" className="battle-modal battle-graveyard-dialog" data-testid={`battle-${props.side}-graveyard-dialog`} role="dialog">
      <div className="battle-graveyard-dialog__header">
        <h2>{sideLabel} {props.locale === "ja" ? "墓地" : "graveyard"}</h2>
        <button className="battle-button battle-button--quiet" data-testid="battle-graveyard-close-button" type="button" onClick={props.onClose}>{props.locale === "ja" ? "閉じる" : "Close"}</button>
      </div>
      {props.cards.length === 0 ? <p>{props.locale === "ja" ? "墓地にカードはありません。" : "There are no cards in this graveyard."}</p> : <ol className="battle-graveyard-list">
        {props.cards.map((card) => {
          const canSelect = selectable?.has(card.instanceId) ?? false;
          const isSelected = selected.has(card.instanceId);
          return <li key={card.instanceId}>
            {selectable ? <button aria-disabled={!canSelect} aria-pressed={isSelected} className={`battle-graveyard-card ${isSelected ? "battle-graveyard-card--selected" : ""} ${!canSelect ? "battle-graveyard-card--unavailable" : ""}`} data-testid={`battle-graveyard-card-${card.instanceId}`} type="button" onClick={() => canSelect && props.onSelectCard?.(card.instanceId)} onPointerEnter={(event) => showDetail(card, event.currentTarget)} onPointerLeave={scheduleDetailClose}>
              <CardSummary card={card} locale={props.locale} />
              <span>{isSelected ? (props.locale === "ja" ? "選択済み" : "Selected") : (props.locale === "ja" ? "選択" : "Select")}</span>
            </button> : <article className="battle-graveyard-card" data-testid={`battle-graveyard-card-${card.instanceId}`} onPointerEnter={(event) => showDetail(card, event.currentTarget)} onPointerLeave={scheduleDetailClose}><CardSummary card={card} locale={props.locale} /></article>}
          </li>;
        })}
      </ol>}
    </section>
    {detail ? <BattleCardDetailPopover card={detail.card} position={detail.position} locale={props.locale} onPointerEnter={() => leaveTimer.current && clearTimeout(leaveTimer.current)} onPointerLeave={scheduleDetailClose} /> : null}
  </div>;
}

function CardSummary(props: { readonly card: BattleCardView; readonly locale?: UiLocale }) {
  return <>
    <CardArtwork attribute={props.card.attribute} catalogCardId={props.card.catalogCardId} className="battle-graveyard-card__artwork" fallbackClassName="battle-graveyard-card__artwork battle-graveyard-card__artwork--fallback" locale={props.locale} name={props.card.name} testIdPrefix="battle-graveyard-artwork" type={props.card.type} />
    <span className="battle-graveyard-card__summary">
    <strong>{props.card.name}</strong>
    <span>{props.locale === "ja" ? "コスト" : "Cost"} {props.card.currentCost ?? "-"}</span>
    <span>{props.card.type === "creature" || props.card.type === "creature-token" ? `${props.card.currentAttack ?? "-"}/${props.card.maxHp ?? "-"}` : props.card.type}</span>
    </span>
  </>;
}

function calculateDetailPosition(element: HTMLElement): { readonly left: number; readonly top: number } {
  const rect = element.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 16);
  const height = 260;
  const below = rect.bottom + 8;
  const top = below + height <= window.innerHeight ? below : Math.max(8, rect.top - height - 8);
  return { left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top };
}
