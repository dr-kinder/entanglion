import { Planet, CardType, Galaxy, PLANET_GALAXY, BELL_STATES } from './types';
import type { PlayerId } from './types';

// ── Entanglion transition table ───────────────────────────────────────────────
//
// All transitions are derived from quantum mechanics:
//   q1 = Rubicon (player 0 / red),  q2 = Mercurial (player 1 / blue)
//
// Applying a single-qubit gate to one qubit at an entangled state gives a
// different result depending on WHICH qubit is acted on.  The lookup below
// encodes every (from, card, player) → destination.  A missing entry means the
// card has no movement effect from that planet for that player.
//
// Key derivation highlights (verified by Python / numpy):
//
//   H symmetric (same for both players):
//     PHI_PLUS  ↔ OMEGA_TWO
//     PSI_MINUS ↔ OMEGA_ONE
//
//   H player-specific:
//     PSI_PLUS  + H(red)  → OMEGA_ZERO   PSI_PLUS  + H(blue) → OMEGA_THREE
//     PHI_MINUS + H(red)  → OMEGA_THREE  PHI_MINUS + H(blue) → OMEGA_ZERO
//     (reverse paths are symmetric)
//
//   X symmetric (both players, Bell states):
//     PHI_PLUS ↔ PSI_PLUS,  PHI_MINUS ↔ PSI_MINUS
//
//   X player-specific (Omega states):
//     OMEGA_ZERO:  red→OMEGA_ONE,  blue→OMEGA_TWO
//     OMEGA_ONE:   red→OMEGA_ZERO, blue→OMEGA_THREE
//     OMEGA_TWO:   red→OMEGA_THREE,blue→OMEGA_ZERO
//     OMEGA_THREE: red→OMEGA_TWO,  blue→OMEGA_ONE
//
//   CNOT within Entanglion (Omega states only; Bell states always exit):
//     Same destination as X for the same player.
//     OMEGA_ONE + CNOT(either)  → no effect
//     OMEGA_ZERO + CNOT(red)    → no effect
//     OMEGA_THREE + CNOT(blue)  → no effect
//
//   SWAP: OMEGA_ZERO ↔ OMEGA_THREE (both players)

type TransKey = string; // `${Planet}:${CardType}:${PlayerId}`
const T = new Map<TransKey, Planet>();
const t = (from: Planet, card: CardType, player: PlayerId, to: Planet) =>
  T.set(`${from}:${card}:${player}`, to);
const t2 = (from: Planet, card: CardType, to: Planet) => {
  t(from, card, 0, to); t(from, card, 1, to);
};

// H — symmetric
t2(Planet.PHI_PLUS,   CardType.H, Planet.OMEGA_TWO);
t2(Planet.OMEGA_TWO,  CardType.H, Planet.PHI_PLUS);
t2(Planet.PSI_MINUS,  CardType.H, Planet.OMEGA_ONE);
t2(Planet.OMEGA_ONE,  CardType.H, Planet.PSI_MINUS);

// H — player-specific
t(Planet.PSI_PLUS,    CardType.H, 0, Planet.OMEGA_ZERO);
t(Planet.PSI_PLUS,    CardType.H, 1, Planet.OMEGA_THREE);
t(Planet.PHI_MINUS,   CardType.H, 0, Planet.OMEGA_THREE);
t(Planet.PHI_MINUS,   CardType.H, 1, Planet.OMEGA_ZERO);
t(Planet.OMEGA_ZERO,  CardType.H, 0, Planet.PSI_PLUS);
t(Planet.OMEGA_ZERO,  CardType.H, 1, Planet.PHI_MINUS);
t(Planet.OMEGA_THREE, CardType.H, 0, Planet.PHI_MINUS);
t(Planet.OMEGA_THREE, CardType.H, 1, Planet.PSI_PLUS);

// X — Bell states (symmetric)
t2(Planet.PHI_PLUS,  CardType.X, Planet.PSI_PLUS);
t2(Planet.PSI_PLUS,  CardType.X, Planet.PHI_PLUS);
t2(Planet.PHI_MINUS, CardType.X, Planet.PSI_MINUS);
t2(Planet.PSI_MINUS, CardType.X, Planet.PHI_MINUS);

// X — Omega states (player-specific)
t(Planet.OMEGA_ZERO,  CardType.X, 0, Planet.OMEGA_ONE);
t(Planet.OMEGA_ZERO,  CardType.X, 1, Planet.OMEGA_TWO);
t(Planet.OMEGA_ONE,   CardType.X, 0, Planet.OMEGA_ZERO);
t(Planet.OMEGA_ONE,   CardType.X, 1, Planet.OMEGA_THREE);
t(Planet.OMEGA_TWO,   CardType.X, 0, Planet.OMEGA_THREE);
t(Planet.OMEGA_TWO,   CardType.X, 1, Planet.OMEGA_ZERO);
t(Planet.OMEGA_THREE, CardType.X, 0, Planet.OMEGA_TWO);
t(Planet.OMEGA_THREE, CardType.X, 1, Planet.OMEGA_ONE);

// CNOT within Entanglion — Omega states only (Bell states always exit)
// CNOT gives same result as X for the same player, except some have no effect.
t(Planet.OMEGA_TWO,   CardType.CNOT, 0, Planet.OMEGA_THREE);
t(Planet.OMEGA_TWO,   CardType.CNOT, 1, Planet.OMEGA_ZERO);
t(Planet.OMEGA_THREE, CardType.CNOT, 0, Planet.OMEGA_TWO);
t(Planet.OMEGA_ZERO,  CardType.CNOT, 1, Planet.OMEGA_TWO);
// OMEGA_ZERO(red), OMEGA_ONE(any), OMEGA_THREE(blue) → no effect (omitted from map)

// SWAP — symmetric
t2(Planet.OMEGA_ZERO,  CardType.SWAP, Planet.OMEGA_THREE);
t2(Planet.OMEGA_THREE, CardType.SWAP, Planet.OMEGA_ZERO);

// ── public API ────────────────────────────────────────────────────────────────

export function getEntanglionDestination(
  from: Planet, card: CardType, player: PlayerId
): Planet | null {
  return T.get(`${from}:${card}:${player}`) ?? null;
}

// Entry into Entanglion via CNOT (Centarious ship plays, other in Superious)
export function getEntanglionEntry(
  centariousShip: Planet, superiousShip: Planet,
): Planet | null {
  if (centariousShip === Planet.ZERO  && superiousShip === Planet.PLUS)  return Planet.PHI_PLUS;
  if (centariousShip === Planet.ZERO  && superiousShip === Planet.MINUS) return Planet.PHI_MINUS;
  if (centariousShip === Planet.ONE   && superiousShip === Planet.PLUS)  return Planet.PSI_PLUS;
  if (centariousShip === Planet.ONE   && superiousShip === Planet.MINUS) return Planet.PSI_MINUS;
  return null;
}

// Exit Entanglion via CNOT from a Bell state.
// Returns [centariousDestination, superiousDestination].
// The playing ship goes to Centarious; the other goes to Superious.
export function getEntanglionExit(bellState: Planet): [Planet, Planet] | null {
  switch (bellState) {
    case Planet.PHI_PLUS:  return [Planet.ZERO, Planet.PLUS];
    case Planet.PHI_MINUS: return [Planet.ZERO, Planet.MINUS];
    case Planet.PSI_PLUS:  return [Planet.ONE,  Planet.PLUS];
    case Planet.PSI_MINUS: return [Planet.ONE,  Planet.MINUS];
    default: return null;
  }
}

export function isBellState(p: Planet): boolean {
  return (BELL_STATES as readonly Planet[]).includes(p);
}

// Outside-Entanglion transition for one ship (individual movement).
// Returns the new planet for this ship, or null if no movement / special case.
export function getOutsideTransition(
  ship: Planet, otherShip: Planet, card: CardType,
): Planet | null {
  const galaxy = PLANET_GALAXY[ship];
  const otherGalaxy = PLANET_GALAXY[otherShip];

  if (galaxy === Galaxy.ENTANGLION || otherGalaxy === Galaxy.ENTANGLION) return null;

  switch (card) {
    case CardType.X:
      if (ship === Planet.ZERO)  return Planet.ONE;
      if (ship === Planet.ONE)   return Planet.ZERO;
      if (ship === Planet.PLUS)  return Planet.MINUS;
      if (ship === Planet.MINUS) return Planet.PLUS;
      return null;

    case CardType.H:
      if (ship === Planet.ZERO)  return Planet.PLUS;
      if (ship === Planet.ONE)   return Planet.MINUS;
      if (ship === Planet.PLUS)  return Planet.ZERO;
      if (ship === Planet.MINUS) return Planet.ONE;
      return null;

    case CardType.CNOT:
      if (galaxy === Galaxy.CENTARIOUS) {
        if (otherGalaxy === Galaxy.SUPERIOUS) return null; // entry — handled by caller
        // Flip only if other ship is at ONE
        if (otherShip === Planet.ONE) return ship === Planet.ZERO ? Planet.ONE : Planet.ZERO;
        return ship; // no movement
      }
      return ship; // CNOT from Superious has no effect

    case CardType.SWAP:
      return null; // handled by caller (two-ship swap)

    default:
      return null;
  }
}
