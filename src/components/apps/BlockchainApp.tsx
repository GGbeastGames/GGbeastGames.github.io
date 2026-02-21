import { useState } from 'react';
import { BlockchainState, CompanyTicker } from '../../game/blockchain';

type BlockchainAppProps = {
  blockchain: BlockchainState;
  balance: number;
  onBuy: (ticker: CompanyTicker, amount: number) => void;
  onSell: (ticker: CompanyTicker, amount: number) => void;
  onUpgradeSecurity: (ticker: CompanyTicker) => void;
};

const tickers: CompanyTicker[] = ['VALK', 'GLYPH', 'ZERO', 'PULSE', 'TITAN'];

export function BlockchainApp({ blockchain, balance, onBuy, onSell, onUpgradeSecurity }: BlockchainAppProps) {
  const [amount, setAmount] = useState(1);

  return (
    <div className="blockchain-app">
      <h4>Blockchain Market</h4>
      <p>Balance: {balance} Ø · Market refresh every {(blockchain.refreshEveryMs / 1000).toFixed(0)}s</p>

      <div className="blockchain-grid">
        {tickers.map((ticker) => {
          const company = blockchain.companies[ticker];
          const own = blockchain.ownership[ticker];
          return (
            <article key={ticker}>
              <h5>{company.name} (${ticker})</h5>
              <p>Share price: {company.price} Ø</p>
              <p>Trend: {company.trend}</p>
              <p>Owned shares: {own.shares}</p>
              <p>Security level: {own.securityLevel}</p>
              <div className="actions-inline">
                <button type="button" onClick={() => onBuy(ticker, amount)}>Buy</button>
                <button type="button" onClick={() => onSell(ticker, amount)}>Sell</button>
                <button type="button" onClick={() => onUpgradeSecurity(ticker)}>Upgrade Security</button>
              </div>
            </article>
          );
        })}
      </div>

      <label>
        Trade Amount (1-100)
        <input type="number" min={1} max={100} value={amount} onChange={(event) => setAmount(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} />
      </label>
    </div>
  );
}
