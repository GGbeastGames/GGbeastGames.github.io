import { useState } from 'react';
import { AdminState } from '../../game/admin';
import { BaseCommandId } from '../../game/terminal';

type AdminAppProps = {
  actor: string;
  admin: AdminState;
  onSetBanner: (text: string) => void;
  onToggleFeature: (key: 'chatOpen' | 'pollsEnabled') => void;
  onGrantCommand: (command: BaseCommandId, withTrait: boolean) => void;
  onAddShopItem: (command: BaseCommandId, limited: boolean) => void;
  onFlagPlayer: (alias: string, note: string) => void;
  onTempBanPlayer: (alias: string, hours: number) => void;
  onPermBanPlayer: (alias: string) => void;
};

export function AdminApp({ actor, admin, onSetBanner, onToggleFeature, onGrantCommand, onAddShopItem, onFlagPlayer, onTempBanPlayer, onPermBanPlayer }: AdminAppProps) {
  const [banner, setBanner] = useState(admin.globalBanner);
  const [playerAlias, setPlayerAlias] = useState('Guest Operator');
  const [note, setNote] = useState('watch this player');

  return (
    <div className="admin-app">
      <h4>Admin Control Tower</h4>
      <p>Logged in as: {actor}</p>

      <div className="admin-grid">
        <section>
          <h5>Global Alerts + Feature Toggles</h5>
          <label>
            Banner text
            <input value={banner} onChange={(event) => setBanner(event.target.value)} placeholder="maintenance in 10 minutes" />
          </label>
          <button type="button" onClick={() => onSetBanner(banner)}>Push Banner</button>
          <div className="actions-inline">
            <button type="button" onClick={() => onToggleFeature('chatOpen')}>Chat: {admin.featureToggles.chatOpen ? 'Open' : 'Closed'}</button>
            <button type="button" onClick={() => onToggleFeature('pollsEnabled')}>Polls: {admin.featureToggles.pollsEnabled ? 'On' : 'Off'}</button>
          </div>
        </section>

        <section>
          <h5>Grant Commands / Traits + Shop Control</h5>
          <div className="actions-inline">
            <button type="button" onClick={() => onGrantCommand('scan', false)}>Grant scan</button>
            <button type="button" onClick={() => onGrantCommand('spoof', true)}>Grant spoof + spring trait</button>
          </div>
          <div className="actions-inline">
            <button type="button" onClick={() => onAddShopItem('scan', false)}>Create shop item (scan)</button>
            <button type="button" onClick={() => onAddShopItem('spoof', true)}>Create limited shop item (spoof)</button>
          </div>
        </section>

        <section>
          <h5>Player Flags / Ban Tools</h5>
          <label>
            Alias
            <input value={playerAlias} onChange={(event) => setPlayerAlias(event.target.value)} />
          </label>
          <label>
            Note
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="actions-inline">
            <button type="button" onClick={() => onFlagPlayer(playerAlias, note)}>Flag Player</button>
            <button type="button" onClick={() => onTempBanPlayer(playerAlias, 24)}>Temp Ban 24h</button>
            <button type="button" onClick={() => onPermBanPlayer(playerAlias)}>Perm Ban</button>
          </div>
        </section>
      </div>

      <section>
        <h5>Immutable Audit Logs</h5>
        <ul>
          {admin.auditLogs.length === 0 ? (
            <li>No admin actions yet.</li>
          ) : (
            admin.auditLogs.slice(0, 12).map((log) => (
              <li key={log.id}>{new Date(log.ts).toLocaleTimeString()} · {log.actor} · {log.action} · {log.detail}</li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
