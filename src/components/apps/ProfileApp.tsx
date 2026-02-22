import { useMemo } from 'react';
import { PlayerState } from '../../game/terminal';
import { MissionTemplate, RetentionState, missionTemplates } from '../../game/retention';

type LeaderboardEntry = {
  label: string;
  value: number;
};

type ProfileAppProps = {
  identity: string;
  player: PlayerState;
  retention: RetentionState;
  onClaimMission: (missionId: string) => void;
  onClaimDailyStreak: () => void;
};

function xpToNextLevel(level: number): number {
  return 80 + level * 35;
}

function getMissionTemplate(id: string): MissionTemplate | undefined {
  return missionTemplates.find((mission) => mission.id === id);
}

export function ProfileApp({ identity, player, retention, onClaimMission, onClaimDailyStreak }: ProfileAppProps) {
  const xpNeeded = xpToNextLevel(player.level);
  const xpPercent = Math.min(100, Math.round((player.xp / xpNeeded) * 100));

  const richestBoard: LeaderboardEntry[] = [
    { label: identity, value: player.nops },
    { label: 'ShadowNode', value: Math.max(0, player.nops - 18) },
    { label: 'ProxyDrift', value: Math.max(0, player.nops - 32) }
  ];

  const levelBoard: LeaderboardEntry[] = [
    { label: identity, value: player.level },
    { label: 'GhostRelay', value: Math.max(1, player.level - 1) },
    { label: 'ZeroLatency', value: Math.max(1, player.level - 2) }
  ];

  const masteryBoard = useMemo(
    () =>
      Object.entries(retention.commandMastery)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    [retention.commandMastery]
  );

  const today = new Date().toISOString().slice(0, 10);
  const dailyClaimed = retention.lastDailyClaimDay === today;

  return (
    <div className="profile-app">
      <div className="profile-hero">
        <div className="avatar-shell">
          {retention.profilePhotoUrl ? <img src={retention.profilePhotoUrl} alt="Profile" /> : <span>{identity[0]?.toUpperCase() ?? '?'}</span>}
        </div>
        <div>
          <h4>{identity}</h4>
          <p>Level {player.level} · Total XP {retention.xpTotal}</p>
          <div className="xp-bar">
            <div style={{ width: `${xpPercent}%` }} />
          </div>
          <small>
            XP {player.xp}/{xpNeeded}
          </small>
        </div>
      </div>

      <p className="muted">Profile avatars are local-only for now (Firebase Storage disabled).</p>

      <div className="profile-grid">
        <section>
          <h5>Daily/Weekly Missions</h5>
          <button type="button" onClick={onClaimDailyStreak} disabled={dailyClaimed}>
            {dailyClaimed ? 'Daily streak claimed' : `Claim streak reward (day ${retention.streakDays})`}
          </button>
          <ul>
            {retention.missions.map((mission) => {
              const template = getMissionTemplate(mission.missionId);
              if (!template) return null;
              return (
                <li key={mission.missionId}>
                  <strong>{template.title}</strong>
                  <p>{template.description}</p>
                  <p>
                    Progress {mission.progress}/{template.target} · Reward {template.rewardNops} Ø + {template.rewardXp} XP
                  </p>
                  <button type="button" onClick={() => onClaimMission(mission.missionId)} disabled={!mission.completed || !!mission.claimedAt}>
                    {mission.claimedAt ? 'Claimed' : 'Claim reward'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h5>Badge Shelf</h5>
          <ul>
            {retention.badges.length === 0 ? <li>No badges yet.</li> : retention.badges.map((badge) => <li key={badge}>{badge}</li>)}
          </ul>
          <h5>Achievements</h5>
          <ul>
            {retention.achievements.length === 0 ? (
              <li>Run missions and streaks to unlock achievements.</li>
            ) : (
              retention.achievements.map((achievement) => <li key={achievement.id}>{achievement.title}</li>)
            )}
          </ul>
        </section>

        <section>
          <h5>Leaderboards</h5>
          <p>Richest</p>
          <ol>
            {richestBoard.map((entry) => (
              <li key={entry.label}>
                {entry.label}: {entry.value} Ø
              </li>
            ))}
          </ol>
          <p>Highest level</p>
          <ol>
            {levelBoard.map((entry) => (
              <li key={entry.label}>
                {entry.label}: lvl {entry.value}
              </li>
            ))}
          </ol>
          <p>Command mastery</p>
          <ol>
            {masteryBoard.length === 0 ? (
              <li>No mastery data yet.</li>
            ) : (
              masteryBoard.map(([command, count]) => <li key={command}>{command}: {count}</li>)
            )}
          </ol>
        </section>
      </div>
    </div>
  );
}
