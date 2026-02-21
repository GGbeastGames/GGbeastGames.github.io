import { useState } from 'react';
import { SeasonState, cosmeticCatalog } from '../../game/season';

type SeasonAppProps = {
  season: SeasonState;
  balance: number;
  alias: string;
  onBuyCosmetic: (itemId: string, price: number) => void;
  onApplyTheme: (itemId: string) => void;
  onCreateMentorTicket: () => void;
  onMatchMentor: (ticketId: string) => void;
};

export function SeasonApp({ season, balance, alias, onBuyCosmetic, onApplyTheme, onCreateMentorTicket, onMatchMentor }: SeasonAppProps) {
  const [selectedTicket, setSelectedTicket] = useState('');

  return (
    <div className="season-app">
      <h4>Season Hub // Cosmetics · Story · Mentor</h4>
      <p>Balance: {balance} Ø · Active theme: {season.activeTheme}</p>

      <div className="season-grid">
        <section>
          <h5>Terminal Theme Marketplace</h5>
          {cosmeticCatalog.map((item) => (
            <article key={item.id}>
              <p>{item.name} ({item.type}) · {item.price} Ø</p>
              <div className="actions-inline">
                <button type="button" onClick={() => onBuyCosmetic(item.id, item.price)} disabled={balance < item.price}>Buy</button>
                <button type="button" onClick={() => onApplyTheme(item.id)} disabled={!season.ownedCosmetics.includes(item.id)}>Apply</button>
              </div>
            </article>
          ))}
        </section>

        <section>
          <h5>Monthly Story Arcs</h5>
          <ul>
            {season.storyEvents.map((event) => (
              <li key={event.id}><strong>{event.title}</strong> — {event.description}</li>
            ))}
          </ul>
        </section>

        <section>
          <h5>Mentor System</h5>
          <button type="button" onClick={onCreateMentorTicket}>Request Mentor</button>
          <ul>
            {season.mentorTickets.length === 0 ? <li>No tickets yet.</li> : season.mentorTickets.map((ticket) => (
              <li key={ticket.id}>{ticket.studentAlias} → {ticket.mentorAlias ?? 'Unassigned'} ({ticket.status})</li>
            ))}
          </ul>
          <label>
            Match ticket id
            <input value={selectedTicket} onChange={(event) => setSelectedTicket(event.target.value)} placeholder="paste ticket id" />
          </label>
          <button type="button" onClick={() => onMatchMentor(selectedTicket)} disabled={!selectedTicket}>Match me as mentor ({alias})</button>
        </section>
      </div>
    </div>
  );
}
