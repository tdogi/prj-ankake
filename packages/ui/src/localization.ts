import type { BattleEvent, BattleLogEntry, BattleSide, CardMasterRecord } from "@ankake/domain";

/** Presentation-only copy. Domain IDs and state remain locale independent. */
export type UiLocale = "ja" | "en";

const JAPANESE = {
  "menu.subtitle": "オリジナルデジタルカードゲーム・プロトタイプ",
  "menu.online-battle": "オンライン対戦",
  "menu.cpu-battle": "CPU対戦",
  "menu.deck-building": "デッキ構築",
  "menu.online-battle.description": "オンライン対戦の相手を探します。",
  "menu.cpu-battle.description": "対戦ルールの実装後にローカル CPU 対戦をプレイできます。",
  "menu.deck-building.description": "デッキ保存機能の実装後にローカルデッキを調整できます。",
  "menu.available-later": "今後の作業単位で利用可能になります。",
  "menu.catalog-loading": "カタログを読み込み中",
  "loading.catalog": "カタログを読み込み中",
  "loading.destination": "画面を開いています",
  "battle.board": "盤面",
  "battle.column": "列",
  "battle.row": "行",
  "battle.normal-square": "通常マス",
  "battle.cpu-base": "敵拠点",
  "battle.player-base": "味方拠点",
  "battle.neutral-base": "中立拠点",
  "battle.health": "HP",
  "battle.attack": "ATK",
  "battle.cost": "コスト",
  "battle.selected-summon": "選択中の召喚先",
  "battle.available-destination": "選択可能な配置先",
  "battle.movement-origin": "移動元",
  "battle.movement-path": "移動経路",
  "battle.provisional-position": "仮のクリーチャー位置",
  "battle.occupied-by": "配置カード",
  "battle.controlled-by": "操作プレイヤー",
  "battle.player-controlled": "プレイヤー",
  "battle.cpu-controlled": "CPU",
  "battle.unclaimed": "中立",
  "battle.unknown": "不明",
  "battle.card-unavailable": "カード情報を取得できません。",
  "battle.resonance.inactive": "このレーンの水共鳴は有効ではありません",
  "battle.resonance.already-used": "このレーンの水共鳴はこのターンに使用済みです",
  "battle.resonance.no-target": "このレーンには水共鳴の対象がありません",
  "battle.resonance.unknown": "操作を実行できませんでした"
  , "battle.terminal": "対戦はすでに終了しています。"
  , "battle.phase.invalid": "プレイフェーズ中のみカードを使用できます。"
  , "battle.side.inactive": "自分のターンではありません。"
  , "battle.resource.pp-insufficient": "PPが不足しています。"
  , "battle.summon.no-destination": "召喚可能な空きマスがありません。"
  , "battle.effect.unsupported": "このカード効果は実行できません。"
  , "battle.card.not-found": "選択したカードは存在しません。"
  , "battle.card.owner-invalid": "選択したカードは自分の手札にありません。"
  , "battle.card.zone-invalid": "選択したカードは手札にありません。"
  , "battle.card.type-invalid": "このカードは召喚できません。"
  , "battle.status": "状態"
  , "battle.status.available": "使用可能"
  , "battle.status.unavailable": "使用不可"
  , "battle.result.victory": "勝利"
  , "battle.result.defeat": "敗北"
  , "battle.result.reason": "理由"
  , "battle.result.turn": "ターン"
  , "battle.result.rematch": "再戦"
  , "battle.result.return": "戻る"
  , "battle.result.base-destroyed": "敵拠点を破壊"
  , "battle.result.neutral-bases-controlled": "すべての中立拠点を制圧"
  , "battle.result.deck-out": "相手がカードを引けない"
  , "battle.result.quit": "相手がリタイア"
  , "battle.result.quit-self": "あなたがリタイア"
  , "deck.menu": "メニュー"
  , "deck.title": "デッキ構築"
  , "deck.untitled": "名称未設定のデッキ"
  , "deck.unsaved": "未保存"
  , "deck.saved": "保存済み"
  , "deck.save": "保存"
  , "deck.saved-decks": "保存済みデッキ"
  , "deck.new": "新しいデッキ"
  , "deck.limit-reached": "ローカルデッキの上限に達しました。"
  , "deck.none-saved": "保存済みデッキはありません。"
  , "deck.cards": "カード"
  , "deck.contents": "内容"
  , "deck.add-cards": "一覧からカードを追加してください。"
  , "deck.add": "追加"
  , "deck.auto-build": "お任せで40枚にする"
  , "deck.remove": "削除"
  , "deck.deck": "デッキ"
  , "deck.name": "名前"
  , "deck.battle-ready": "対戦可能"
  , "deck.draft": "編集中"
  , "deck.delete-deck": "デッキを削除"
  , "deck.stats": "統計"
  , "deck.loading": "デッキデータを読み込み中"
  , "deck.close": "閉じる"
  , "deck.delete": "削除"
  , "deck.cancel": "キャンセル"
  , "deck.discard": "破棄"
  , "deck.unsaved-changes": "未保存の変更"
  , "deck.unsaved-message": "このデッキを離れる前に、変更の扱いを選択してください。"
  , "deck.delete-message": "この保存済みデッキはこのブラウザーから削除されます。"
  , "deck.return-menu": "メニューに戻る"
  , "deck.search": "検索"
  , "deck.type": "種類"
  , "deck.attribute": "属性"
  , "deck.cost": "コスト"
  , "deck.all": "すべて"
  , "deck.name.required": "デッキ名を入力してください。"
  , "deck.sort": "並び順"
  , "deck.sort.name": "名前順"
  , "deck.sort.cost-asc": "コスト昇順"
  , "deck.sort.cost-desc": "コスト降順"
  , "deck.sort.type": "種類順"
  , "deck.sort.attribute": "属性順"
  , "card.artwork-unavailable": "画像を表示できません"
  , "deck.reset": "リセット"
  , "error.generic": "問題が発生しました。もう一度お試しください。"
  , "battle.turn": "ターン"
  , "battle.player": "プレイヤー"
  , "battle.hand": "手札"
  , "battle.deck": "デッキ"
  , "battle.bases": "拠点"
  , "battle.resonance": "共鳴"
  , "battle.attribute": "属性"
  , "battle.resonance-effects": "属性ごとの共鳴効果"
  , "battle.quit": "リタイア"
  , "battle.menu": "メニュー"
  , "battle.log": "対戦ログ"
  , "battle.log.effect-source": "カード効果"
  , "battle.phase-control": "フェーズ操作"
  , "battle.end-play-phase": "プレイフェーズを終了"
  , "battle.summon": "クリーチャーを召喚"
  , "battle.move": "クリーチャーを移動"
  , "battle.choose-summon-target": "召喚時の対象を選択"
  , "battle.choose-spell-target": "スペル対象を選択"
  , "battle.cancel-summon": "召喚を取り消す"
  , "battle.cancel-move": "移動を取り消す"
  , "battle.cancel-spell": "スペルを取り消す"
  , "battle.undo-step": "手順を戻す"
  , "battle.select": "選択"
  , "battle.selected": "選択中"
  , "battle.selected-creature": "選択中のクリーチャー"
  , "battle.movement": "移動"
  , "battle.no-cards-in-hand": "手札はありません。"
  , "battle.preparation": "対戦準備"
  , "battle.back": "戻る"
  , "battle.player-deck": "プレイヤーデッキ"
  , "battle.cpu-deck": "CPUデッキ"
  , "battle.first-player": "先攻"
  , "battle.random": "ランダム"
  , "battle.player-first": "プレイヤー先攻"
  , "battle.player-second": "プレイヤー後攻"
  , "battle.start": "開始"
  , "battle.start-battle": "対戦開始"
  , "battle.loading": "読み込み中..."
  , "battle.select-deck": "デッキを選択"
  , "battle.not-ready": "対戦準備未完了"
  , "battle.preparation.loading": "対戦準備を読み込み中です。"
  , "battle.preparation.create-ready-deck": "先に対戦可能な40枚デッキを1つ以上作成してください。"
  , "battle.preparation.select-decks": "プレイヤーとCPUのデッキを選択してください。"
  , "battle.preparation.both-ready": "選択した両方のデッキを対戦可能な状態にしてください。"
  , "battle.preparation.select-first": "先に対戦デッキを選択してください。"
  , "battle.preparation.start-failed": "対戦を開始できませんでした。"
  , "online.kicker": "オンライン対戦"
  , "online.title": "対戦準備・マッチング"
  , "online.display-name": "表示名"
  , "online.display-name.help": "表示名は対戦相手に表示されます。重複していても対戦できます。"
  , "online.passphrase": "合言葉（任意）"
  , "online.random-match": "ランダムマッチ：合言葉を設定していない相手と対戦します。"
  , "online.passphrase-match": "合言葉マッチ：同じ合言葉を入力した相手とのみ対戦します。"
  , "online.deck": "使用デッキ"
  , "online.deck.change": "変更"
  , "online.deck.select": "使用デッキを選択"
  , "online.deck.none": "使用する対戦可能なデッキを選択してください。"
  , "online.deck.ready": "対戦可能"
  , "online.deck.not-ready": "対戦できません"
  , "online.deck.cards": "枚"
  , "online.deck.not-ready.card-count": "カード枚数が40枚ではありません。"
  , "online.deck.loading": "保存済みデッキを読み込んでいます…"
  , "online.deck.load-failed": "保存済みデッキを読み込めませんでした。"
  , "online.deck.no-saved": "保存済みデッキはありません。"
  , "online.status": "状態"
  , "online.status.ready": "対戦を開始できます。"
  , "online.status.name-required": "表示名を入力してください。"
  , "online.status.deck-required": "対戦可能な使用デッキを選択してください。"
  , "online.status.matching": "対戦相手を探しています。"
  , "online.connection": "通信状態"
  , "online.connection.ready": "マッチング要求を送信できます。"
  , "online.match.start": "マッチングを開始"
  , "online.match.failed": "マッチングを開始できませんでした。もう一度お試しください。"
  , "online.connection.config-error": "マッチングサービスの接続設定を確認してください。"
  , "battle.cpu-status.idle": "待機中"
  , "battle.cpu-status.thinking": "思考中"
  , "battle.cpu-status.executing": "実行中"
  , "battle.cpu-status.completed": "完了"
  , "battle.cpu-status.limit-reached": "上限到達"
  , "battle.phase.play": "プレイフェーズ"
  , "battle.phase.automatic": "自動フェーズ"
  , "battle.phase.terminal": "対戦終了"
  , "battle.instruction.idle": "手札から使用可能なクリーチャーを選択してください。"
  , "battle.instruction.move-start": "強調表示された移動先を選択してください。"
  , "battle.instruction.move-continue": "移動上限まで移動を続けるか、最後の手順を戻してください。"
  , "battle.instruction.summon": "強調表示された召喚先を選択してください。"
  , "battle.instruction.effect": "対象を選択してください。選択が完了すると自動的に解決します。"
  , "battle.effect.no-target": "有効な対象がありません。"
  , "battle.interaction.pending": "プレイフェーズを終了する前に、選択を完了するか取り消してください。"
  , "battle.event.battle.started": "対戦を開始しました。"
  , "battle.event.first-player.decided": "先攻を決定しました。"
  , "battle.event.card.drawn": "カードを1枚引きました。"
  , "battle.event.card.overflowed": "手札上限のため、カードは墓地へ送られました。"
  , "battle.event.card.played": "カードを使用しました。"
  , "battle.event.creature.summoned": "クリーチャーを召喚しました。"
  , "battle.event.creature.moved": "クリーチャーを移動しました。"
  , "battle.event.spell.resolved": "カード効果を解決しました。"
  , "battle.event.effect.fizzled": "カード効果は解決されませんでした。"
  , "battle.event.effect.partially-resolved": "カード効果を一部解決しました。"
  , "battle.event.resonance.changed": "共鳴が変化しました。"
  , "battle.event.resonance.effect-resolved": "共鳴効果を解決しました。"
  , "battle.event.phase.ended": "プレイフェーズを終了しました。"
  , "battle.event.standby.resolved": "PPを回復しました。"
  , "battle.event.attack.phase-started": "攻撃フェーズを開始しました。"
  , "battle.event.attack.attacker-started": "クリーチャーが攻撃を開始しました。"
  , "battle.event.attack.attacker-skipped": "クリーチャーは攻撃できませんでした。"
  , "battle.event.attack.targeted": "攻撃対象を選択しました。"
  , "battle.event.attack.target-skipped": "攻撃対象をスキップしました。"
  , "battle.event.creature.damaged": "クリーチャーにダメージを与えました。"
  , "battle.event.creature.destroyed": "クリーチャーを破壊しました。"
  , "battle.event.base.damaged": "拠点にダメージを与えました。"
  , "battle.event.base.captured": "拠点を制圧しました。"
  , "battle.event.attack.phase-ended": "攻撃フェーズを終了しました。"
  , "battle.event.deck-out.occurred": "デッキ切れでカードを引けませんでした。"
  , "battle.event.cpu.processing-limit-reached": "CPUの処理上限に達しました。"
  , "battle.event.battle.ended": "対戦が終了しました。"
};

type UiTextKey = keyof typeof JAPANESE;
type TranslationCatalog = Readonly<Record<UiTextKey, string>>;

const ENGLISH: TranslationCatalog = {
  "menu.subtitle": "Original digital card game prototype",
  "menu.online-battle": "Online Battle",
  "menu.cpu-battle": "CPU Battle",
  "menu.deck-building": "Deck Building",
  "menu.online-battle.description": "Find an opponent for an online battle.",
  "menu.cpu-battle.description": "Play a local CPU match after battle rules arrive.",
  "menu.deck-building.description": "Prepare and tune local decks after deck storage arrives.",
  "menu.available-later": "Available in a later unit of work.",
  "menu.catalog-loading": "Catalog loading",
  "loading.catalog": "Loading catalog",
  "loading.destination": "Opening destination",
  "battle.board": "Board",
  "battle.column": "Column",
  "battle.row": "row",
  "battle.normal-square": "Normal square",
  "battle.cpu-base": "CPU Base",
  "battle.player-base": "Player Base",
  "battle.neutral-base": "Neutral Base",
  "battle.health": "HP",
  "battle.attack": "ATK",
  "battle.cost": "Cost",
  "battle.selected-summon": "selected summon destination",
  "battle.available-destination": "available destination",
  "battle.movement-origin": "movement origin",
  "battle.movement-path": "movement path steps",
  "battle.provisional-position": "provisional creature position",
  "battle.occupied-by": "occupied by",
  "battle.controlled-by": "controlled by",
  "battle.player-controlled": "Player controlled",
  "battle.cpu-controlled": "CPU controlled",
  "battle.unclaimed": "Unclaimed",
  "battle.unknown": "Unknown",
  "battle.card-unavailable": "Card data is unavailable.",
  "battle.resonance.inactive": "Water resonance is not active in this lane.",
  "battle.resonance.already-used": "Water resonance was already used in this lane this turn.",
  "battle.resonance.no-target": "There is no water resonance target in this lane.",
  "battle.resonance.unknown": "The action could not be completed."
  , "battle.terminal": "The battle has already ended."
  , "battle.phase.invalid": "Cards can be used only during a play phase."
  , "battle.side.inactive": "It is not your turn."
  , "battle.resource.pp-insufficient": "Not enough PP."
  , "battle.summon.no-destination": "No empty legal summon square is available."
  , "battle.effect.unsupported": "This card effect cannot be executed."
  , "battle.card.not-found": "The selected card no longer exists."
  , "battle.card.owner-invalid": "The selected card is not in your hand."
  , "battle.card.zone-invalid": "The selected card is not in hand."
  , "battle.card.type-invalid": "This card cannot be summoned."
  , "battle.status": "Status"
  , "battle.status.available": "Available"
  , "battle.status.unavailable": "Unavailable"
  , "battle.result.victory": "Victory"
  , "battle.result.defeat": "Defeat"
  , "battle.result.reason": "Reason"
  , "battle.result.turn": "Turn"
  , "battle.result.rematch": "Rematch"
  , "battle.result.return": "Return"
  , "battle.result.base-destroyed": "Enemy base destroyed"
  , "battle.result.neutral-bases-controlled": "All neutral bases controlled"
  , "battle.result.deck-out": "Opponent could not draw"
  , "battle.result.quit": "Opponent retired"
  , "battle.result.quit-self": "You retired"
  , "deck.menu": "Menu"
  , "deck.title": "Deck Building"
  , "deck.untitled": "Untitled Deck"
  , "deck.unsaved": "Unsaved"
  , "deck.saved": "Saved"
  , "deck.save": "Save"
  , "deck.saved-decks": "Saved Decks"
  , "deck.new": "New Deck"
  , "deck.limit-reached": "Local deck limit reached."
  , "deck.none-saved": "No saved decks yet."
  , "deck.cards": "Cards"
  , "deck.contents": "Contents"
  , "deck.add-cards": "Add cards from the list."
  , "deck.add": "Add"
  , "deck.auto-build": "Auto-complete to 40"
  , "deck.remove": "Remove"
  , "deck.deck": "Deck"
  , "deck.name": "Name"
  , "deck.battle-ready": "Battle-ready"
  , "deck.draft": "Draft"
  , "deck.delete-deck": "Delete Deck"
  , "deck.stats": "Stats"
  , "deck.loading": "Loading deck data"
  , "deck.close": "Close"
  , "deck.delete": "Delete"
  , "deck.cancel": "Cancel"
  , "deck.discard": "Discard"
  , "deck.unsaved-changes": "Unsaved Changes"
  , "deck.unsaved-message": "Choose how to handle the current deck before leaving it."
  , "deck.delete-message": "This saved deck will be removed from this browser."
  , "deck.return-menu": "Return to Menu"
  , "deck.search": "Search"
  , "deck.type": "Type"
  , "deck.attribute": "Attribute"
  , "deck.cost": "Cost"
  , "deck.all": "All"
  , "deck.name.required": "Deck name is required."
  , "deck.sort": "Sort"
  , "deck.sort.name": "Name"
  , "deck.sort.cost-asc": "Cost up"
  , "deck.sort.cost-desc": "Cost down"
  , "deck.sort.type": "Type"
  , "deck.sort.attribute": "Attribute"
  , "card.artwork-unavailable": "artwork unavailable"
  , "deck.reset": "Reset"
  , "error.generic": "Something went wrong. Please try again."
  , "battle.turn": "Turn"
  , "battle.player": "Player"
  , "battle.hand": "Hand"
  , "battle.deck": "Deck"
  , "battle.bases": "Bases"
  , "battle.resonance": "Resonance"
  , "battle.attribute": "Attribute"
  , "battle.resonance-effects": "Resonance effects"
  , "battle.quit": "Retire"
  , "battle.menu": "Menu"
  , "battle.log": "Battle log"
  , "battle.log.effect-source": "Card effect"
  , "battle.phase-control": "Phase control"
  , "battle.end-play-phase": "End Play Phase"
  , "battle.summon": "Summon creature"
  , "battle.move": "Move creature"
  , "battle.choose-summon-target": "Choose summon target"
  , "battle.choose-spell-target": "Choose spell target"
  , "battle.cancel-summon": "Cancel Summon"
  , "battle.cancel-move": "Cancel Move"
  , "battle.cancel-spell": "Cancel Spell"
  , "battle.undo-step": "Undo Step"
  , "battle.select": "Select"
  , "battle.selected": "Selected"
  , "battle.selected-creature": "Selected creature"
  , "battle.movement": "Movement"
  , "battle.no-cards-in-hand": "No cards in hand."
  , "battle.preparation": "Prepare Battle"
  , "battle.back": "Back"
  , "battle.player-deck": "Player deck"
  , "battle.cpu-deck": "CPU deck"
  , "battle.first-player": "First player"
  , "battle.random": "Random"
  , "battle.player-first": "Player first"
  , "battle.player-second": "Player second"
  , "battle.start": "Start"
  , "battle.start-battle": "Start Battle"
  , "battle.loading": "Loading..."
  , "battle.select-deck": "Select deck"
  , "battle.not-ready": "not ready"
  , "battle.preparation.loading": "Battle setup is loading."
  , "battle.preparation.create-ready-deck": "Create at least one battle-ready 40-card deck first."
  , "battle.preparation.select-decks": "Select player and CPU decks."
  , "battle.preparation.both-ready": "Both selected decks must be battle-ready."
  , "battle.preparation.select-first": "Select battle decks first."
  , "battle.preparation.start-failed": "Battle could not start."
  , "online.kicker": "Online Battle"
  , "online.title": "Battle Setup & Matching"
  , "online.display-name": "Display name"
  , "online.display-name.help": "Your display name is shown to your opponent. Duplicate names are allowed."
  , "online.passphrase": "Passphrase (optional)"
  , "online.random-match": "Random match: find an opponent who has not set a passphrase."
  , "online.passphrase-match": "Passphrase match: find only an opponent with the same passphrase."
  , "online.deck": "Battle deck"
  , "online.deck.change": "Change"
  , "online.deck.select": "Select battle deck"
  , "online.deck.none": "Select a battle-ready deck to use."
  , "online.deck.ready": "Battle-ready"
  , "online.deck.not-ready": "Cannot be used"
  , "online.deck.cards": "cards"
  , "online.deck.not-ready.card-count": "This deck does not contain exactly 40 cards."
  , "online.deck.loading": "Loading saved decks…"
  , "online.deck.load-failed": "Saved decks could not be loaded."
  , "online.deck.no-saved": "No saved decks are available."
  , "online.status": "Status"
  , "online.status.ready": "Ready to start matching."
  , "online.status.name-required": "Enter a display name."
  , "online.status.deck-required": "Select a battle-ready deck."
  , "online.status.matching": "Looking for an opponent."
  , "online.connection": "Connection"
  , "online.connection.ready": "Ready to send a match request."
  , "online.match.start": "Start matching"
  , "online.match.failed": "Matching could not be started. Please try again."
  , "online.connection.config-error": "Check the matching service connection settings."
  , "battle.cpu-status.idle": "Idle"
  , "battle.cpu-status.thinking": "Thinking"
  , "battle.cpu-status.executing": "Executing"
  , "battle.cpu-status.completed": "Completed"
  , "battle.cpu-status.limit-reached": "Limit reached"
  , "battle.phase.play": "Play phase"
  , "battle.phase.automatic": "Automatic phase"
  , "battle.phase.terminal": "Battle complete"
  , "battle.instruction.idle": "Select an available creature from your hand."
  , "battle.instruction.move-start": "Choose a highlighted movement destination."
  , "battle.instruction.move-continue": "Continue moving until the movement limit is reached, or undo the last step."
  , "battle.instruction.summon": "Choose a highlighted summon destination."
  , "battle.instruction.effect": "Select target(s). The action resolves automatically when complete."
  , "battle.effect.no-target": "No legal target is available."
  , "battle.interaction.pending": "Complete the pending selection or cancel it before ending the play phase."
  , "battle.event.battle.started": "Battle started."
  , "battle.event.first-player.decided": "First player decided."
  , "battle.event.card.drawn": "drew a card."
  , "battle.event.card.overflowed": "reached the hand limit; the card went to graveyard."
  , "battle.event.card.played": "played a card."
  , "battle.event.creature.summoned": "summoned a creature."
  , "battle.event.creature.moved": "moved a creature."
  , "battle.event.spell.resolved": "resolved a card effect."
  , "battle.event.effect.fizzled": "could not resolve a card effect."
  , "battle.event.effect.partially-resolved": "partially resolved a card effect."
  , "battle.event.resonance.changed": "resonance changed."
  , "battle.event.resonance.effect-resolved": "resolved a resonance effect."
  , "battle.event.phase.ended": "ended the play phase."
  , "battle.event.standby.resolved": "recovered PP."
  , "battle.event.attack.phase-started": "started the attack phase."
  , "battle.event.attack.attacker-started": "started an attack."
  , "battle.event.attack.attacker-skipped": "could not attack."
  , "battle.event.attack.targeted": "selected an attack target."
  , "battle.event.attack.target-skipped": "skipped an attack target."
  , "battle.event.creature.damaged": "damaged a creature."
  , "battle.event.creature.destroyed": "destroyed a creature."
  , "battle.event.base.damaged": "damaged a base."
  , "battle.event.base.captured": "captured a base."
  , "battle.event.attack.phase-ended": "ended the attack phase."
  , "battle.event.deck-out.occurred": "could not draw from an empty deck."
  , "battle.event.cpu.processing-limit-reached": "CPU processing limit reached."
  , "battle.event.battle.ended": "Battle ended."
};

const JAPANESE_CARD_TEXT: Readonly<Record<string, { readonly name: string; readonly effectText: string }>> = {
  "AK-001": { name: "火種のリクルート", effectText: "なし" },
  "AK-002": { name: "ファイアボルト", effectText: "敵クリーチャーまたは攻撃可能な拠点1つを選択する。その対象に2ダメージを与える。" },
  "AK-003": { name: "スパーク・ランサー", effectText: "召喚時：敵クリーチャーまたは攻撃可能な拠点1つを選択する。その対象に1ダメージを与える。" },
  "AK-004": { name: "炎核のバーサーカー", effectText: "このクリーチャーがいるレーンで自分が火共鳴しているなら、このクリーチャーの攻撃力を+2する。" },
  "AK-005": { name: "フレイムバースト", effectText: "敵クリーチャーまたは攻撃可能な拠点1つを選択する。その対象に4ダメージを与える。" },
  "AK-006": { name: "ブレイズ・コマンダー", effectText: "召喚時：他の味方クリーチャー1体を選択する。そのクリーチャーの攻撃力を+2する。" },
  "AK-007": { name: "爆炎のメイジ", effectText: "召喚時：敵クリーチャーまたは攻撃可能な拠点1つを選択する。その対象に3ダメージを与える。" },
  "AK-008": { name: "烈火の号令", effectText: "このターン、レーンを1つ選択する。そのレーン上のすべての味方クリーチャーの攻撃力を+2する。" },
  "AK-009": { name: "紅蓮旗のキャプテン", effectText: "このクリーチャーが場にいる限り、同じレーン上の他のすべての味方クリーチャーの攻撃力を+1する。" },
  "AK-010": { name: "ブレイズフェニックス", effectText: "破壊時：このクリーチャーが破壊される直前にいたレーン上のすべての敵クリーチャーと攻撃可能な拠点に2ダメージを与える。" },
  "AK-011": { name: "ボルカニック・レイン", effectText: "レーンを1つ選択する。そのレーン上のすべての敵クリーチャーと攻撃可能な拠点に5ダメージを与える。" },
  "AK-012": { name: "獄炎竜ヴァルガス", effectText: "召喚時：敵クリーチャーまたは攻撃可能な拠点1つを選択する。その対象に7ダメージを与える。この効果で敵クリーチャーを破壊したなら、そのクリーチャーと同じレーン上の他のすべての敵クリーチャーに3ダメージを与える。" },
  "AK-013": { name: "雫のシーカー", effectText: "このクリーチャーは1ターンに最大2マス移動できる。" },
  "AK-014": { name: "アクア・ガード", effectText: "なし" },
  "AK-015": { name: "ウォーターステップ", effectText: "このターン、味方クリーチャー1体を選択する。そのクリーチャーの移動力を+1する。カードを1枚引く。" },
  "AK-016": { name: "ブルーフィンの学究", effectText: "召喚時：カードを1枚引く。" },
  "AK-017": { name: "ディープ・リサーチ", effectText: "カードを2枚引く。" },
  "AK-018": { name: "潮路のダンサー", effectText: "召喚時：他の味方クリーチャー1体を選択する。そのクリーチャーの周囲8マスにある空いている通常マスを1つ選択する。そのクリーチャーを選択したマスへ移動させる。" },
  "AK-019": { name: "フロウ・コントロール", effectText: "クリーチャー1体を選択する。そのクリーチャーと同じレーン上の空いている通常マスを1つ選択する。そのクリーチャーを選択したマスへ移動させる。" },
  "AK-020": { name: "バブル・ジャグラー", effectText: "召喚時：同じレーン上の敵クリーチャー1体を選択する。そのクリーチャーを所有者の手札に戻す。" },
  "AK-021": { name: "蒼潮のナビゲーター", effectText: "このクリーチャーが場にいる限り、同じレーン上の他のすべての味方クリーチャーの移動力を+1する。" },
  "AK-022": { name: "アビサル・セージ", effectText: "このクリーチャーは1ターンに最大2マス移動できる。このクリーチャーが移動したとき、各ターンに一度、カードを1枚引く。" },
  "AK-023": { name: "スティル・タイド", effectText: "次の自分のターン開始時まで、すべての敵クリーチャーの移動力を0にする。カードを3枚引く。" },
  "AK-024": { name: "海嘯竜リヴァイアサン", effectText: "召喚時：このクリーチャーと同じレーン上の他のすべてのクリーチャーを所有者の手札に戻す。" },
  "AK-025": { name: "ゲイルホーンの戦士", effectText: "自分の最大PPが5以上なら、このクリーチャーを+1/+1する。" },
  "AK-026": { name: "ウィンド・コンパス", effectText: "自分のデッキからランダムなクリーチャーカード1枚を手札に加える。" },
  "AK-027": { name: "グロウス・ドルイド", effectText: "召喚時：自分の最大PPを1増やす。" },
  "AK-028": { name: "ブリーズ・スプライト", effectText: "自分が風共鳴しているレーンがあるなら、このカードのコストは1になる。" },
  "AK-029": { name: "エメラルド・サイクル", effectText: "自分の最大PPを1増やす。自分の最大PPが7以上なら、カードを1枚引く。" },
  "AK-030": { name: "クラウド・ビースト", effectText: "自分の最大PPが7以上なら、このクリーチャーを+2/+2する。" },
  "AK-031": { name: "コール・オブ・タイタン", effectText: "自分のデッキから元のコストが8以上のランダムなクリーチャーカード1枚を手札に加える。そのカードのコストを3減らす。" },
  "AK-032": { name: "ストーム・シェパード", effectText: "召喚時：自分の最大PPが8以上なら、このクリーチャーと同じレーン上の他のすべての味方クリーチャーを+2/+2する。" },
  "AK-033": { name: "テンペスト・アーキテクト", effectText: "このクリーチャーが場にいる限り、自分の手札のすべてのクリーチャーカードのコストを1減らす。" },
  "AK-034": { name: "嵐冠のグリフォン", effectText: "召喚時：自分の最大PPが10以上なら、自分のデッキから元のコストが4以下のランダムなクリーチャーカード1枚を手札に加える。そのカードのコストを0にする。" },
  "AK-035": { name: "天空のコロッサス", effectText: "なし" },
  "AK-036": { name: "天嵐巨神アネモス", effectText: "このカードのコストは、自分の風共鳴しているレーン1つにつき3減る。" },
  "AK-037": { name: "ヒーリング・レイ", effectText: "味方クリーチャーまたは自分の拠点1つを選択する。その対象の体力を3回復する。" },
  "AK-038": { name: "ルミナス・サモナー", effectText: "召喚時：このクリーチャーの周囲8マスにある空いている通常マスを1つ選択する。そのマスに光属性1/1/3の「ルミナス・ウォール」トークンを1体出す。" },
  "AK-039": { name: "セイクリッド・シールド", effectText: "味方クリーチャー1体を選択する。そのクリーチャーを+0/+4する。" },
  "AK-040": { name: "ルミナス・ガード", effectText: "なし" },
  "AK-041": { name: "ホーリー・サイレンス", effectText: "敵クリーチャー1体を選択する。そのクリーチャーの効果を無効にする。" },
  "AK-042": { name: "光壁のアーキテクト", effectText: "召喚時：このクリーチャーと同じレーン上の空いている通常マスを1つ選択する。そのマスに光属性1/1/3の「ルミナス・ウォール」トークンを1体出す。" },
  "AK-043": { name: "シャイニング・キャプテン", effectText: "このクリーチャーが場にいる限り、同じレーン上のすべての味方トークンを+1/+2する。" },
  "AK-044": { name: "フォートレス・ライン", effectText: "レーンを1つ選択する。そのレーン上の空いている通常マスを3つ選択する。そのマスに光属性1/1/3の「ルミナス・ウォール」トークンを1体ずつ出す。すべての味方トークンを+0/+2する。" },
  "AK-045": { name: "静寂のインクイジター", effectText: "召喚時：このクリーチャーと同じレーン上のすべての敵クリーチャーの効果を無効にする。" },
  "AK-046": { name: "グローリアス・チャンピオン", effectText: "召喚時：このクリーチャーと同じレーン上の空いている通常マスを2つ選択する。そのマスに光属性1/1/3の「ルミナス・ウォール」トークンを1体ずつ出す。このクリーチャーが場にいる限り、味方トークン1体につき、このクリーチャーを+1/+1する。" },
  "AK-047": { name: "ディバイン・ドミニオン", effectText: "すべての敵クリーチャーの効果を無効にする。すべての味方クリーチャーを+1/+4する。" },
  "AK-048": { name: "光臨天使セラフィエル", effectText: "召喚時：このクリーチャーと同じレーン上の空いている通常マスを3つ選択する。そのマスに光属性1/1/3の「ルミナス・ウォール」トークンを1体ずつ出す。すべての味方トークンを+3/+3する。" },
  "AK-049": { name: "グレイヴ・スクワイア", effectText: "破壊時：カードを1枚引く。" },
  "AK-050": { name: "ソウル・トレード", effectText: "味方クリーチャー1体を選択する。そのクリーチャーを破壊する。この効果で破壊したなら、カードを2枚引く。" },
  "AK-051": { name: "ネクロ・アプレンティス", effectText: "破壊時：このクリーチャーが破壊されたマスの周囲8マスにあるランダムな空いている通常マスに、闇属性1/1/1の「冥影の残滓」トークンを1体出す。" },
  "AK-052": { name: "カースド・ブッチャー", effectText: "召喚時：他の味方クリーチャー1体を選択する。そのクリーチャーを破壊する。この効果で破壊したなら、このクリーチャーを+3/+3する。" },
  "AK-053": { name: "黒鉄のデュラハン", effectText: "なし" },
  "AK-054": { name: "グレイヴ・リコール", effectText: "自分の墓地のクリーチャーカード2枚を選択する。そのカードを手札に加える。" },
  "AK-055": { name: "デス・センテンス", effectText: "敵クリーチャー1体を選択する。そのクリーチャーを破壊する。" },
  "AK-056": { name: "魂喰らいのハーベスター", effectText: "他の味方クリーチャーが破壊されたとき、このクリーチャーを+1/+1する。" },
  "AK-057": { name: "ネクロマンサー・リリス", effectText: "召喚時：自分の墓地の元のコストが3以下のクリーチャーカード1枚を選択する。このクリーチャーの周囲8マスにある空いている通常マスを1つ選択する。そのカードを選択したマスに出す。" },
  "AK-058": { name: "アビス・リーパー", effectText: "破壊時：自分の墓地の元のコストが5以下のランダムなクリーチャーカード1枚を、このクリーチャーが破壊されたマスの周囲8マスにあるランダムな空いている通常マスに出す。" },
  "AK-059": { name: "リザレクション・ゲート", effectText: "自分の墓地の元のコストが5以下のクリーチャーカード2枚を選択する。空いている召喚可能マスを2つ選択する。そのカードを選択したマスに1枚ずつ出す。" },
  "AK-060": { name: "冥界王ノクティス", effectText: "召喚時：このクリーチャーと同じレーン上の他のすべてのクリーチャーを破壊する。この効果で破壊したクリーチャー1体につき、このクリーチャーを+1/+1する。" },
  "AK-T-001": { name: "ルミナス・ウォール", effectText: "なし" },
  "AK-T-002": { name: "冥影の残滓", effectText: "なし" }
};

/**
 * Rules retain their canonical Japanese text. This catalog is the English
 * presentation counterpart and must be used instead of the rule text.
 */
const ENGLISH_CARD_EFFECT_TEXT: Readonly<Record<string, string>> = {
  "AK-001": "No effect.",
  "AK-002": "Choose an enemy creature or attackable base. Deal 2 damage to it.",
  "AK-003": "On summon: Choose an enemy creature or attackable base. Deal 1 damage to it.",
  "AK-004": "If you have Fire resonance in this creature's lane, it gains +2 attack.",
  "AK-005": "Choose an enemy creature or attackable base. Deal 4 damage to it.",
  "AK-006": "On summon: Choose another allied creature. It gains +2 attack.",
  "AK-007": "On summon: Choose an enemy creature or attackable base. Deal 3 damage to it.",
  "AK-008": "Choose a lane. This turn, all allied creatures in that lane gain +2 attack.",
  "AK-009": "While this creature is on the board, all other allied creatures in its lane gain +1 attack.",
  "AK-010": "On destruction: Deal 2 damage to all enemy creatures and attackable bases in the lane this creature occupied immediately before it was destroyed.",
  "AK-011": "Choose a lane. Deal 5 damage to all enemy creatures and attackable bases in that lane.",
  "AK-012": "On summon: Choose an enemy creature or attackable base. Deal 7 damage to it. If this destroys an enemy creature, deal 3 damage to all other enemy creatures in that creature's lane.",
  "AK-013": "This creature can move up to 2 squares per turn.",
  "AK-014": "No effect.",
  "AK-015": "Choose an allied creature. This turn, it gains +1 movement. Draw a card.",
  "AK-016": "On summon: Draw a card.",
  "AK-017": "Draw 2 cards.",
  "AK-018": "On summon: Choose another allied creature. Choose an empty normal square among the 8 squares around it. Move that creature to the chosen square.",
  "AK-019": "Choose a creature. Choose an empty normal square in its lane. Move that creature to the chosen square.",
  "AK-020": "On summon: Choose an enemy creature in this creature's lane. Return it to its owner's hand.",
  "AK-021": "While this creature is on the board, all other allied creatures in its lane gain +1 movement.",
  "AK-022": "This creature can move up to 2 squares per turn. The first time it moves each turn, draw a card.",
  "AK-023": "Until the start of your next turn, set all enemy creatures' movement to 0. Draw 3 cards.",
  "AK-024": "On summon: Return all other creatures in this creature's lane to their owners' hands.",
  "AK-025": "If your maximum PP is 5 or more, this creature gains +1/+1.",
  "AK-026": "Add a random creature card from your deck to your hand.",
  "AK-027": "On summon: Increase your maximum PP by 1.",
  "AK-028": "If you have a lane with Wind resonance, this card costs 1.",
  "AK-029": "Increase your maximum PP by 1. If your maximum PP is 7 or more, draw a card.",
  "AK-030": "If your maximum PP is 7 or more, this creature gains +2/+2.",
  "AK-031": "Add a random creature card with original cost 8 or more from your deck to your hand. Reduce its cost by 3.",
  "AK-032": "On summon: If your maximum PP is 8 or more, all other allied creatures in this creature's lane gain +2/+2.",
  "AK-033": "While this creature is on the board, creature cards in your hand cost 1 less.",
  "AK-034": "On summon: If your maximum PP is 10 or more, add a random creature card with original cost 4 or less from your deck to your hand. Set its cost to 0.",
  "AK-035": "No effect.",
  "AK-036": "This card costs 3 less for each lane in which you have Wind resonance.",
  "AK-037": "Choose an allied creature or one of your bases. Restore 3 HP to it.",
  "AK-038": "On summon: Choose an empty normal square among the 8 squares around this creature. Summon a Light 1/1/3 Luminous Wall token there.",
  "AK-039": "Choose an allied creature. It gains +0/+4.",
  "AK-040": "No effect.",
  "AK-041": "Choose an enemy creature. Disable its effects.",
  "AK-042": "On summon: Choose an empty normal square in this creature's lane. Summon a Light 1/1/3 Luminous Wall token there.",
  "AK-043": "While this creature is on the board, all allied tokens in its lane gain +1/+2.",
  "AK-044": "Choose a lane. Choose 3 empty normal squares in that lane. Summon a Light 1/1/3 Luminous Wall token on each. All allied tokens gain +0/+2.",
  "AK-045": "On summon: Disable the effects of all enemy creatures in this creature's lane.",
  "AK-046": "On summon: Choose 2 empty normal squares in this creature's lane. Summon a Light 1/1/3 Luminous Wall token on each. While this creature is on the board, it gains +1/+1 for each allied token.",
  "AK-047": "Disable the effects of all enemy creatures. All allied creatures gain +1/+4.",
  "AK-048": "On summon: Choose 3 empty normal squares in this creature's lane. Summon a Light 1/1/3 Luminous Wall token on each. All allied tokens gain +3/+3.",
  "AK-049": "On destruction: Draw a card.",
  "AK-050": "Choose an allied creature. Destroy it. If it was destroyed this way, draw 2 cards.",
  "AK-051": "On destruction: Summon a Dark 1/1/1 Shade Remnant token on a random empty normal square among the 8 squares around the square this creature occupied.",
  "AK-052": "On summon: Choose another allied creature. Destroy it. If it was destroyed this way, this creature gains +3/+3.",
  "AK-053": "No effect.",
  "AK-054": "Choose 2 creature cards in your graveyard. Add them to your hand.",
  "AK-055": "Choose an enemy creature. Destroy it.",
  "AK-056": "Whenever another allied creature is destroyed, this creature gains +1/+1.",
  "AK-057": "On summon: Choose a creature card with original cost 3 or less in your graveyard. Choose an empty normal square among the 8 squares around this creature. Summon that card on the chosen square.",
  "AK-058": "On destruction: Summon a random creature card with original cost 5 or less from your graveyard on a random empty normal square among the 8 squares around the square this creature occupied.",
  "AK-059": "Choose 2 creature cards with original cost 5 or less in your graveyard. Choose 2 empty summonable squares. Summon one chosen card on each chosen square.",
  "AK-060": "On summon: Destroy all other creatures in this creature's lane. This creature gains +1/+1 for each creature destroyed this way.",
  "AK-T-001": "No effect.",
  "AK-T-002": "No effect."
};

const JAPANESE_TYPES: Readonly<Record<string, string>> = {
  creature: "クリーチャー",
  spell: "スペル",
  "creature-token": "クリーチャー（トークン）"
};

const JAPANESE_ATTRIBUTES: Readonly<Record<string, string>> = {
  fire: "火",
  water: "水",
  wind: "風",
  light: "光",
  dark: "闇"
};

export interface LocalizedCardPresentation {
  readonly name: string;
  readonly effectText: string;
  readonly type: string;
  readonly attribute: string;
}

/** Localizes display-only fields while retaining the catalog record for rules. */
export function localizeCardPresentation(
  card: Pick<CardMasterRecord, "id" | "name" | "effectText"> & { readonly type: string; readonly attribute: string },
  locale: UiLocale | undefined
): LocalizedCardPresentation {
  if (locale === "en") return {
    name: card.name,
    effectText: ENGLISH_CARD_EFFECT_TEXT[card.id] ?? "Effect text is unavailable.",
    type: card.type,
    attribute: card.attribute
  };

  const japanese = JAPANESE_CARD_TEXT[card.id];
  return {
    name: japanese?.name ?? `カード ${card.id}`,
    effectText: japanese?.effectText ?? "効果テキストは日本語版カード一覧を参照",
    type: JAPANESE_TYPES[card.type] ?? card.type,
    attribute: JAPANESE_ATTRIBUTES[card.attribute] ?? card.attribute
  };
}

/** Resolves a card-type enum only at the presentation boundary. */
export function localizeCardType(locale: UiLocale | undefined, type: string): string {
  return locale === "en" ? type : JAPANESE_TYPES[type] ?? type;
}

/** Resolves a card-attribute enum only at the presentation boundary. */
export function localizeCardAttribute(
  locale: UiLocale | undefined,
  attribute: string
): string {
  return locale === "en" ? attribute : JAPANESE_ATTRIBUTES[attribute] ?? attribute;
}

/** Japanese is the safe fallback for incomplete locale catalogs. */
/**
 * The only entry point for static UI copy. `UiTextKey` is inferred from the
 * Japanese catalog and English must provide every one of those keys.
 */
export function uiText(locale: UiLocale | undefined, key: UiTextKey): string {
  return (locale === "en" ? ENGLISH : JAPANESE)[key];
}

/** Battle screens historically treat an omitted locale as English; keep that API contract. */
export function battleText(locale: UiLocale | undefined, key: UiTextKey): string {
  return uiText(locale === "ja" ? "ja" : "en", key);
}

function uiTextOrFallback(locale: UiLocale | undefined, key: string, fallback: string): string {
  if (key in JAPANESE) return uiText(locale, key as UiTextKey);
  return fallback;
}

export function localizeMenuText(locale: UiLocale | undefined, text: string, kind: "title" | "subtitle" | "action" | "description" | "version" | "reason"): string {
  if (kind === "title" && text === "Project Ankake") return text;
  if (kind === "subtitle") return uiText(locale, "menu.subtitle");
  if (kind === "action") return text === "Online Battle" ? uiText(locale, "menu.online-battle") : text === "CPU Battle" ? uiText(locale, "menu.cpu-battle") : text === "Deck Building" ? uiText(locale, "menu.deck-building") : text;
  if (kind === "description") return text.startsWith("Match locally") ? uiText(locale, "menu.online-battle.description") : text.startsWith("Play a local CPU") ? uiText(locale, "menu.cpu-battle.description") : text.startsWith("Prepare and tune") ? uiText(locale, "menu.deck-building.description") : text;
  if (kind === "version") {
    const version = /^Catalog (.+)$/.exec(text)?.[1];
    return version ? (locale === "en" ? `Catalog ${version}` : `カタログ ${version}`) : uiText(locale, "menu.catalog-loading");
  }
  if (kind === "reason" && (text.startsWith("Available in a later") || text.startsWith("Coming in UOW"))) return uiText(locale, "menu.available-later");
  return text;
}

export function localizeLoadingLabel(locale: UiLocale | undefined, label: string): string {
  return label === "Opening destination" ? uiText(locale, "loading.destination") : uiText(locale, "loading.catalog");
}

export function localizeBattleReason(locale: UiLocale | undefined, reason: string): string {
  if (locale === undefined) return reason in JAPANESE ? uiText("en", reason as UiTextKey) : reason;
  if (reason in JAPANESE) return uiText(locale, reason as UiTextKey);
  const known: Readonly<Record<string, UiTextKey>> = {
    "Card data is unavailable.": "battle.card-unavailable",
    "No legal target is available for this summon effect.": "battle.effect.no-target",
    "Select a valid target before confirming.": "battle.effect.no-target",
    "Complete the pending selection or cancel it before ending the play phase.": "battle.interaction.pending",
    "Battle setup is loading.": "battle.preparation.loading",
    "Create at least one battle-ready 40-card deck first.": "battle.preparation.create-ready-deck",
    "Select player and CPU decks.": "battle.preparation.select-decks",
    "Both selected decks must be battle-ready.": "battle.preparation.both-ready",
    "Select battle decks first.": "battle.preparation.select-first",
    "Battle could not start.": "battle.preparation.start-failed"
  };
  return known[reason] ? uiText(locale, known[reason]) : locale === "ja" ? uiText(locale, "error.generic") : reason;
}

export function localizeDeckValidationIssue(locale: UiLocale | undefined, code: string, fallback: string): string {
  return code in JAPANESE
    ? uiText(locale, code as UiTextKey)
    : locale === "ja"
      ? uiText(locale, "error.generic")
      : fallback;
}

/** Keeps internal diagnostics from leaking an untranslated message into Japanese UI. */
export function localizeUserMessage(locale: UiLocale | undefined, message: string): string {
  return locale === "ja" ? localizeBattleReason(locale, message) : message;
}

/** Exhaustive on purpose: adding a domain event requires its display copy. */
const BATTLE_EVENT_KEYS: Readonly<Record<BattleEvent["type"], UiTextKey>> = {
  "battle.started": "battle.event.battle.started",
  "first-player.decided": "battle.event.first-player.decided",
  "card.drawn": "battle.event.card.drawn",
  "card.overflowed": "battle.event.card.overflowed",
  "card.played": "battle.event.card.played",
  "creature.summoned": "battle.event.creature.summoned",
  "creature.moved": "battle.event.creature.moved",
  "spell.resolved": "battle.event.spell.resolved",
  "effect.fizzled": "battle.event.effect.fizzled",
  "effect.partially-resolved": "battle.event.effect.partially-resolved",
  "resonance.changed": "battle.event.resonance.changed",
  "resonance.effect-resolved": "battle.event.resonance.effect-resolved",
  "phase.ended": "battle.event.phase.ended",
  "standby.resolved": "battle.event.standby.resolved",
  "attack.phase-started": "battle.event.attack.phase-started",
  "attack.attacker-started": "battle.event.attack.attacker-started",
  "attack.attacker-skipped": "battle.event.attack.attacker-skipped",
  "attack.targeted": "battle.event.attack.targeted",
  "attack.target-skipped": "battle.event.attack.target-skipped",
  "creature.damaged": "battle.event.creature.damaged",
  "creature.destroyed": "battle.event.creature.destroyed",
  "base.damaged": "battle.event.base.damaged",
  "base.captured": "battle.event.base.captured",
  "attack.phase-ended": "battle.event.attack.phase-ended",
  "deck-out.occurred": "battle.event.deck-out.occurred",
  "cpu.processing-limit-reached": "battle.event.cpu.processing-limit-reached",
  "battle.ended": "battle.event.battle.ended"
};

/** Localizes event and log entries without exposing their domain-owned English fallback messages. */
export function localizeBattleEvent(
  locale: UiLocale | undefined,
  entry: Pick<BattleEvent | BattleLogEntry, "type" | "side">
): string {
  const text = battleText(locale, BATTLE_EVENT_KEYS[entry.type]);
  if (!entry.side) return text;
  return locale !== "ja"
    ? `${localizeBattleSide(locale, entry.side)} ${text}`
    : `${localizeBattleSide(locale, entry.side)}：${text}`;
}

export function localizeBattleSide(locale: UiLocale | undefined, side: BattleSide): string {
  return side === "player" ? battleText(locale, "battle.player") : "CPU";
}

export function localizeBattleInstruction(
  locale: UiLocale | undefined,
  key: "idle" | "move-start" | "move-continue" | "summon" | "effect"
): string {
  return battleText(locale, `battle.instruction.${key}` as UiTextKey);
}

export function localizeBattleIssue(locale: UiLocale | undefined, code: string | undefined, fallback?: string): string {
  return code ? uiTextOrFallback(locale === undefined ? "en" : locale, code, fallback ?? battleText(locale, "battle.resonance.unknown")) : "";
}
