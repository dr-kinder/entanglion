export enum Planet {
  ZERO = 'ZERO',
  ONE = 'ONE',
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  PHI_PLUS = 'PHI_PLUS',
  PHI_MINUS = 'PHI_MINUS',
  PSI_PLUS = 'PSI_PLUS',
  PSI_MINUS = 'PSI_MINUS',
  OMEGA_ZERO = 'OMEGA_ZERO',
  OMEGA_ONE = 'OMEGA_ONE',
  OMEGA_TWO = 'OMEGA_TWO',
  OMEGA_THREE = 'OMEGA_THREE',
}

export enum Galaxy {
  CENTARIOUS = 'CENTARIOUS',
  SUPERIOUS = 'SUPERIOUS',
  ENTANGLION = 'ENTANGLION',
}

export const PLANET_GALAXY: Record<Planet, Galaxy> = {
  [Planet.ZERO]: Galaxy.CENTARIOUS,
  [Planet.ONE]: Galaxy.CENTARIOUS,
  [Planet.PLUS]: Galaxy.SUPERIOUS,
  [Planet.MINUS]: Galaxy.SUPERIOUS,
  [Planet.PHI_PLUS]: Galaxy.ENTANGLION,
  [Planet.PHI_MINUS]: Galaxy.ENTANGLION,
  [Planet.PSI_PLUS]: Galaxy.ENTANGLION,
  [Planet.PSI_MINUS]: Galaxy.ENTANGLION,
  [Planet.OMEGA_ZERO]: Galaxy.ENTANGLION,
  [Planet.OMEGA_ONE]: Galaxy.ENTANGLION,
  [Planet.OMEGA_TWO]: Galaxy.ENTANGLION,
  [Planet.OMEGA_THREE]: Galaxy.ENTANGLION,
};

export const ENTANGLION_PLANETS = [
  Planet.PHI_PLUS, Planet.PHI_MINUS,
  Planet.PSI_PLUS, Planet.PSI_MINUS,
  Planet.OMEGA_ZERO, Planet.OMEGA_ONE,
  Planet.OMEGA_TWO, Planet.OMEGA_THREE,
] as const;

export const BELL_STATES = [
  Planet.PHI_PLUS, Planet.PHI_MINUS,
  Planet.PSI_PLUS, Planet.PSI_MINUS,
] as const;

// Clockwise order from OMEGA_ZERO (for Heisenberg / Spooky Action)
// Roll 1 = OMEGA_ONE, roll 8 = OMEGA_ZERO
export const CLOCKWISE_ORDER: Planet[] = [
  Planet.OMEGA_ZERO,
  Planet.OMEGA_ONE,
  Planet.PSI_MINUS,
  Planet.PHI_MINUS,
  Planet.OMEGA_THREE,
  Planet.OMEGA_TWO,
  Planet.PHI_PLUS,
  Planet.PSI_PLUS,
];

export enum CardType {
  X = 'X',
  H = 'H',
  CNOT = 'CNOT',
  SWAP = 'SWAP',
  PROBE = 'PROBE',
}

export enum ComponentType {
  PHYSICAL_QUBITS = 'PHYSICAL_QUBITS',
  QUBIT_INTERCONNECT = 'QUBIT_INTERCONNECT',
  DILUTION_REFRIGERATOR = 'DILUTION_REFRIGERATOR',
  QUANTUM_GATES = 'QUANTUM_GATES',
  QUANTUM_PROGRAMMING = 'QUANTUM_PROGRAMMING',
  QUANTUM_ERROR_CORRECTION = 'QUANTUM_ERROR_CORRECTION',
  CONTROL_INFRASTRUCTURE = 'CONTROL_INFRASTRUCTURE',
  MAGNETIC_SHIELDING = 'MAGNETIC_SHIELDING',
}

export enum EventCardType {
  BENNETT = 'BENNETT',
  BIT_FLIP_ERROR = 'BIT_FLIP_ERROR',
  HEISENBERG = 'HEISENBERG',
  QUANTUM_SHUFFLE = 'QUANTUM_SHUFFLE',
  QUANTUM_TUNNEL = 'QUANTUM_TUNNEL',
  SCHRODINGER = 'SCHRODINGER',
  SPOOKY_ACTION = 'SPOOKY_ACTION',
  THE_MECHANIC = 'THE_MECHANIC',
  WAVE_FUNCTION_COLLAPSE = 'WAVE_FUNCTION_COLLAPSE',
}

// These event cards are kept in hand until played as an action
export const HOLD_IN_HAND_EVENTS = new Set([
  EventCardType.BENNETT,
  EventCardType.HEISENBERG,
  EventCardType.QUANTUM_TUNNEL,
  EventCardType.THE_MECHANIC,
]);

export type PlayerId = 0 | 1;

// Detection rate scale: [1,2,2,3,3,4,4,5,5,6,7,X]
// X is represented as 99 (instant loss)
export const DETECTION_SCALE = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 99];
export const DETECTION_SCALE_DISPLAY = ['1','2','2','3','3','4','4','5','5','6','7','X'];
export const MAX_DETECTION_INDEX = DETECTION_SCALE.length - 1; // index 11 = X
export const FIRST_FOUR_INDEX = 5; // first '4' on the scale

export enum GamePhase {
  // Normal turn flow
  QUBIT_INTERCONNECT_OPTIONAL = 'QUBIT_INTERCONNECT_OPTIONAL', // free exchange at start
  ACTION_SELECT = 'ACTION_SELECT',

  // After navigate into Entanglion: orbital defense roll
  ORBITAL_DEFENSE_ROLL = 'ORBITAL_DEFENSE_ROLL',

  // After failed orbital defense: Centarious die roll
  ORBITAL_DETECTED_CENTARIOUS_ROLL = 'ORBITAL_DETECTED_CENTARIOUS_ROLL',

  // Retrieve action
  RETRIEVE_ROLL = 'RETRIEVE_ROLL',

  // Event resolution
  EVENT_RESOLVE = 'EVENT_RESOLVE',

  // The Mechanic sub-phase
  THE_MECHANIC_ACTIVE = 'THE_MECHANIC_ACTIVE',

  // PROBE was drawn
  PROBE_ROLL = 'PROBE_ROLL',

  // Heisenberg card played: need die roll
  HEISENBERG_ROLL = 'HEISENBERG_ROLL',

  // Spooky Action: need die roll
  SPOOKY_ACTION_ROLL = 'SPOOKY_ACTION_ROLL',

  // Bennett: choose component to transfer
  BENNETT_SELECT = 'BENNETT_SELECT',

  // Physical Qubits: choose which Centarious planet to place ships
  PHYSICAL_QUBITS_PLACE = 'PHYSICAL_QUBITS_PLACE',

  GAME_OVER = 'GAME_OVER',
}

export enum ActionType {
  NAVIGATE = 'NAVIGATE',
  EXCHANGE = 'EXCHANGE',
  RETRIEVE = 'RETRIEVE',
  PLAY_EVENT = 'PLAY_EVENT',
}

export interface MechanicState {
  savedHand: CardType[];
  drawnCards: CardType[];
  playsRemaining: number;
  bypassDefenses: boolean;
}

export interface GameState {
  shipPositions: [Planet, Planet]; // [ship0=Rubicon/red, ship1=Mercurial/blue]

  hands: [CardType[], CardType[]];
  eventHands: [EventCardType[], EventCardType[]];

  engineBoards: [CardType[], CardType[]]; // played cards in engine control (max 6 each)

  engineDeck: CardType[];
  engineDiscard: CardType[];

  eventDeck: EventCardType[];
  eventDiscard: EventCardType[];

  componentLocations: Partial<Record<Planet, ComponentType>>; // planet → component (if present)
  playerComponents: [ComponentType[], ComponentType[]];

  detectionIndex: number; // index into DETECTION_SCALE

  currentPlayer: PlayerId;
  phase: GamePhase;

  // Pending state for multi-step phases
  pendingNavigationDestination: Planet | null; // set after navigate, before orbital check
  pendingEvents: EventCardType[]; // queue of events to resolve
  mechanicState: MechanicState | null;
  mechanicBypassActive: boolean; // quantum tunnel or mechanic bypass

  // For Physical Qubits placement
  pendingPhysicalQubitsCount: number; // 0 if not active

  gameResult: 'playing' | 'win' | 'loss';
  log: string[];
}
