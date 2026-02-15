#!/usr/bin/env npx ts-node

// --- Passenger types ---

type PassengerKind = "Passenger" | "Brick" | "VIP" | "Mechanic";

interface Passenger {
    kind: PassengerKind;
    targetFloor: number;
}

function makePassenger(
    kind: PassengerKind,
    targetFloor: number
): Passenger {
    return { kind, targetFloor };
}

// --- Core data structures ---

interface Elevator {
    floor: number;
    doorsOpen: boolean;
    goingTo: number[];
    capacity: number;
    passengers: Passenger[];
}

interface Floor {
    passengers: Passenger[];
}

interface Config {
    arrivalRate: number;
}

interface State {
    config: Config;
    score: number;
    failed: boolean;
    timeRemaining: number;
    floors: Floor[];
    elevators: Elevator[];
    events: string[];
}

type Action = string;

// --- Passenger pool ---

const passengerPool: [PassengerKind, number][] = [
    ["Passenger", 10],
    ["Brick", 0],
    ["VIP", 3],
    ["Mechanic", 1],
];

const passengerPoolTotal = passengerPool.reduce(
    (sum, [, weight]) => sum + weight,
    0
);

// --- Utility ---

function prettyPrint(state: State): void {
    console.log(JSON.stringify(state, null, 2));
}

// --- Game logic ---

function handleDebark(state: State, passenger: Passenger): State {
    switch (passenger.kind) {
        case "VIP":
        state.score += 11;
        state.events.push("📈  +10 bonus score!");
        break;
        case "Mechanic":
        state.timeRemaining += 20;
        state.events.push("⏳  +20 time gained!");
        break;
        case "Brick":
        state.score -= 5;
        state.events.push("😞 -5 score from delivering brick.");
        break;
        default:
        state.score += 1;
        break;
    }
    return state;
}

function update(state: State): State {
    state.timeRemaining -= 1;

    // Move passengers out of elevators
    for (let i = 0; i < state.elevators.length; i++) {
        const elevator = state.elevators[i];

        if (elevator.doorsOpen) {
        const floor = state.floors[elevator.floor];

        let gettingOut = -1;
        for (let j = 0; j < elevator.passengers.length; j++) {
            if (elevator.passengers[j].targetFloor === elevator.floor) {
            gettingOut = j;
            break;
            }
        }

        if (gettingOut >= 0) {
            // Only the front passenger can get out.
            const passenger = elevator.passengers.shift()!;

            if (passenger.targetFloor === elevator.floor) {
            state.events.push(`🎉 Elevator ${i} dropped off a passenger.`);
            state = handleDebark(state, passenger);
            } else {
            // Push to front of line.
            floor.passengers.unshift(passenger);
            }
        } else if (
            floor.passengers.length > 0 &&
            elevator.passengers.length < elevator.capacity
        ) {
            // Elevator passengers are a stack.
            elevator.passengers.unshift(floor.passengers.shift()!);
            if (elevator.passengers.length === elevator.capacity) {
            state.events.push(`⛔  Elevator ${i} is now full.`);
            }
        } else {
            elevator.doorsOpen = false;
            if (elevator.goingTo.length === 0) {
            state.events.push(`❇️  Elevator ${i} ready to move.`);
            }
        }
        } else if (elevator.goingTo.length > 0) {
        if (elevator.goingTo[0] === elevator.floor) {
            elevator.goingTo.shift();
            elevator.doorsOpen = true;
        } else if (elevator.goingTo[0] < elevator.floor) {
            elevator.floor -= 1;
        } else {
            elevator.floor += 1;
        }
        }
    }

    // Randomly add passengers
    if (Math.random() < state.config.arrivalRate) {
        const originFloor = Math.floor(Math.random() * state.floors.length);

        // Choose among the other floors at random
        let targetFloor = Math.floor(
        Math.random() * (state.floors.length - 1)
        );
        if (targetFloor >= originFloor) {
        targetFloor += 1;
        }

        // Choose among available passengers
        let passengerRoll = Math.floor(Math.random() * passengerPoolTotal);
        let passenger: Passenger | null = null;
        for (const [kind, weight] of passengerPool) {
        if (passengerRoll < weight) {
            passenger = makePassenger(kind, targetFloor);
            break;
        } else {
            passengerRoll -= weight;
        }
        }

        if (passenger === null) {
        throw new Error(
            "Passenger roll mechanism generated an invalid roll."
        );
        }

        state.floors[originFloor].passengers.push(passenger);
        state.events.push(`‼️  New passenger waiting at floor ${originFloor}.`);
    }

    if (state.timeRemaining <= 0) {
        state.failed = true;
        state.events.push(`⌛ Out of time. Final score: ${state.score}`);
    }

    return state;
}

function handleAction(state: State, action: Action): State {
    if (action === "") {
        return update(state);
    } else if (action.startsWith("go")) {
        try {
        const args = action
            .split(" ")
            .slice(1)
            .map((x) => {
            const n = parseInt(x, 10);
            if (isNaN(n)) throw new Error();
            return n;
            });
        if (args.length !== 2) throw new Error();
        if (
            args[0] >= state.elevators.length ||
            args[1] >= state.floors.length
        )
            throw new Error();
        if (args[0] < 0 || args[1] < 0) throw new Error();

        state.elevators[args[0]].goingTo.push(args[1]);
        } catch {
        state.events.push(
            '❌ Invalid "go" command, need <elevator>, <target floor>.'
        );
        }
    } else if (action.startsWith("dump")) {
        try {
        const args = action
            .split(" ")
            .slice(1)
            .map((x) => {
            const n = parseInt(x, 10);
            if (isNaN(n)) throw new Error();
            return n;
            });
        if (args.length !== 1) throw new Error();
        if (args[0] < 0 || args[0] >= state.elevators.length)
            throw new Error();

        const elevator = state.elevators[args[0]];
        if (elevator.floor < state.floors.length - 1) throw new Error();

        state.events.push(
            `${elevator.passengers.length} passengers dumped into the pit.`
        );
        elevator.passengers = [];
        } catch {
        state.events.push(
            `❌ Invalid "dump" command, need <elevator> on floor ${state.floors.length - 1}.`
        );
        }
    } else if (action.startsWith("close")) {
        try {
        const args = action
            .split(" ")
            .slice(1)
            .map((x) => {
            const n = parseInt(x, 10);
            if (isNaN(n)) throw new Error();
            return n;
            });
        if (args.length !== 1) throw new Error();
        if (args[0] < 0 || args[0] >= state.elevators.length)
            throw new Error();

        const elevator = state.elevators[args[0]];

        state.events.push(
            `🔒 Forcibly closed elevator ${args[0]}'s door.`
        );
        elevator.doorsOpen = false;
        } catch {
        state.events.push('❌ Invalid "close" command, need <elevator>.');
        }
    } else {
        state.events.push(`❌ Invalid action: "${action}".`);
    }

    return state;
}

async function mainLoop(initialState: State): Promise<void> {

    let state = initialState;

    // Wait until at least one floor has passengers
    while (
        state.floors.reduce((sum, f) => sum + f.passengers.length, 0) === 0
    ) {
        state = update(state);
    }

    while (!state.failed) {
        console.log();
        prettyPrint(state);

        const action = "";
        state.events = [];
        state = handleAction(state, action);
    }

    console.log();
    prettyPrint(state);
}

// --- Entry point ---

const args = ['7', '3', '0.5']; // Default values for testing

const numFloors = parseInt(args[0], 10);
const numElevators = parseInt(args[1], 10);
const arrivalRate = parseFloat(args[2]);

mainLoop({
  config: { arrivalRate },
  score: 0,
  failed: false,
  timeRemaining: 110,
  floors: Array.from({ length: numFloors }, () => ({ passengers: [] })),
  elevators: Array.from({ length: numElevators }, () => ({
	floor: 0,
	doorsOpen: true,
	goingTo: [],
	capacity: 5,
	passengers: [],
  })),
  events: [],
});