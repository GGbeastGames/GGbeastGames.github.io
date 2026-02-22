import { MarketState, MarketSymbol } from '../../../game/playerProgress';

interface StockMarketAppProps {
  wallet: number;
  market: MarketState;
  blockToolsUnlocked: boolean;
  onBuyShares: (symbol: MarketSymbol, shares: number) => void;
}

export const StockMarketApp = ({ wallet, market, blockToolsUnlocked, onBuyShares }: StockMarketAppProps) => {
  const now = Date.now();
  const inListingWindow = market.listingsWindowEndsAtMs > now;

  return (
    <section className="market-app">
      <h2>Live Exchange</h2>
      <p>
        Wallet: Ø{wallet} · Holdings Value: Ø{market.holdingsValue} · Net Valuation: Ø{market.totalValuation}
      </p>
      <p>
        Refresh @ {new Date(market.listingsRefreshAtMs || now).toLocaleTimeString()} · Listing window{' '}
        {inListingWindow ? 'OPEN' : 'CLOSED'}
      </p>

      {market.quotes.map((quote) => {
        const currentShares = market.holdings[quote.symbol] ?? 0;
        const disabled = !inListingWindow || wallet < quote.price;

        return (
          <article key={quote.symbol} className="market-app__item">
            <strong>
              {quote.symbol} · Ø{quote.price}
            </strong>
            <p>
              Trend: {quote.changePct >= 0 ? '+' : ''}
              {quote.changePct.toFixed(2)}% · owned {currentShares} share(s)
            </p>
            <button type="button" disabled={disabled} onClick={() => onBuyShares(quote.symbol, 1)}>
              Buy 1 share
            </button>
            <button type="button" disabled={disabled || wallet < quote.price * 5} onClick={() => onBuyShares(quote.symbol, 5)}>
              Buy 5 shares
            </button>
          </article>
        );
      })}

      <h3>Ownership History</h3>
      {market.ownershipHistory.slice(0, 8).map((entry) => (
        <p key={entry.id}>
          [{new Date(entry.createdAtMs).toLocaleTimeString()}] {entry.side.toUpperCase()} {entry.shares} {entry.symbol} @ Ø{entry.price}
        </p>
      ))}

      <h3>Block Management</h3>
      {blockToolsUnlocked ? (
        <p>Block manager unlocked. Routed to chain-aware listing controls.</p>
      ) : (
        <p>Purchase the Block Manager Utility in Black Market to unlock chain controls.</p>
      )}
    </section>
  );
};
