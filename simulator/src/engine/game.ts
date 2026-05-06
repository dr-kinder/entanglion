import {
  GameState, Planet, CardType, ComponentType, EventCardType,
  GamePhase, PlayerId, PLANET_GALAXY, Galaxy, DETECTION_SCALE,
  DETECTION_SCALE_DISPLAY, MAX_DETECTION_INDEX, FIRST_FOUR_INDEX,
  CLOCKWISE_ORDER, HOLD_IN_HAND_EVENTS, MechanicState,
} from './types';
import {
  getEntanglionDestination, getEntanglionEntry, getEntanglionExit,
  isBellState, getOutsideTransition,
} from './transitions';
import { buildEngineDeck, buildEventDeck, createInitialState } from './setup';

// ── helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rollD8(): number { return Math.floor(Math.random() * 8) + 1; }
export function rollD2(): Planet {
  return Math.random() < 0.5 ? Planet.ZERO : Planet.ONE;
}

// Collapse an entangled state to classical Centarious outcomes for both ships.
// Returns [ship0_planet, ship1_planet] in Centarious, sampled correctly:
//   Φ states: both qubits correlated  → always same planet (|00⟩ or |11⟩)
//   Ψ states: both qubits anti-correlated → always opposite planets (|01⟩ or |10⟩)
//   Ω states: all four combinations equally likely
export function measureEntangledState(planet: Planet): [Planet, Planet] {
  const coin = () => Math.random() < 0.5;
  switch (planet) {
    case Planet.PHI_PLUS:
    case Planet.PHI_MINUS: {
      const p = coin() ? Planet.ZERO : Planet.ONE;
      return [p, p];
    }
    case Planet.PSI_PLUS:
    case Planet.PSI_MINUS:
      return coin() ? [Planet.ZERO, Planet.ONE] : [Planet.ONE, Planet.ZERO];
    default:
      // Omega states: independent 50/50 for each qubit
      return [coin() ? Planet.ZERO : Planet.ONE, coin() ? Planet.ZERO : Planet.ONE];
  }
}

function log(state: GameState, msg: string): GameState {
  return { ...state, log: [...state.log, msg] };
}

function hasComponent(state: GameState, player: PlayerId, c: ComponentType): boolean {
  return state.playerComponents[player].includes(c);
}

function anyPlayerHas(state: GameState, c: ComponentType): boolean {
  return hasComponent(state, 0, c) || hasComponent(state, 1, c);
}

// Effective die roll after component modifiers (for active player)
export function applyDieModifiers(state: GameState, rawRoll: number): number {
  const p = state.currentPlayer;
  let roll = rawRoll;
  if (hasComponent(state, p, ComponentType.QUANTUM_ERROR_CORRECTION)) roll += 1;
  if (hasComponent(state, p, ComponentType.CONTROL_INFRASTRUCTURE)) roll -= 1;
  return roll;
}

// Detection threshold: the number you need to beat (roll strictly greater than)
export function detectionThreshold(state: GameState): number {
  return DETECTION_SCALE[state.detectionIndex];
}

function handSize(state: GameState, player: PlayerId): number {
  if (hasComponent(state, player, ComponentType.DILUTION_REFRIGERATOR)) return 2;
  return 3;
}

// Draw one engine card for a player; handles deck exhaustion / PROBE
function drawEngineCard(state: GameState, player: PlayerId): GameState {
  let s = { ...state };

  if (s.engineDeck.length === 0) {
    // Reshuffle discard (PROBE included randomly this time)
    s = log(s, 'Engine deck exhausted — reshuffling discard pile.');
    s.engineDeck = shuffle([...s.engineDiscard]);
    s.engineDiscard = [];
  }

  if (s.engineDeck.length === 0) return s; // still empty (shouldn't happen)

  const card = s.engineDeck[0];
  s.engineDeck = s.engineDeck.slice(1);

  if (card === CardType.PROBE) {
    return handleProbe(s, player);
  }

  const newHand = [...s.hands[player], card];
  s.hands = s.hands.map((h, i) => i === player ? newHand : h) as [CardType[], CardType[]];
  return s;
}

function handleProbe(state: GameState, player: PlayerId): GameState {
  let s = log(state, `⚠ PROBE drawn by ${playerName(player)}! Rolling Entanglion die...`);
  const raw = rollD8();
  const roll = applyDieModifiers(s, raw);
  s = log(s, `PROBE roll: ${raw}${roll !== raw ? ` (modified to ${roll})` : ''} — need ≥ 4 to evade.`);

  if (roll < 4) {
    s = increaseDetection(s, `PROBE detected (rolled ${roll}).`);
  } else {
    s = log(s, `PROBE evaded (rolled ${roll}).`);
  }

  // Draw a replacement (PROBE is discarded, not added to hand)
  s.engineDiscard = [...s.engineDiscard, CardType.PROBE];
  return drawEngineCard(s, player);
}

function increaseDetection(state: GameState, reason: string): GameState {
  let s = { ...state };
  if (s.detectionIndex >= MAX_DETECTION_INDEX) return s;
  s.detectionIndex = s.detectionIndex + 1;
  s = log(s, `${reason} Detection rate → ${DETECTION_SCALE_DISPLAY[s.detectionIndex]}.`);
  if (s.detectionIndex >= MAX_DETECTION_INDEX) {
    s.gameResult = 'loss';
    s.phase = GamePhase.GAME_OVER;
    s = log(s, '💀 Detection rate reached X — GAME OVER (loss).');
  }
  return s;
}

function checkWin(state: GameState): GameState {
  const total = state.playerComponents[0].length + state.playerComponents[1].length;
  if (total >= 8) {
    return log({ ...state, gameResult: 'win', phase: GamePhase.GAME_OVER },
      '🎉 All 8 quantum components collected — YOU WIN!');
  }
  return state;
}

function playerName(p: PlayerId): string {
  return p === 0 ? 'Rubicon (red)' : 'Mercurial (blue)';
}

// Place an engine card into the engine control board and check if full
function playToEngineBoard(state: GameState, player: PlayerId, card: CardType): GameState {
  const newBoard = [...state.engineBoards[player], card];
  const boards = state.engineBoards.map((b, i) => i === player ? newBoard : b) as [CardType[], CardType[]];
  return { ...state, engineBoards: boards };
}

function engineBoardFull(state: GameState, player: PlayerId): boolean {
  return state.engineBoards[player].length >= 6;
}

function clearEngineBoardToDiscard(state: GameState, player: PlayerId): GameState {
  const cards = state.engineBoards[player];
  return {
    ...state,
    engineBoards: state.engineBoards.map((b, i) => i === player ? [] : b) as [CardType[], CardType[]],
    engineDiscard: [...state.engineDiscard, ...cards],
  };
}

function drawEventCard(state: GameState): [GameState, EventCardType | null] {
  let s = { ...state };

  if (s.eventDeck.length === 0) {
    s = log(s, 'Event deck empty — no event drawn.');
    return [s, null];
  }

  const card = s.eventDeck[0];
  s.eventDeck = s.eventDeck.slice(1);

  if (card === EventCardType.QUANTUM_SHUFFLE) {
    s = log(s, 'Quantum Shuffle drawn — reshuffling event deck!');
    const remaining = shuffle([...s.eventDeck, ...s.eventDiscard]);
    // Rebuild deck per setup rules
    s.eventDeck = [
      ...remaining.slice(0, Math.min(5, remaining.length)),
      EventCardType.QUANTUM_SHUFFLE,
      ...remaining.slice(Math.min(5, remaining.length)),
    ];
    s.eventDiscard = [];
    // Draw again after shuffle
    return drawEventCard(s);
  }

  return [s, card];
}

// Trigger a quantum event: draw event card + clear engine board
function triggerQuantumEvent(state: GameState): GameState {
  let s = state;
  const player = s.currentPlayer;

  const [s2, card] = drawEventCard(s);
  s = s2;

  if (!card) return s;

  s = log(s, `🌀 Quantum event: ${formatEventCard(card)}`);

  // Hold-in-hand cards go to the current player's event hand
  if (HOLD_IN_HAND_EVENTS.has(card)) {
    const newEventHands = s.eventHands.map((eh, i) =>
      i === player ? [...eh, card] : eh
    ) as [EventCardType[], EventCardType[]];
    s = { ...s, eventHands: newEventHands };
    s = log(s, `${playerName(player)} keeps ${formatEventCard(card)} in hand.`);
    return s;
  }

  // Immediate effect cards
  return resolveEventCard(s, card);
}

function resolveEventCard(state: GameState, card: EventCardType): GameState {
  let s = state;
  switch (card) {
    case EventCardType.BIT_FLIP_ERROR:
      s = log(s, 'Bit Flip Error: Detection rate reset to first 4.');
      if (s.detectionIndex > FIRST_FOUR_INDEX) {
        s.detectionIndex = FIRST_FOUR_INDEX;
      }
      break;

    case EventCardType.SCHRODINGER:
      s = increaseDetection(s, 'Schrödinger: detection rate +1.');
      break;

    case EventCardType.WAVE_FUNCTION_COLLAPSE:
      {
        const newIdx = Math.max(0, s.detectionIndex - 2);
        s = log(s, `Wave Function Collapse: detection rate −2 (→ ${DETECTION_SCALE_DISPLAY[newIdx]}).`);
        s.detectionIndex = newIdx;
      }
      break;

    case EventCardType.SPOOKY_ACTION:
      s = resolveSpookyAction(s);
      break;

    // Hold-in-hand cards shouldn't reach here via triggerQuantumEvent,
    // but are handled when played as an action
    default:
      s = log(s, `${formatEventCard(card)} has no immediate effect.`);
      break;
  }
  s.eventDiscard = [...s.eventDiscard, card];
  return s;
}

function resolveSpookyAction(state: GameState): GameState {
  let s = state;
  const p = s.currentPlayer;
  const components = s.playerComponents[p];

  if (components.length === 0) {
    s = log(s, 'Spooky Action: no components on this ship — no effect.');
    return s;
  }

  // Pick one at random
  const idx = Math.floor(Math.random() * components.length);
  const lost = components[idx];
  const kept = components.filter((_, i) => i !== idx);

  s = log(s, `Spooky Action: ${formatComponent(lost)} is ejected from ${playerName(p)}'s ship!`);

  // Roll die to place the lost component on an unoccupied Entanglion planet
  const roll = rollD8();
  s = log(s, `Spooky Action die roll: ${roll}`);

  // Count clockwise from OMEGA_ZERO, skipping occupied planets
  const occupied = new Set(Object.entries(s.componentLocations)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => k as Planet));

  let count = 0;
  let destination: Planet = Planet.OMEGA_ZERO;
  for (let i = 0; i < CLOCKWISE_ORDER.length * 2; i++) {
    const planet = CLOCKWISE_ORDER[i % CLOCKWISE_ORDER.length];
    if (!occupied.has(planet)) {
      count++;
      if (count === roll) { destination = planet; break; }
      // If roll > unoccupied planets, wrap
    }
  }
  // Handle wrap: if roll > number of unoccupied, take mod
  const unoccupied = CLOCKWISE_ORDER.filter(p => !occupied.has(p));
  if (unoccupied.length > 0) {
    destination = unoccupied[(roll - 1) % unoccupied.length];
  }

  s = log(s, `Spooky Action: ${formatComponent(lost)} placed on ${formatPlanet(destination)}.`);

  const newComponents = s.playerComponents.map((arr, i) =>
    i === p ? kept : arr
  ) as [ComponentType[], ComponentType[]];

  const newLocations = { ...s.componentLocations, [destination]: lost };

  s = { ...s, playerComponents: newComponents, componentLocations: newLocations };
  return s;
}

function nextTurn(state: GameState): GameState {
  const next: PlayerId = state.currentPlayer === 0 ? 1 : 0;
  return { ...state, currentPlayer: next, phase: GamePhase.ACTION_SELECT,
    pendingNavigationDestination: null, mechanicBypassActive: false };
}

// ── public action dispatchers ────────────────────────────────────────────────

export type GameAction =
  | { type: 'NAVIGATE'; cardIndex: number; destination?: Planet }
  | { type: 'EXCHANGE'; cardIndex: number }
  | { type: 'RETRIEVE' }
  | { type: 'PLAY_EVENT'; eventIndex: number }
  | { type: 'ORBITAL_DEFENSE_ROLL' }
  | { type: 'START_QUBIT_INTERCONNECT' }
  | { type: 'SKIP_QUBIT_INTERCONNECT' }
  | { type: 'QUBIT_INTERCONNECT_EXCHANGE'; myCardIndex: number; theirCardIndex: number }
  | { type: 'PHYSICAL_QUBITS_PLACE'; planet: Planet }
  | { type: 'MECHANIC_PLAY_CARD'; cardIndex: number }
  | { type: 'MECHANIC_DONE' }
  | { type: 'BENNETT_GIVE'; componentIndex: number }
  | { type: 'BENNETT_TAKE'; componentIndex: number }
  | { type: 'QUANTUM_TUNNEL_BYPASS' }
  | { type: 'HEISENBERG_ROLL' }
  | { type: 'MAGNETIC_SHIELD_REROLL' }
  | { type: 'MAGNETIC_SHIELD_KEEP' }
  | { type: 'NEW_GAME'; difficulty: 'easy' | 'normal' | 'hard' };

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.gameResult !== 'playing' && action.type !== 'NEW_GAME') return state;

  switch (action.type) {
    case 'NAVIGATE': return handleNavigate(state, action.cardIndex, action.destination);
    case 'EXCHANGE': return handleExchange(state, action.cardIndex);
    case 'RETRIEVE': return handleRetrieve(state);
    case 'PLAY_EVENT': return handlePlayEvent(state, action.eventIndex);
    case 'ORBITAL_DEFENSE_ROLL': return handleOrbitalDefenseRoll(state);
    case 'START_QUBIT_INTERCONNECT': return { ...state, phase: GamePhase.QUBIT_INTERCONNECT_OPTIONAL };
    case 'SKIP_QUBIT_INTERCONNECT': return { ...state, phase: GamePhase.ACTION_SELECT };
    case 'QUBIT_INTERCONNECT_EXCHANGE': return handleQubitInterconnectExchange(state, action.myCardIndex, action.theirCardIndex);
    case 'PHYSICAL_QUBITS_PLACE': return handlePhysicalQubitsPlace(state, action.planet);
    case 'MECHANIC_PLAY_CARD': return handleMechanicPlayCard(state, action.cardIndex);
    case 'MECHANIC_DONE': return handleMechanicDone(state);
    case 'BENNETT_GIVE': return handleBennettGive(state, action.componentIndex);
    case 'BENNETT_TAKE': return handleBennettTake(state, action.componentIndex);
    case 'QUANTUM_TUNNEL_BYPASS': return handleQuantumTunnelBypass(state);
    case 'HEISENBERG_ROLL': return handleHeisenbergRoll(state);
    case 'MAGNETIC_SHIELD_REROLL': return handleMagneticShieldReroll(state);
    case 'MAGNETIC_SHIELD_KEEP': return handleMagneticShieldKeep(state);
    case 'NEW_GAME': return createInitialState(action.difficulty);
    default: return state;
  }
}

// ── navigate ─────────────────────────────────────────────────────────────────

function handleNavigate(state: GameState, cardIndex: number, chosenDest?: Planet): GameState {
  const p = state.currentPlayer;
  const card = state.hands[p][cardIndex];
  if (!card) return state;

  const isMechanic = state.phase === GamePhase.THE_MECHANIC_ACTIVE;

  let s = state;

  // Remove card from hand
  const newHand = s.hands[p].filter((_, i) => i !== cardIndex);
  s = { ...s, hands: s.hands.map((h, i) => i === p ? newHand : h) as [CardType[], CardType[]] };

  // Place card on engine board (unless in Mechanic mode)
  if (!isMechanic) {
    s = playToEngineBoard(s, p, card);
  }

  // Compute new ship positions
  const result = computeNavigation(s, p, card, chosenDest);
  if (!result) {
    s = log(s, `${playerName(p)} plays ${card} — no valid transition, card played with no effect.`);
    // Still draw replacement
    s = drawEngineCard(s, p);
    return finishNavigate(s, p, isMechanic, null);
  }

  const { newPositions, destination, enteredEntanglion } = result;
  s = { ...s, shipPositions: newPositions };
  s = log(s, `${playerName(p)} plays ${card} — moves to ${formatPlanet(destination)}.`);

  // If moved to Entanglion, check orbital defenses (unless bypassed)
  if (enteredEntanglion) {
    s = drawEngineCard(s, p);
    if (s.mechanicBypassActive) {
      s = log(s, 'Orbital defenses bypassed!');
      s = { ...s, mechanicBypassActive: false };
      return finishNavigate(s, p, isMechanic, null);
    }
    s = { ...s,
      phase: GamePhase.ORBITAL_DEFENSE_ROLL,
      pendingNavigationDestination: destination,
    };
    return s;
  }

  // Draw replacement card
  s = drawEngineCard(s, p);
  return finishNavigate(s, p, isMechanic, null);
}

interface NavResult {
  newPositions: [Planet, Planet];
  destination: Planet;
  enteredEntanglion: boolean;
}

function computeNavigation(
  state: GameState, p: PlayerId, card: CardType, chosenDest?: Planet
): NavResult | null {
  const [pos0, pos1] = state.shipPositions;
  const myPos = p === 0 ? pos0 : pos1;
  const otherPos = p === 0 ? pos1 : pos0;
  const myGalaxy = PLANET_GALAXY[myPos];
  const otherGalaxy = PLANET_GALAXY[otherPos];

  // Inside Entanglion: both ships move together
  if (myGalaxy === Galaxy.ENTANGLION) {
    if (card === CardType.CNOT && isBellState(myPos)) {
      // Exit Entanglion
      const exit = getEntanglionExit(myPos);
      if (!exit) return null;
      // Lead ship (current player's ship) goes to Centarious, other to Superious
      const [centDest, supDest] = exit;
      const newPos0 = p === 0 ? centDest : supDest;
      const newPos1 = p === 1 ? centDest : supDest;
      return { newPositions: [newPos0, newPos1], destination: centDest, enteredEntanglion: false };
    }

    if (card === CardType.PROBE) return null;

    const dest = getEntanglionDestination(myPos, card, p);
    if (!dest) return null; // no movement for this player/card/planet combo

    return { newPositions: [dest, dest], destination: dest, enteredEntanglion: false };
  }

  // Outside Entanglion
  if (card === CardType.SWAP) {
    if (otherGalaxy === Galaxy.ENTANGLION) return null; // can't swap if other in Entanglion
    return { newPositions: [pos1, pos0], destination: p === 0 ? pos1 : pos0, enteredEntanglion: false };
  }

  if (card === CardType.CNOT && myGalaxy === Galaxy.CENTARIOUS && otherGalaxy === Galaxy.SUPERIOUS) {
    // Entry into Entanglion
    const dest = getEntanglionEntry(myPos, otherPos);
    if (!dest) return null;
    return { newPositions: [dest, dest], destination: dest, enteredEntanglion: true };
  }

  const newMyPos = getOutsideTransition(myPos, otherPos, card);
  if (newMyPos === null || newMyPos === myPos) return null;

  const newPos0 = p === 0 ? newMyPos : pos0;
  const newPos1 = p === 1 ? newMyPos : pos1;
  return { newPositions: [newPos0, newPos1], destination: newMyPos, enteredEntanglion: false };
}

function finishNavigate(state: GameState, player: PlayerId, isMechanic: boolean, _destination: Planet | null): GameState {
  let s = state;

  if (isMechanic) {
    // In Mechanic mode, decrement plays
    const ms = s.mechanicState!;
    const playsLeft = ms.playsRemaining - 1;
    s = { ...s, mechanicState: { ...ms, playsRemaining: playsLeft } };
    if (playsLeft <= 0) {
      return finishMechanic(s);
    }
    return s; // stay in Mechanic phase for more plays
  }

  // Check if engine board is full after this play
  if (engineBoardFull(s, player)) {
    s = log(s, `${playerName(player)}'s engine board is full — quantum event!`);
    s = triggerQuantumEvent(s);
    s = clearEngineBoardToDiscard(s, player);
    if (s.gameResult !== 'playing') return s;
  }

  return nextTurn(s);
}

// ── orbital defense ──────────────────────────────────────────────────────────

function handleOrbitalDefenseRoll(state: GameState): GameState {
  let s = state;
  const p = s.currentPlayer;
  const dest = s.pendingNavigationDestination!;

  // Quantum Programming bypass
  const hasQP = anyPlayerHas(s, ComponentType.QUANTUM_PROGRAMMING);
  if (hasQP && !s.componentLocations[dest]) {
    s = log(s, `Quantum Programming: orbital defenses bypassed at ${formatPlanet(dest)} (no component present).`);
    s = { ...s, phase: GamePhase.ACTION_SELECT, pendingNavigationDestination: null };
    return finishNavigate(s, p, false, dest);
  }

  const raw = rollD8();
  const roll = applyDieModifiers(s, raw);
  const threshold = detectionThreshold(s);
  s = log(s, `Orbital defense roll: ${raw}${roll !== raw ? ` (→${roll})` : ''} vs detection ${DETECTION_SCALE_DISPLAY[s.detectionIndex]} — need > ${threshold}.`);

  if (roll > threshold) {
    s = log(s, `✅ Orbital defenses evaded!`);
    s = { ...s, phase: GamePhase.ACTION_SELECT, pendingNavigationDestination: null };
    return finishNavigate(s, p, false, dest);
  }

  // Detected
  s = log(s, `🚨 Detected by orbital defenses!`);
  s = increaseDetection(s, 'Orbital detection');
  if (s.gameResult !== 'playing') return s;

  // Trigger quantum event
  s = triggerQuantumEvent(s);
  if (s.gameResult !== 'playing') return s;

  // Jump both ships to random Centarious planet
  if (anyPlayerHas(s, ComponentType.PHYSICAL_QUBITS)) {
    // Player gets to choose where to place ships
    s = log(s, 'Physical Qubits: choose which Centarious planets to place ships.');
    s = { ...s, phase: GamePhase.PHYSICAL_QUBITS_PLACE, pendingPhysicalQubitsCount: 2, pendingNavigationDestination: null };
    return s;
  }

  const currentPlanet = s.shipPositions[0]; // both ships on same planet in Entanglion
  const [dest0, dest1] = measureEntangledState(currentPlanet);
  const samePlace = dest0 === dest1;
  s = log(s, `Measurement collapses entangled state — Rubicon → ${dest0}, Mercurial → ${dest1}.${samePlace ? '' : ' Ships separate!'}`);
  s = { ...s, shipPositions: [dest0, dest1], pendingNavigationDestination: null };

  // Clear engine board and end turn (detection already triggered event above)
  s = clearEngineBoardToDiscard(s, p);
  return nextTurn(s);
}

// ── retrieve ─────────────────────────────────────────────────────────────────

function handleRetrieve(state: GameState): GameState {
  let s = state;
  const p = s.currentPlayer;
  const pos = s.shipPositions[p];
  const galaxy = PLANET_GALAXY[pos];

  if (galaxy !== Galaxy.ENTANGLION) {
    return log(s, 'No components outside Entanglion.');
  }

  const component = s.componentLocations[pos];
  if (!component) {
    return log(s, `No component at ${formatPlanet(pos)}.`);
  }

  // Quantum Tunnel bypass
  if (s.mechanicBypassActive) {
    return collectComponent(s, p, pos, component);
  }

  const raw = rollD8();
  const roll = applyDieModifiers(s, raw);
  const threshold = detectionThreshold(s);
  s = log(s, `Retrieval roll: ${raw}${roll !== raw ? ` (→${roll})` : ''} vs detection ${DETECTION_SCALE_DISPLAY[s.detectionIndex]} — need > ${threshold}.`);

  if (roll > threshold) {
    return collectComponent(s, p, pos, component);
  }

  s = log(s, `🚨 Away team detected! Ground defenses triggered.`);
  s = increaseDetection(s, 'Ground detection');
  if (s.gameResult !== 'playing') return s;

  // Detection collapses the entangled state — ships return to Centarious
  if (anyPlayerHas(s, ComponentType.PHYSICAL_QUBITS)) {
    s = log(s, 'Physical Qubits: choose which Centarious planets to place ships.');
    s = { ...s, phase: GamePhase.PHYSICAL_QUBITS_PLACE, pendingPhysicalQubitsCount: 2 };
    return s;
  }
  const [dest0, dest1] = measureEntangledState(pos);
  s = log(s, `Entangled state collapses — Rubicon → ${dest0}, Mercurial → ${dest1}.`);
  s = { ...s, shipPositions: [dest0, dest1] };
  return nextTurn(s);
}

function collectComponent(state: GameState, player: PlayerId, planet: Planet, component: ComponentType): GameState {
  let s = state;
  s = log(s, `✨ ${playerName(player)} retrieves ${formatComponent(component)}!`);

  // Remove from planet
  const newLocations = { ...s.componentLocations };
  delete newLocations[planet];
  s = { ...s, componentLocations: newLocations };

  // Add to player
  const newComponents = s.playerComponents.map((arr, i) =>
    i === player ? [...arr, component] : arr
  ) as [ComponentType[], ComponentType[]];
  s = { ...s, playerComponents: newComponents };

  // Dilution Refrigerator: discard one card immediately
  if (component === ComponentType.DILUTION_REFRIGERATOR) {
    const hand = s.hands[player];
    if (hand.length > 2) {
      // Auto-discard last card (UI can let player choose)
      const discarded = hand[hand.length - 1];
      s = log(s, `Dilution Refrigerator: ${playerName(player)} discards ${discarded} (hand limit now 2).`);
      s = {
        ...s,
        hands: s.hands.map((h, i) => i === player ? h.slice(0, 2) : h) as [CardType[], CardType[]],
        engineDiscard: [...s.engineDiscard, discarded],
      };
    }
  }

  s = checkWin(s);
  if (s.gameResult !== 'playing') return s;
  return nextTurn(s);
}

// ── play event card ───────────────────────────────────────────────────────────

function handlePlayEvent(state: GameState, eventIndex: number): GameState {
  const p = state.currentPlayer;
  const card = state.eventHands[p][eventIndex];
  if (!card) return state;

  let s = {
    ...state,
    eventHands: state.eventHands.map((eh, i) =>
      i === p ? eh.filter((_, j) => j !== eventIndex) : eh
    ) as [EventCardType[], EventCardType[]],
  };

  s = log(s, `${playerName(p)} plays event card: ${formatEventCard(card)}`);

  switch (card) {
    case EventCardType.BENNETT:
      s = { ...s, phase: GamePhase.BENNETT_SELECT };
      return s;

    case EventCardType.HEISENBERG:
      s = { ...s, phase: GamePhase.HEISENBERG_ROLL };
      return s;

    case EventCardType.QUANTUM_TUNNEL:
      // Bypass orbital OR ground defenses this turn (does not count as action)
      s = { ...s, mechanicBypassActive: true };
      s = log(s, 'Quantum Tunnel active: orbital/ground defenses bypassed this turn.');
      s.eventDiscard = [...s.eventDiscard, card];
      // Don't advance turn — this card is free action
      return s;

    case EventCardType.THE_MECHANIC:
      return startMechanic(s, p, card);

    default:
      s = resolveEventCard(s, card);
      return nextTurn(s);
  }
}

// ── Heisenberg ────────────────────────────────────────────────────────────────

function handleHeisenbergRoll(state: GameState): GameState {
  let s = state;
  const roll = rollD8();
  // Roll 1 = one step CW from OMEGA_ZERO = OMEGA_ONE (index 1), roll 8 = OMEGA_ZERO (index 0)
  const dest = CLOCKWISE_ORDER[roll % 8];
  s = log(s, `Heisenberg roll: ${roll} → both ships teleport to ${formatPlanet(dest)}.`);
  s = { ...s, shipPositions: [dest, dest], phase: GamePhase.ACTION_SELECT };
  s.eventDiscard = [...s.eventDiscard, EventCardType.HEISENBERG];
  return nextTurn(s);
}

// ── The Mechanic ──────────────────────────────────────────────────────────────

function startMechanic(state: GameState, player: PlayerId, card: EventCardType): GameState {
  let s = state;
  // Save current hand, draw 3 new cards
  const savedHand = [...s.hands[player]];
  s = { ...s, hands: s.hands.map((h, i) => i === player ? [] : h) as [CardType[], CardType[]] };

  // Draw 3 cards
  for (let i = 0; i < 3; i++) {
    s = drawEngineCard(s, player);
  }

  const mechState: MechanicState = {
    savedHand,
    drawnCards: [...s.hands[player]],
    playsRemaining: 2,
    bypassDefenses: true,
  };

  s = { ...s,
    mechanicState: mechState,
    mechanicBypassActive: true,
    phase: GamePhase.THE_MECHANIC_ACTIVE,
  };
  s.eventDiscard = [...s.eventDiscard, card];
  s = log(s, `The Mechanic: saved hand, drew 3 cards. May play up to 2.`);
  return s;
}

function handleMechanicPlayCard(state: GameState, cardIndex: number): GameState {
  if (state.phase !== GamePhase.THE_MECHANIC_ACTIVE) return state;
  return handleNavigate(state, cardIndex);
}

function handleMechanicDone(state: GameState): GameState {
  return finishMechanic(state);
}

function finishMechanic(state: GameState): GameState {
  let s = state;
  const p = s.currentPlayer;
  const ms = s.mechanicState!;

  // Discard remaining drawn cards from hand
  const remaining = s.hands[p];
  s = {
    ...s,
    hands: s.hands.map((h, i) => i === p ? ms.savedHand : h) as [CardType[], CardType[]],
    engineDiscard: [...s.engineDiscard, ...remaining],
    mechanicState: null,
    mechanicBypassActive: false,
  };
  s = log(s, `The Mechanic: hand restored. Discarded ${remaining.length} unplayed card(s).`);
  return nextTurn(s);
}

// ── Bennett ───────────────────────────────────────────────────────────────────

function handleBennettGive(state: GameState, componentIndex: number): GameState {
  const p = state.currentPlayer;
  const other: PlayerId = p === 0 ? 1 : 0;
  const component = state.playerComponents[p][componentIndex];
  if (!component) return state;

  let s = state;
  const newComponents = s.playerComponents.map((arr, i) => {
    if (i === p) return arr.filter((_, j) => j !== componentIndex);
    return [...arr, component];
  }) as [ComponentType[], ComponentType[]];

  s = { ...s, playerComponents: newComponents, phase: GamePhase.ACTION_SELECT };
  s.eventDiscard = [...s.eventDiscard, EventCardType.BENNETT];
  s = log(s, `Bennett: ${playerName(p)} gives ${formatComponent(component)} to ${playerName(other)}.`);
  return nextTurn(s);
}

function handleBennettTake(state: GameState, componentIndex: number): GameState {
  const p = state.currentPlayer;
  const other: PlayerId = p === 0 ? 1 : 0;
  const component = state.playerComponents[other][componentIndex];
  if (!component) return state;

  let s = state;
  const newComponents = s.playerComponents.map((arr, i) => {
    if (i === other) return arr.filter((_, j) => j !== componentIndex);
    return [...arr, component];
  }) as [ComponentType[], ComponentType[]];

  s = { ...s, playerComponents: newComponents, phase: GamePhase.ACTION_SELECT };
  s.eventDiscard = [...s.eventDiscard, EventCardType.BENNETT];
  s = log(s, `Bennett: ${playerName(p)} takes ${formatComponent(component)} from ${playerName(other)}.`);
  return nextTurn(s);
}

// ── Quantum Tunnel ────────────────────────────────────────────────────────────

function handleQuantumTunnelBypass(state: GameState): GameState {
  // This advances the orbital defense check or ground defense — bypass them
  let s = { ...state, mechanicBypassActive: false };

  if (s.phase === GamePhase.ORBITAL_DEFENSE_ROLL) {
    s = log(s, 'Quantum Tunnel: orbital defenses bypassed!');
    s = { ...s, phase: GamePhase.ACTION_SELECT, pendingNavigationDestination: null };
    return finishNavigate(s, s.currentPlayer, false, null);
  }

  return s;
}

// ── Physical Qubits placement ─────────────────────────────────────────────────

function handlePhysicalQubitsPlace(state: GameState, planet: Planet): GameState {
  if (PLANET_GALAXY[planet] !== Galaxy.CENTARIOUS) return state;

  let s = state;
  const count = s.pendingPhysicalQubitsCount;

  if (count === 2) {
    // Place ship 0
    s = { ...s, shipPositions: [planet, s.shipPositions[1]], pendingPhysicalQubitsCount: 1 };
    s = log(s, `Physical Qubits: Rubicon placed on ${formatPlanet(planet)}.`);
    return s;
  } else if (count === 1) {
    // Place ship 1
    s = { ...s, shipPositions: [s.shipPositions[0], planet], pendingPhysicalQubitsCount: 0 };
    s = log(s, `Physical Qubits: Mercurial placed on ${formatPlanet(planet)}.`);
    s = clearEngineBoardToDiscard(s, s.currentPlayer);
    return nextTurn(s);
  }

  return s;
}

// ── Qubit Interconnect ────────────────────────────────────────────────────────

function handleQubitInterconnectExchange(
  state: GameState, myCardIndex: number, theirCardIndex: number
): GameState {
  const p = state.currentPlayer;
  const other: PlayerId = p === 0 ? 1 : 0;
  const myCard = state.hands[p][myCardIndex];
  const theirCard = state.hands[other][theirCardIndex];
  if (!myCard || !theirCard) return state;

  const newHands: [CardType[], CardType[]] = [
    [...state.hands[0]],
    [...state.hands[1]],
  ];
  newHands[p][myCardIndex] = theirCard;
  newHands[other][theirCardIndex] = myCard;

  let s = { ...state, hands: newHands, phase: GamePhase.ACTION_SELECT };
  s = log(s, `Qubit Interconnect: ${playerName(p)} swaps ${myCard} for ${theirCard} with ${playerName(other)}.`);
  return s;
}

// ── Magnetic Shielding (reroll) ───────────────────────────────────────────────

// These are called from the UI when orbital defense was rolled and player has shielding
function handleMagneticShieldReroll(_state: GameState): GameState {
  // The orbital defense roll handler is called again fresh — no stored roll
  // We set a flag to skip the reroll prompt and just do orbital defense normally
  return handleOrbitalDefenseRoll({ ..._state, mechanicBypassActive: false });
}

function handleMagneticShieldKeep(state: GameState): GameState {
  return state; // keep existing result — already handled
}

// ── exchange ─────────────────────────────────────────────────────────────────

function handleExchange(state: GameState, cardIndex: number): GameState {
  const p = state.currentPlayer;
  const card = state.hands[p][cardIndex];
  if (!card) return state;

  let s = state;
  const newHand = s.hands[p].filter((_, i) => i !== cardIndex);
  s = {
    ...s,
    hands: s.hands.map((h, i) => i === p ? newHand : h) as [CardType[], CardType[]],
    engineDiscard: [...s.engineDiscard, card],
  };
  s = log(s, `${playerName(p)} exchanges ${card}.`);

  // Quantum Gates: draw 2, keep 1
  if (hasComponent(s, p, ComponentType.QUANTUM_GATES)) {
    s = drawEngineCard(s, p);
    s = drawEngineCard(s, p);
    s = log(s, `Quantum Gates: drew 2 replacement cards.`);
    // TODO: player should choose which to discard — for now keep both if under hand limit,
    // discard last if over limit
    const limit = handSize(s, p);
    while (s.hands[p].length > limit) {
      const discard = s.hands[p][s.hands[p].length - 1];
      s = {
        ...s,
        hands: s.hands.map((h, i) => i === p ? h.slice(0, -1) : h) as [CardType[], CardType[]],
        engineDiscard: [...s.engineDiscard, discard],
      };
    }
  } else {
    s = drawEngineCard(s, p);
  }

  return nextTurn(s);
}

// ── display helpers ───────────────────────────────────────────────────────────

export function formatPlanet(p: Planet): string {
  const names: Record<Planet, string> = {
    [Planet.ZERO]: 'ZERO', [Planet.ONE]: 'ONE',
    [Planet.PLUS]: 'PLUS', [Planet.MINUS]: 'MINUS',
    [Planet.PHI_PLUS]: 'Φ+', [Planet.PHI_MINUS]: 'Φ−',
    [Planet.PSI_PLUS]: 'Ψ+', [Planet.PSI_MINUS]: 'Ψ−',
    [Planet.OMEGA_ZERO]: 'ω0', [Planet.OMEGA_ONE]: 'ω1',
    [Planet.OMEGA_TWO]: 'ω2', [Planet.OMEGA_THREE]: 'ω3',
  };
  return names[p] ?? p;
}

export function formatComponent(c: ComponentType): string {
  const names: Record<ComponentType, string> = {
    [ComponentType.PHYSICAL_QUBITS]: 'Physical Qubits',
    [ComponentType.QUBIT_INTERCONNECT]: 'Qubit Interconnect',
    [ComponentType.DILUTION_REFRIGERATOR]: 'Dilution Refrigerator',
    [ComponentType.QUANTUM_GATES]: 'Quantum Gates',
    [ComponentType.QUANTUM_PROGRAMMING]: 'Quantum Programming',
    [ComponentType.QUANTUM_ERROR_CORRECTION]: 'Quantum Error Correction',
    [ComponentType.CONTROL_INFRASTRUCTURE]: 'Control Infrastructure',
    [ComponentType.MAGNETIC_SHIELDING]: 'Magnetic Shielding',
  };
  return names[c] ?? c;
}

export function formatEventCard(e: EventCardType): string {
  const names: Record<EventCardType, string> = {
    [EventCardType.BENNETT]: 'Bennett',
    [EventCardType.BIT_FLIP_ERROR]: 'Bit Flip Error',
    [EventCardType.HEISENBERG]: 'Heisenberg',
    [EventCardType.QUANTUM_SHUFFLE]: 'Quantum Shuffle',
    [EventCardType.QUANTUM_TUNNEL]: 'Quantum Tunnel',
    [EventCardType.SCHRODINGER]: 'Schrödinger',
    [EventCardType.SPOOKY_ACTION]: 'Spooky Action',
    [EventCardType.THE_MECHANIC]: 'The Mechanic',
    [EventCardType.WAVE_FUNCTION_COLLAPSE]: 'Wave Function Collapse',
  };
  return names[e] ?? e;
}

// ── legal move helpers for UI ─────────────────────────────────────────────────

export function canUseQubitInterconnect(state: GameState): boolean {
  return (
    state.phase === GamePhase.ACTION_SELECT &&
    state.shipPositions[0] === state.shipPositions[1] &&
    anyPlayerHas(state, ComponentType.QUBIT_INTERCONNECT)
  );
}

export function getPlayableCards(state: GameState): boolean[] {
  const p = state.currentPlayer;
  return state.hands[p].map(() => true); // all cards playable; destinations filtered elsewhere
}

export function getNavigationDestinations(state: GameState, cardIndex: number): Planet[] {
  const p = state.currentPlayer;
  const card = state.hands[p][cardIndex];
  if (!card) return [];

  const [pos0, pos1] = state.shipPositions;
  const myPos = p === 0 ? pos0 : pos1;
  const otherPos = p === 0 ? pos1 : pos0;
  const myGalaxy = PLANET_GALAXY[myPos];
  const otherGalaxy = PLANET_GALAXY[otherPos];

  if (myGalaxy === Galaxy.ENTANGLION) {
    if (card === CardType.CNOT && isBellState(myPos)) {
      const exit = getEntanglionExit(myPos);
      return exit ? [exit[0]] : [];
    }
    const dest = getEntanglionDestination(myPos, card, p);
    return dest ? [dest] : [];
  }

  if (card === CardType.SWAP && otherGalaxy !== Galaxy.ENTANGLION) {
    return [otherPos];
  }

  if (card === CardType.CNOT && myGalaxy === Galaxy.CENTARIOUS && otherGalaxy === Galaxy.SUPERIOUS) {
    const dest = getEntanglionEntry(myPos, otherPos);
    return dest ? [dest] : [];
  }

  const newPos = getOutsideTransition(myPos, otherPos, card);
  if (!newPos || newPos === myPos) return [];
  return [newPos];
}
