import { COMMAND_CATALOG } from '../../../game/commandCatalog';
import { PlayerProgress, resolveOwnershipStatus, traitName } from '../../../game/playerProgress';

interface IndexAppProps {
  progress: PlayerProgress;
}

export const IndexApp = ({ progress }: IndexAppProps) => {
  const owned = COMMAND_CATALOG.filter((command) => resolveOwnershipStatus(progress, command.id) === 'owned');
  const locked = COMMAND_CATALOG.filter((command) => resolveOwnershipStatus(progress, command.id) === 'locked');
  const missed = COMMAND_CATALOG.filter((command) => resolveOwnershipStatus(progress, command.id) === 'missed');

  return (
    <section className="index-app">
      <h2>Command Index</h2>
      <p>Owned: {owned.length} · Locked: {locked.length} · Missed: {missed.length}</p>

      <div className="index-app__group">
        <h3>Owned Commands</h3>
        {owned.map((command) => (
          <p key={command.id}>{command.id} — {command.description}</p>
        ))}
      </div>

      <div className="index-app__group">
        <h3>Trait Tagged</h3>
        {Object.entries(progress.commandTraits).flatMap(([commandId, traits]) =>
          traits.map((trait) => <p key={`${commandId}-${trait}`}>{traitName(commandId, trait)}</p>),
        )}
      </div>

      <div className="index-app__group">
        <h3>Locked</h3>
        {locked.map((command) => (
          <p key={command.id}>{command.id}</p>
        ))}
      </div>

      <div className="index-app__group">
        <h3>Missed</h3>
        {missed.map((command) => (
          <p key={command.id}>{command.id} (removed from market)</p>
        ))}
      </div>
    </section>
  );
};
