import { LUCK_CHARM_ITEMS, SHOP_ITEMS } from '../../../game/commandCatalog';
import { PlayerProgress } from '../../../game/playerProgress';

interface BlackMarketAppProps {
  progress: PlayerProgress;
  onBuy: (sku: string) => void;
  onCompleteLesson: (sku: string) => void;
  onBuyCharm: (sku: string) => void;
}

export const BlackMarketApp = ({ progress, onBuy, onCompleteLesson, onBuyCharm }: BlackMarketAppProps) => {
  return (
    <section className="market-app">
      <h2>Black Market</h2>
      <p>Wallet: Ø{progress.wallet} · Flux: ƒ{progress.flux}</p>
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

      <h3>Casino Store / Luck Charms</h3>
      {LUCK_CHARM_ITEMS.map((item) => {
        const activeSku = progress.casino.activeCharm?.sku;
        const disabled = progress.flux < item.fluxCost || Boolean(activeSku && activeSku !== item.sku);
        return (
          <article key={item.sku} className="market-app__item">
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <p>
              Cost: ƒ{item.fluxCost} · Boost {item.winBoostPct}% · Uses {item.maxUsesPerPurchase}
            </p>
            <button type="button" disabled={disabled} onClick={() => onBuyCharm(item.sku)}>
              {activeSku === item.sku ? 'Active' : 'Buy Charm'}
            </button>
          </article>
        );
      })}
    </section>
  );
};
