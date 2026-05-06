import React, { useReducer } from 'react';
import { GamePhase, CardType } from './engine/types';
import { gameReducer, getNavigationDestinations } from './engine/game';
import { createInitialState } from './engine/setup';
import Board from './components/Board';
import DetectionTrack from './components/DetectionTrack';
import PlayerPanel from './components/PlayerPanel';
import GameLog from './components/GameLog';
import ActionPrompt from './components/Modal';
import './index.css';

const INITIAL = createInitialState('normal');

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL);
  const p = state.currentPlayer;

  function handleNavigate(cardIndex: number) {
    const phase = state.phase;
    if (phase !== GamePhase.ACTION_SELECT && phase !== GamePhase.THE_MECHANIC_ACTIVE) return;
    const dests = getNavigationDestinations(state, cardIndex);
    // Always dispatch with the first (or only) destination — no ambiguity with current transition table
    dispatch({ type: 'NAVIGATE', cardIndex, destination: dests[0] });
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="game-title">ENTANGLION</h1>
          <span className="subtitle">Cooperative Quantum Computing Game · IBM Research</span>
        </div>
        <div className="new-game-bar">
          {(['easy', 'normal', 'hard'] as const).map(d => (
            <button key={d} className="new-game-btn"
              onClick={() => dispatch({ type: 'NEW_GAME', difficulty: d })}>
              New ({d})
            </button>
          ))}
        </div>
      </header>

      <div className="game-layout">
        <PlayerPanel
          state={state}
          player={0}
          isActive={p === 0 && state.gameResult === 'playing'}
          onNavigate={handleNavigate}
          onExchange={i => dispatch({ type: 'EXCHANGE', cardIndex: i })}
          onRetrieve={() => dispatch({ type: 'RETRIEVE' })}
          onPlayEvent={i => dispatch({ type: 'PLAY_EVENT', eventIndex: i })}
          onStartQubitInterconnect={() => dispatch({ type: 'START_QUBIT_INTERCONNECT' })}
        />

        <div className="center-column">
          <Board state={state} />
          <DetectionTrack currentIndex={state.detectionIndex} />
          <EngineBoard board={state.engineBoard} />
          <div className="status-bar">
            <strong style={{ color: p === 0 ? '#ef4444' : '#3b82f6' }}>
              {p === 0 ? '● Rubicon' : '● Mercurial'}
            </strong>
            {' — '}{statusText(state)}
          </div>
          <ActionPrompt state={state} dispatch={dispatch} />
          <GameLog entries={state.log} />
        </div>

        <PlayerPanel
          state={state}
          player={1}
          isActive={p === 1 && state.gameResult === 'playing'}
          onNavigate={handleNavigate}
          onExchange={i => dispatch({ type: 'EXCHANGE', cardIndex: i })}
          onRetrieve={() => dispatch({ type: 'RETRIEVE' })}
          onPlayEvent={i => dispatch({ type: 'PLAY_EVENT', eventIndex: i })}
          onStartQubitInterconnect={() => dispatch({ type: 'START_QUBIT_INTERCONNECT' })}
        />
      </div>
    </div>
  );
}

const CARD_COLORS: Record<CardType, string> = {
  [CardType.H]: '#22d3ee', [CardType.X]: '#fb923c', [CardType.CNOT]: '#a78bfa',
  [CardType.SWAP]: '#f472b6', [CardType.PROBE]: '#ef4444',
};

function EngineBoard({ board }: { board: CardType[] }) {
  return (
    <div className="engine-board-bar">
      <span className="section-label">Engine Control ({board.length}/6)</span>
      <div className="engine-board">
        {Array(6).fill(null).map((_, i) => (
          <div key={i} className="engine-slot"
            style={board[i] ? { borderColor: CARD_COLORS[board[i]], color: CARD_COLORS[board[i]] } : {}}>
            {board[i] ?? '·'}
          </div>
        ))}
      </div>
    </div>
  );
}

function statusText(state: Parameters<typeof gameReducer>[0]): string {
  switch (state.phase) {
    case GamePhase.ACTION_SELECT:              return 'Select an action';
    case GamePhase.THE_MECHANIC_ACTIVE:        return 'The Mechanic — play up to 2 cards';
    case GamePhase.BENNETT_SELECT:             return 'Bennett — transfer a component';
    case GamePhase.PHYSICAL_QUBITS_PLACE:      return 'Physical Qubits — choose landing planet';
    case GamePhase.QUBIT_INTERCONNECT_OPTIONAL:return 'Optional: Qubit Interconnect exchange';
    case GamePhase.GAME_OVER:
      return state.gameResult === 'win' ? '🎉 You win!' : '💀 Game over';
    default: return '';
  }
}
