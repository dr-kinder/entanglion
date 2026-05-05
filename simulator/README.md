# Entanglion — Browser Simulator

A two-player browser emulator for the [Entanglion](https://github.com/Entanglion/entanglion) cooperative board game by IBM Research.

Two players sit at the same computer and take turns. No server, account, or internet connection needed — everything runs locally in the browser.

## Requirements

- A terminal / command prompt. On macOS this is the **Terminal** app; on Windows, **Command Prompt** or **PowerShell**.
- [Node.js](https://nodejs.org/) version 18 or later. Download the **LTS** release from nodejs.org and run the installer. To check whether it is already installed, open a terminal and type `node --version`.
- A modern web browser (Chrome, Firefox, Safari, or Edge).

## Getting Started

**1. Clone the repository**

```bash
git clone https://github.com/dr-kinder/entanglion.git
```

This creates a folder called `entanglion` on your computer.

**2. Move into the simulator folder**

```bash
cd entanglion/simulator
```

**3. Install dependencies**

```bash
npm install
```

This downloads the packages the simulator needs. It only needs to be done once.

**4. Start the simulator**

```bash
npm run dev
```

**5. Open your browser**

Go to **http://localhost:5173**. The game will be running. Two players share the same browser window and take turns clicking.

To stop the simulator, go back to the terminal and press **Ctrl-C**.

## How to Play

See the [full rulebook](../game/README.md) in the parent directory. Quick reference:

**Goal:** Collect all 8 quantum components from the Entanglion galaxy before the detection rate reaches X.

**On your turn, do ONE of:**
- **Navigate** — click a card in your hand to move your ship (draws a replacement)
- **Exchange** — click the ↩ button under a card to discard it and draw a fresh one
- **Retrieve** — click the 🔬 Retrieve button to attempt collecting a component at your current Entanglion planet
- **Play Event** — click an event card you're holding (Bennett, Heisenberg, Quantum Tunnel, The Mechanic)

**Board colors:**
- Purple = Centarious (classical states: ZERO = |0⟩, ONE = |1⟩)
- Green = Superious (superposition states: PLUS = |+⟩, MINUS = |−⟩)
- Yellow = Entanglion (entangled states — the goal zone)
- Red lines = moves available to Rubicon (Player 1)
- Blue lines = moves available to Mercurial (Player 2)
- Green lines = same result for both players

**Ships:** R = Rubicon (red, Player 1), M = Mercurial (blue, Player 2)

**Entry to Entanglion:** One ship must be in Centarious, the other in Superious. The Centarious ship plays CNOT to enter.

**Orbital defenses:** Each time you navigate to an Entanglion planet, roll the Entanglion die. Beat the detection rate to proceed. Fail, and both ships jump to a random Centarious planet, the detection rate rises, and a quantum event is drawn.

## License

This simulator is based on [Entanglion](https://github.com/Entanglion/entanglion) by IBM Research (Maryam Ashoori, Justin D. Weisz), licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). This adaptation is also released under CC BY-NC-SA 4.0.

## Implementation Notes

- Dilution Refrigerator auto-discards the last card in hand when retrieved; in the physical game you choose which.
- Magnetic Shielding: a reroll button appears during orbital defense rolls.
