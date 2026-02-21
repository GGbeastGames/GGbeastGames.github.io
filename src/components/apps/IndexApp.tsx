import { useMemo, useState } from 'react';
import { BaseCommandId, baseCommandSpecs } from '../../game/terminal';
import { ProgressionState, ShopItem, TRAIT_VARIANT_SUFFIX, toCommandKey } from '../../game/progression';

type IndexAppProps = {
  progression: ProgressionState;
  catalog: ShopItem[];
};

export function IndexApp({ progression, catalog }: IndexAppProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'owned' | 'locked' | 'missed' | 'traits'>('all');

  const ownedKeys = useMemo(() => progression.ownedCommands.map((owned) => toCommandKey(owned.baseId, owned.trait)), [progression]);

  const allBaseCommands = useMemo(() => Object.keys(baseCommandSpecs) as BaseCommandId[], []);

  const lockedCommands = useMemo(
    () => allBaseCommands.filter((baseId) => !progression.ownedCommands.some((owned) => owned.baseId === baseId)),
    [allBaseCommands, progression]
  );

  const traitCommands = progression.ownedCommands.filter((command) => command.trait);

  const filteredOwned = ownedKeys.filter((key) => key.includes(query.toLowerCase()));

  return (
    <div className="index-app">
      <h4>Command Index</h4>
      <div className="index-controls">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search command key" />
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">All</option>
          <option value="owned">Owned</option>
          <option value="locked">Locked</option>
          <option value="missed">Missed limiteds</option>
          <option value="traits">Traits</option>
        </select>
      </div>

      {(filter === 'all' || filter === 'owned') && (
        <section>
          <h5>Owned Commands</h5>
          {filteredOwned.length === 0 ? <p className="muted">No owned commands match search.</p> : null}
          <ul>
            {filteredOwned.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </section>
      )}

      {(filter === 'all' || filter === 'locked') && (
        <section>
          <h5>Locked Commands</h5>
          <ul>
            {lockedCommands.map((baseId) => (
              <li key={baseId}>{baseId}</li>
            ))}
          </ul>
        </section>
      )}

      {(filter === 'all' || filter === 'missed') && (
        <section>
          <h5>Missed Limiteds</h5>
          <ul>
            {progression.missedLimited.map((item) => (
              <li key={item.itemId}>
                {item.baseId} — missed on {new Date(item.expiredAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(filter === 'all' || filter === 'traits') && (
        <section>
          <h5>Trait Commands</h5>
          <ul>
            {traitCommands.map((item) => (
              <li key={item.instanceId}>
                {toCommandKey(item.baseId, item.trait)} · {item.trait} ({TRAIT_VARIANT_SUFFIX[item.trait!]})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h5>Catalog Visibility</h5>
        <p className="muted">Removing an item from Black Market does not remove owned commands from player inventory.</p>
        <ul>
          {catalog.map((item) => (
            <li key={item.id}>
              {item.id}: {item.removedAt ? 'removed from shop' : 'active'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
