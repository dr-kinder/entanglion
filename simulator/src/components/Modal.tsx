import React, { useState } from 'react';
import {
  GameState, GamePhase, Planet, ComponentType,
} from '../engine/types';
import { formatComponent, GameAction } from '../engine/game';
import type { PlayerId } from '../engine/types';

// No popup modals. Choices that require player input are shown inline here,
// rendered below the status bar in the center column.

interface ActionPromptProps {
  state: GameState;
  dispatch: (a: GameAction) => void;
}

export default function ActionPrompt({ state, dispatch }: ActionPromptProps) {
  const { phase, currentPlayer } = state;

  if (phase === GamePhase.QUBIT_INTERCONNECT_OPTIONAL) {
    return <QubitInterconnectPrompt state={state} dispatch={dispatch} />;
  }

  if (phase === GamePhase.PHYSICAL_QUBITS_PLACE) {
    const count = state.pendingPhysicalQubitsCount;
    const ship = count === 2 ? 'Rubicon' : 'Mercurial';
    return (
      <div className="action-prompt">
        <span className="prompt-label">Physical Qubits — place {ship} on:</span>
        <button className="prompt-btn" onClick={() => dispatch({ type: 'PHYSICAL_QUBITS_PLACE', planet: Planet.ZERO })}>ZERO</button>
        <button className="prompt-btn" onClick={() => dispatch({ type: 'PHYSICAL_QUBITS_PLACE', planet: Planet.ONE })}>ONE</button>
      </div>
    );
  }

  if (phase === GamePhase.BENNETT_SELECT) {
    const p = currentPlayer;
    const other: PlayerId = p === 0 ? 1 : 0;
    const myComponents = state.playerComponents[p];
    const theirComponents = state.playerComponents[other];
    const otherName = other === 0 ? 'Rubicon' : 'Mercurial';
    return (
      <div className="action-prompt">
        <span className="prompt-label">Bennett — transfer a component:</span>
        {myComponents.map((c, i) => (
          <button key={`give-${i}`} className="prompt-btn"
            onClick={() => dispatch({ type: 'BENNETT_GIVE', componentIndex: i })}>
            Give {formatComponent(c)}
          </button>
        ))}
        {theirComponents.map((c, i) => (
          <button key={`take-${i}`} className="prompt-btn"
            onClick={() => dispatch({ type: 'BENNETT_TAKE', componentIndex: i })}>
            Take {formatComponent(c)} from {otherName}
          </button>
        ))}
      </div>
    );
  }

  if (phase === GamePhase.THE_MECHANIC_ACTIVE) {
    const ms = state.mechanicState;
    const hand = state.hands[currentPlayer];
    return (
      <div className="action-prompt">
        <span className="prompt-label">
          The Mechanic — play up to {ms?.playsRemaining ?? 2} card(s), then done:
        </span>
        {hand.map((card, i) => (
          <button key={i} className="prompt-btn"
            onClick={() => dispatch({ type: 'MECHANIC_PLAY_CARD', cardIndex: i })}>
            Play {card}
          </button>
        ))}
        <button className="prompt-btn prompt-btn-done"
          onClick={() => dispatch({ type: 'MECHANIC_DONE' })}>
          Done
        </button>
      </div>
    );
  }

  if (phase === GamePhase.GAME_OVER) {
    return (
      <div className="action-prompt">
        <span className="prompt-label">
          {state.gameResult === 'win' ? '🎉 You win! Play again?' : '💀 Game over. Try again?'}
        </span>
        {(['easy', 'normal', 'hard'] as const).map(d => (
          <button key={d} className="prompt-btn"
            onClick={() => dispatch({ type: 'NEW_GAME', difficulty: d })}>
            New game ({d})
          </button>
        ))}
      </div>
    );
  }

  return null;
}

function QubitInterconnectPrompt({ state, dispatch }: { state: GameState; dispatch: (a: GameAction) => void }) {
  const p = state.currentPlayer;
  const other: PlayerId = p === 0 ? 1 : 0;
  const myHand = state.hands[p];
  const theirHand = state.hands[other];
  const otherName = other === 0 ? 'Rubicon' : 'Mercurial';

  const [myIdx, setMyIdx] = useState<number | null>(null);
  const [theirIdx, setTheirIdx] = useState<number | null>(null);

  return (
    <div className="action-prompt" style={{ flexWrap: 'wrap', gap: 12 }}>
      <span className="prompt-label">QI Exchange — give one, take one:</span>
      <span className="prompt-label" style={{ color: '#94a3b8' }}>Your card:</span>
      {myHand.map((c, i) => (
        <button key={i}
          className={`prompt-btn ${myIdx === i ? 'prompt-btn-selected' : ''}`}
          onClick={() => setMyIdx(i)}>{c}</button>
      ))}
      <span className="prompt-label" style={{ color: '#94a3b8' }}>{otherName}'s card:</span>
      {theirHand.map((c, i) => (
        <button key={i}
          className={`prompt-btn ${theirIdx === i ? 'prompt-btn-selected' : ''}`}
          onClick={() => setTheirIdx(i)}>{c}</button>
      ))}
      <button className="prompt-btn"
        disabled={myIdx === null || theirIdx === null}
        onClick={() => {
          if (myIdx !== null && theirIdx !== null)
            dispatch({ type: 'QUBIT_INTERCONNECT_EXCHANGE', myCardIndex: myIdx, theirCardIndex: theirIdx });
        }}>Exchange</button>
      <button className="prompt-btn prompt-btn-done"
        onClick={() => dispatch({ type: 'SKIP_QUBIT_INTERCONNECT' })}>Skip</button>
    </div>
  );
}
