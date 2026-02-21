import { PlayerState } from '../../game/terminal';
import { ProgressionState, ShopItem, formatShopItemName } from '../../game/progression';

type BlackMarketAppProps = {
  player: PlayerState;
  progression: ProgressionState;
  inventory: ShopItem[];
  onBuyItem: (itemId: string) => void;
  onCompleteLesson: (itemId: string) => void;
};

export function BlackMarketApp({ player, progression, inventory, onBuyItem, onCompleteLesson }: BlackMarketAppProps) {
  return (
    <div className="market-app">
      <div className="market-header-row">
        <h4>Black Market</h4>
        <p>Balance: {player.nops} Ø</p>
      </div>
      <p className="muted">Buy command lessons/software, then complete the lesson to unlock runnable command variants.</p>

      <h5>Limited-Time Slots</h5>
      <div className="market-grid">
        {inventory.map((item) => (
          <article key={item.id}>
            <h6>{formatShopItemName(item)}</h6>
            <p>Slot #{item.slot}</p>
            <p>Price: {item.price} Ø</p>
            <p>{item.limitedUntil ? `Limited ended ${new Date(item.limitedUntil).toLocaleDateString()}` : 'Always available'}</p>
            <button type="button" onClick={() => onBuyItem(item.id)} disabled={player.nops < item.price}>
              Buy
            </button>
          </article>
        ))}
      </div>

      <h5>Lesson Queue</h5>
      <div className="market-grid">
        {progression.pendingLessons.length === 0 ? <p className="muted">No pending lessons.</p> : null}
        {progression.pendingLessons.map((item) => (
          <article key={item.id}>
            <h6>{formatShopItemName(item)}</h6>
            <p>Complete to unlock command in Index.</p>
            <ol>
              {item.lessonSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <button type="button" onClick={() => onCompleteLesson(item.id)}>
              Finish Lesson + Unlock
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
