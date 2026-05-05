import React from 'react';
import {
  GameState, GamePhase, Planet, Galaxy, PLANET_GALAXY, ComponentType, PlayerId,
} from '../engine/types';
import { formatComponent, formatEventCard, formatPlanet, GameAction } from '../engine/game';

interface ModalProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
  pendingNavCard: number | null;
  pendingNavDests: Planet[];
  onSelectDestination: (p: Planet) => void;
  onCancelNav: () => void;
}

export default function Modal({
  state, dispatch, pendingNavCard, pendingNavDests, onSelectDestination, onCancelNav,
}: ModalProps) {
  const { phase, currentPlayer } = state;

  // Destination chooser (when multiple Entanglion H destinations available)
  if (pendingNavCard !== null && pendingNavDests.length > 1) {
    return (
      <Overlay title="Choose Destination">
        <p>Multiple destinations available. Where do you want to navigate?</p>
        <div className="modal-btns">
          {pendingNavDests.map(p => (
            <button key={p} className="modal-btn primary" onClick={() => onSelectDestination(p)}>
              {formatPlanet(p)}
            </button>
          ))}
          <button className="modal-btn" onClick={onCancelNav}>Cancel</button>
        </div>
      </Overlay>
    );
  }

  switch (phase) {
    case GamePhase.ORBITAL_DEFENSE_ROLL:
      return (
        <Overlay title="⚠ Orbital Defenses!">
          <p>You've navigated into Entanglion. Roll the Entanglion die to check orbital defenses.</p>
          {state.playerComponents[currentPlayer].includes(ComponentType.MAGNETIC_SHIELDING) && (
            <p className="hint">You have Magnetic Shielding — you may reroll once.</p>
          )}
          {state.mechanicBypassActive && (
            <p className="hint">Quantum Tunnel active — click Bypass to skip the check.</p>
          )}
          <div className="modal-btns">
            {state.mechanicBypassActive ? (
              <button className="modal-btn primary" onClick={() => dispatch({ type: 'QUANTUM_TUNNEL_BYPASS' })}>
                🛡 Bypass Defenses (Quantum Tunnel)
              </button>
            ) : (
              <button className="modal-btn primary" onClick={() => dispatch({ type: 'ORBITAL_DEFENSE_ROLL' })}>
                🎲 Roll Die
              </button>
            )}
          </div>
        </Overlay>
      );

    case GamePhase.PHYSICAL_QUBITS_PLACE: {
      const count = state.pendingPhysicalQubitsCount;
      const shipLabel = count === 2 ? 'Rubicon' : 'Mercurial';
      return (
        <Overlay title="Physical Qubits: Choose Planet">
          <p>Where should {shipLabel} land?</p>
          <div className="modal-btns">
            <button className="modal-btn primary" onClick={() => dispatch({ type: 'PHYSICAL_QUBITS_PLACE', planet: Planet.ZERO })}>
              ZERO
            </button>
            <button className="modal-btn primary" onClick={() => dispatch({ type: 'PHYSICAL_QUBITS_PLACE', planet: Planet.ONE })}>
              ONE
            </button>
          </div>
        </Overlay>
      );
    }

    case GamePhase.HEISENBERG_ROLL:
      return (
        <Overlay title="Heisenberg Card">
          <p>Roll the Entanglion die. Both ships teleport that many planets clockwise from OMEGA ZERO.</p>
          <div className="modal-btns">
            <button className="modal-btn primary" onClick={() => dispatch({ type: 'HEISENBERG_ROLL' })}>
              🎲 Roll Die
            </button>
          </div>
        </Overlay>
      );

    case GamePhase.BENNETT_SELECT:
      return <BennettModal state={state} dispatch={dispatch} />;

    case GamePhase.THE_MECHANIC_ACTIVE:
      return <MechanicModal state={state} dispatch={dispatch} />;

    case GamePhase.QUBIT_INTERCONNECT_OPTIONAL:
      return <QubitInterconnectModal state={state} dispatch={dispatch} />;

    case GamePhase.GAME_OVER:
      return (
        <Overlay title={state.gameResult === 'win' ? '🎉 Victory!' : '💀 Game Over'}>
          <p>{state.gameResult === 'win'
            ? 'Congratulations! You rebuilt the quantum computer!'
            : 'The detection rate reached X. The ancients have caught you!'}
          </p>
          <div className="modal-btns">
            {(['easy', 'normal', 'hard'] as const).map(d => (
              <button key={d} className="modal-btn primary" onClick={() => dispatch({ type: 'NEW_GAME', difficulty: d })}>
                New Game ({d})
              </button>
            ))}
          </div>
        </Overlay>
      );

    default:
      return null;
  }
}

// ── sub-modals ────────────────────────────────────────────────────────────────

function BennettModal({ state, dispatch }: { state: GameState; dispatch: (a: GameAction) => void }) {
  const p = state.currentPlayer;
  const other: PlayerId = p === 0 ? 1 : 0;
  const myComponents = state.playerComponents[p];
  const theirComponents = state.playerComponents[other];

  return (
    <Overlay title="Bennett: Transfer Component">
      {myComponents.length > 0 && (
        <div>
          <p>Give one of your components to {other === 0 ? 'Rubicon' : 'Mercurial'}:</p>
          <div className="modal-btns">
            {myComponents.map((c, i) => (
              <button key={i} className="modal-btn" onClick={() => dispatch({ type: 'BENNETT_GIVE', componentIndex: i })}>
                Give {formatComponent(c)}
              </button>
            ))}
          </div>
        </div>
      )}
      {theirComponents.length > 0 && (
        <div>
          <p>Take one from {other === 0 ? 'Rubicon' : 'Mercurial'}:</p>
          <div className="modal-btns">
            {theirComponents.map((c, i) => (
              <button key={i} className="modal-btn" onClick={() => dispatch({ type: 'BENNETT_TAKE', componentIndex: i })}>
                Take {formatComponent(c)}
              </button>
            ))}
          </div>
        </div>
      )}
      {myComponents.length === 0 && theirComponents.length === 0 && (
        <p>No components to transfer.</p>
      )}
    </Overlay>
  );
}

function MechanicModal({ state, dispatch }: { state: GameState; dispatch: (a: GameAction) => void }) {
  const p = state.currentPlayer;
  const hand = state.hands[p];
  const ms = state.mechanicState;

  return (
    <Overlay title="The Mechanic — Play Up to 2 Cards">
      <p>You may play up to {ms?.playsRemaining ?? 2} more card(s). Orbital defenses are bypassed.</p>
      <div className="modal-btns">
        {hand.map((card, i) => (
          <button key={i} className="modal-btn primary"
            onClick={() => dispatch({ type: 'MECHANIC_PLAY_CARD', cardIndex: i })}>
            Play {card}
          </button>
        ))}
        <button className="modal-btn" onClick={() => dispatch({ type: 'MECHANIC_DONE' })}>
          Done (discard remaining)
        </button>
      </div>
    </Overlay>
  );
}

function QubitInterconnectModal({ state, dispatch }: { state: GameState; dispatch: (a: GameAction) => void }) {
  const p = state.currentPlayer;
  const other: PlayerId = p === 0 ? 1 : 0;
  const myHand = state.hands[p];
  const theirHand = state.hands[other];
  const [myIdx, setMyIdx] = React.useState<number | null>(null);
  const [theirIdx, setTheirIdx] = React.useState<number | null>(null);

  return (
    <Overlay title="Qubit Interconnect — Free Card Exchange">
      <p>Ships are on the same planet. You may exchange one card with {other === 0 ? 'Rubicon' : 'Mercurial'} (free, not an action).</p>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '12px 0' }}>
        <div>
          <div className="section-label">Your card:</div>
          <div className="modal-btns">
            {myHand.map((c, i) => (
              <button key={i}
                className={`modal-btn ${myIdx === i ? 'selected' : ''}`}
                onClick={() => setMyIdx(i)}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="section-label">Their card:</div>
          <div className="modal-btns">
            {theirHand.map((c, i) => (
              <button key={i}
                className={`modal-btn ${theirIdx === i ? 'selected' : ''}`}
                onClick={() => setTheirIdx(i)}>{c}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="modal-btns">
        <button
          className="modal-btn primary"
          disabled={myIdx === null || theirIdx === null}
          onClick={() => {
            if (myIdx !== null && theirIdx !== null)
              dispatch({ type: 'QUBIT_INTERCONNECT_EXCHANGE', myCardIndex: myIdx, theirCardIndex: theirIdx });
          }}
        >Exchange</button>
        <button className="modal-btn" onClick={() => dispatch({ type: 'SKIP_QUBIT_INTERCONNECT' })}>
          Skip
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2 className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
