import React from 'react';

interface GameLogProps {
  entries: string[];
}

export default function GameLog({ entries }: GameLogProps) {
  return (
    <div className="game-log">
      <div className="section-label">Game Log</div>
      <div className="log-entries">
        {[...entries].reverse().map((entry, i) => (
          <div key={i} className="log-entry">{entry}</div>
        ))}
      </div>
    </div>
  );
}
