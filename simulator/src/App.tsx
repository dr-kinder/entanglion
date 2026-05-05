import React, { useReducer, useState } from 'react';
import { GamePhase, Planet } from './engine/types';
import { gameReducer, GameAction, getNavigationDestinations } from './engine/game';
import { createInitialState } from './engine/setup';
import Board from './components/Board';
import DetectionTrack from './components/DetectionTrack';
import PlayerPanel from './components/PlayerPanel';
import GameLog from './components/GameLog';
import Modal from './components/Modal';
import './index.css';

const INITIAL = createInitialState('normal');

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL);

  const [pendingNavCard, setPendingNavCard] = useState<number | null>(null);
  const [pendingNavDests, setPendingNavDests] = useState<Planet[]>([]);

  function handleNavigate(cardIndex: number) {
    if (state.phase !== GamePhase.ACTION_SELECT && state.phase !== GamePhase.THE_MECHANIC_ACTIVE) return;
    const dests = getNavigationDestinations(state, cardIndex);

    if (dests.length === 0) {
      dispatch({ type: 'NAVIGATE', cardIndex });
      return;
    }

    if (dests.length === 1) {
      dispatch({ type: 'NAVIGATE', cardIndex, destination: dests[0] });
      return;
    }

    setPendingNavCard(cardIndex);
    setPendingNavDests(dests);
  }

  function handleSelectDestination(planet: Planet) {
    if (pendingNavCard === null) return;
    dispatch({ type: 'NAVIGATE', cardIndex: pendingNavCard, destination: planet });
    setPendingNavCard(null);
    setPendingNavDests([]);
  }

  function handleCancelNav() {
    setPendingNavCard(null);
    setPendingNavDests([]);
  }

  const p = state.currentPlayer;
  const highlightedPlanets = pendingNavCard !== null ? pendingNavDests : [];

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
          <Board
            state={state}
            highlightedPlanets={highlightedPlanets}
            onPlanetClick={pendingNavCard !== null ? handleSelectDestination : undefined}
          />
          <DetectionTrack currentIndex={state.detectionIndex} />
          <div className="status-bar">
            {state.gameResult === 'playing' ? (
              <span>
                <strong style={{ color: p === 0 ? '#ef4444' : '#3b82f6' }}>
                  {p === 0 ? '● Rubicon' : '● Mercurial'}
                </strong>
                {' — '}{statusText(state)}
              </span>
            ) : (
              <span style={{ color: state.gameResult === 'win' ? '#4ade80' : '#f87171' }}>
                {state.gameResult === 'win' ? '🎉 You Win!' : '💀 Game Over'}
              </span>
            )}
          </div>
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

      <Modal
        state={state}
        dispatch={dispatch}
        pendingNavCard={pendingNavCard}
        pendingNavDests={pendingNavDests}
        onSelectDestination={handleSelectDestination}
        onCancelNav={handleCancelNav}
      />
    </div>
  );
}

function statusText(state: GameState): string {
  switch (state.phase) {
    case GamePhase.ACTION_SELECT: return 'Select an action';
    case GamePhase.ORBITAL_DEFENSE_ROLL: return 'Roll for orbital defenses!';
    case GamePhase.THE_MECHANIC_ACTIVE: return 'The Mechanic — play up to 2 cards';
    case GamePhase.HEISENBERG_ROLL: return 'Heisenberg — roll to teleport';
    case GamePhase.BENNETT_SELECT: return 'Bennett — transfer a component';
    case GamePhase.PHYSICAL_QUBITS_PLACE: return 'Choose Centarious landing planet';
    case GamePhase.QUBIT_INTERCONNECT_OPTIONAL: return 'Optional: Qubit Interconnect exchange';
    default: return '';
  }
}

// Type alias to keep statusText signature clean
type GameState = Parameters<typeof gameReducer>[0];
