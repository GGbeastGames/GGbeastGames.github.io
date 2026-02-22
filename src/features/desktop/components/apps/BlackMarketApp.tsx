import { SHOP_ITEMS } from '../../../game/commandCatalog';
import { PlayerProgress } from '../../../game/playerProgress';

interface BlackMarketAppProps {
  progress: PlayerProgress;
  onBuy: (sku: string) => void;
  onCompleteLesson: (sku: string) => void;
}

export const BlackMarketApp = ({ progress, onBuy, onCompleteLesson }: BlackMarketAppProps) => {
  return (
    <section className="market-app">
      <h2>Black Market</h2>
      <p>Wallet: Ø{progress.wallet}</p>
      {SHOP_ITEMS.filter((item) => !item.removedFromShop).map((item) => {
        const owned = progress.entitlements.includes(item.sku);
        const disabled = owned || progress.wallet < item.cost;
        return (
          <article key={item.sku} className="market-app__item">
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <p>Cost: Ø{item.cost}</p>
            <button type="button" disabled={disabled} onClick={() => onBuy(item.sku)}>
              {owned ? 'Owned' : 'Buy'}
            </button>
            {item.type === 'lesson' && owned ? (
              <button type="button" onClick={() => onCompleteLesson(item.sku)}>
                Complete Lesson
              </button>
            ) : null}
          </article>
        );
      })}
    </section>
  );
};
