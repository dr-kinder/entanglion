import {
  GameState, Planet, CardType, ComponentType, EventCardType,
  GamePhase, DETECTION_SCALE,
} from './types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildEngineDeck(): CardType[] {
  const cards: CardType[] = [
    ...Array(8).fill(CardType.H),
    ...Array(7).fill(CardType.CNOT),
    ...Array(5).fill(CardType.X),
    ...Array(3).fill(CardType.SWAP),
  ];
  const shuffled = shuffle(cards);
  // PROBE goes at the bottom
  return [...shuffled, CardType.PROBE];
}

export function buildEventDeck(): EventCardType[] {
  const others = shuffle([
    EventCardType.BENNETT,
    EventCardType.BIT_FLIP_ERROR,
    EventCardType.HEISENBERG,
    EventCardType.QUANTUM_TUNNEL,
    EventCardType.SCHRODINGER,
    EventCardType.SPOOKY_ACTION,
    EventCardType.THE_MECHANIC,
    EventCardType.WAVE_FUNCTION_COLLAPSE,
  ]);
  // Setup: deal 3 to bottom, QS in middle, 5 on top
  // Drawing order (index 0 = first drawn):
  // [top 5 random] [QUANTUM_SHUFFLE] [bottom 3 random]
  // Array index 0 = top of deck (drawn first)
  return [
    ...others.slice(0, 5),
    EventCardType.QUANTUM_SHUFFLE,
    ...others.slice(5, 8),
  ];
}

export function placeComponents(): Partial<Record<Planet, ComponentType>> {
  const planets = [
    Planet.PHI_PLUS, Planet.PHI_MINUS,
    Planet.PSI_PLUS, Planet.PSI_MINUS,
    Planet.OMEGA_ZERO, Planet.OMEGA_ONE,
    Planet.OMEGA_TWO, Planet.OMEGA_THREE,
  ];
  const components = shuffle([
    ComponentType.PHYSICAL_QUBITS,
    ComponentType.QUBIT_INTERCONNECT,
    ComponentType.DILUTION_REFRIGERATOR,
    ComponentType.QUANTUM_GATES,
    ComponentType.QUANTUM_PROGRAMMING,
    ComponentType.QUANTUM_ERROR_CORRECTION,
    ComponentType.CONTROL_INFRASTRUCTURE,
    ComponentType.MAGNETIC_SHIELDING,
  ]);
  const result: Partial<Record<Planet, ComponentType>> = {};
  planets.forEach((p, i) => { result[p] = components[i]; });
  return result;
}

function rollCentarious(): Planet {
  return Math.random() < 0.5 ? Planet.ZERO : Planet.ONE;
}

export function createInitialState(difficulty: 'easy' | 'normal' | 'hard' = 'normal'): GameState {
  const engineDeck = buildEngineDeck();
  const eventDeck = buildEventDeck();
  const componentLocations = placeComponents();

  // Each player draws 3 cards
  const hand0 = engineDeck.splice(0, 3);
  const hand1 = engineDeck.splice(0, 3);

  // Determine first player by die roll (simulate)
  const firstPlayer: 0 | 1 = Math.random() < 0.5 ? 0 : 1;

  // Place ships
  const ship0 = rollCentarious();
  const ship1 = rollCentarious();

  const detectionIndex =
    difficulty === 'easy' ? 0 :
    difficulty === 'hard' ? 3 : 1;

  const startMsg = `Game started! ${firstPlayer === 0 ? 'Rubicon' : 'Mercurial'} goes first. Ships start on ${ship0} and ${ship1}.`;

  return {
    shipPositions: [ship0, ship1],
    hands: [hand0, hand1],
    eventHands: [[], []],
    engineBoard: [],
    engineDeck,
    engineDiscard: [],
    eventDeck,
    eventDiscard: [],
    componentLocations,
    playerComponents: [[], []],
    detectionIndex,
    currentPlayer: firstPlayer,
    phase: GamePhase.ACTION_SELECT,
    pendingNavigationDestination: null,
    pendingEvents: [],
    mechanicState: null,
    mechanicBypassActive: false,
    pendingPhysicalQubitsCount: 0,
    gameResult: 'playing',
    log: [startMsg],
  };
}

export const DETECTION_THRESHOLD = (index: number): number => DETECTION_SCALE[index];
