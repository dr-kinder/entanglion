import React from 'react';
import { CardType, ComponentType, EventCardType, GameState, PlayerId } from '../engine/types';
import { formatComponent, formatEventCard, canUseQubitInterconnect } from '../engine/game';

interface PlayerPanelProps {
  state: GameState;
  player: PlayerId;
  isActive: boolean;
  onNavigate: (cardIndex: number) => void;
  onExchange: (cardIndex: number) => void;
  onRetrieve: () => void;
  onPlayEvent: (eventIndex: number) => void;
  onStartQubitInterconnect: () => void;
}

const CARD_COLORS: Record<CardType, string> = {
  [CardType.H]:    '#22d3ee',
  [CardType.X]:    '#fb923c',
  [CardType.CNOT]: '#a78bfa',
  [CardType.SWAP]: '#f472b6',
  [CardType.PROBE]:'#ef4444',
};

const COMPONENT_COLORS: Record<ComponentType, string> = {
  [ComponentType.PHYSICAL_QUBITS]:          '#86efac',
  [ComponentType.QUBIT_INTERCONNECT]:       '#93c5fd',
  [ComponentType.DILUTION_REFRIGERATOR]:    '#c4b5fd',
  [ComponentType.QUANTUM_GATES]:            '#fde68a',
  [ComponentType.QUANTUM_PROGRAMMING]:      '#6ee7b7',
  [ComponentType.QUANTUM_ERROR_CORRECTION]: '#34d399',
  [ComponentType.CONTROL_INFRASTRUCTURE]:   '#f87171',
  [ComponentType.MAGNETIC_SHIELDING]:       '#7dd3fc',
};

function CardButton({ card, onClick, label }: { card: CardType; onClick: () => void; label: string }) {
  return (
    <button
      className="card-btn"
      style={{ borderColor: CARD_COLORS[card], color: CARD_COLORS[card] }}
      onClick={onClick}
      title={label}
    >
      {card}
    </button>
  );
}

export default function PlayerPanel({
  state, player, isActive,
  onNavigate, onExchange, onRetrieve, onPlayEvent, onStartQubitInterconnect,
}: PlayerPanelProps) {
  const name = player === 0 ? 'Rubicon' : 'Mercurial';
  const color = player === 0 ? '#ef4444' : '#3b82f6';
  const hand = state.hands[player];
  const eventHand = state.eventHands[player];
  const components = state.playerComponents[player];
  const board = state.engineBoard;
  const phase = state.phase;

  const canAct = isActive;
  const canNavigate = canAct && (phase === 'ACTION_SELECT');
  const canExchange = canAct && phase === 'ACTION_SELECT';
  const canRetrieve = canAct && phase === 'ACTION_SELECT';
  const canPlayEvent = canAct && phase === 'ACTION_SELECT' && eventHand.length > 0;

  return (
    <div className={`player-panel ${isActive ? 'active' : ''}`} style={{ '--player-color': color } as React.CSSProperties}>
      <div className="player-header">
        <span className="player-name" style={{ color }}>{name}</span>
        {isActive && <span className="active-badge">YOUR TURN</span>}
      </div>

      <div className="panel-body">
        {/* Hand */}
        <div className="section">
          <div className="section-label">Hand ({hand.length})</div>
          <div className="card-row">
            {hand.map((card, i) => (
              <div key={i} className="card-actions">
                <CardButton card={card} label={`Navigate with ${card}`} onClick={() => canNavigate && onNavigate(i)} />
                {canExchange && (
                  <button
                    className="card-sub-btn"
                    onClick={() => onExchange(i)}
                    title={`Exchange ${card}`}
                  >↩</button>
                )}
              </div>
            ))}
            {hand.length === 0 && <span className="empty-note">no cards</span>}
          </div>
        </div>

        {/* Actions */}
        {canAct && phase === 'ACTION_SELECT' && (
          <div className="section">
            <div className="section-label">Actions</div>
            <div className="action-row">
              <button className="action-btn" onClick={onRetrieve} disabled={!canRetrieve}>
                🔬 Retrieve
              </button>
              {canUseQubitInterconnect(state) && (
                <button className="action-btn qi-btn" onClick={onStartQubitInterconnect}
                  title="Free action: exchange one card with the other player">
                  🔗 QI Exchange
                </button>
              )}
            </div>
          </div>
        )}

        {/* Event cards */}
        {eventHand.length > 0 && (
          <div className="section">
            <div className="section-label">Event Cards</div>
            <div className="event-row">
              {eventHand.map((ev, i) => (
                <button
                  key={i}
                  className={`event-btn ${canPlayEvent ? 'playable' : ''}`}
                  onClick={() => canPlayEvent && onPlayEvent(i)}
                  title={formatEventCard(ev)}
                >
                  {formatEventCard(ev)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Components */}
        {components.length > 0 && (
          <div className="section">
            <div className="section-label">Components ({components.length}/8)</div>
            <div className="component-row">
              {components.map((c, i) => (
                <div
                  key={i}
                  className="component-badge"
                  style={{ backgroundColor: COMPONENT_COLORS[c] + '22', borderColor: COMPONENT_COLORS[c], color: COMPONENT_COLORS[c] }}
                  title={formatComponent(c)}
                >
                  {formatComponent(c)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
