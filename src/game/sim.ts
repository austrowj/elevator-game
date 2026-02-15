#!/usr/bin/env npx ts-node

// --- Passenger types ---

type PassengerKind = "Passenger" | "Brick" | "VIP" | "Mechanic";

type Passenger = {
    kind: PassengerKind;
    targetFloor: number;
}

// --- Core data structures ---

type Elevator = {
    floor: number;
    doorsOpen: boolean;
    goingTo: number[];
    capacity: number;
    passengers: Passenger[];
}

type Floor = {
    passengers: Passenger[];
}

type Config = {
    arrivalRate: number;
}

type State = {
    config: Config;
    score: number;
    failed: boolean;
    timeRemaining: number;
    floors: Floor[];
    elevators: Elevator[];
    events: string[];
}

type Action = {
    type: "go",
    elevator: number;
    targetFloor: number;
} | {
    type: "dump",
    elevator: number;
} | {
    type: "close",
    elevator: number;
} | {
    type: "tick";
};

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
                passenger = { kind, targetFloor };
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

export function handleAction(state: State, action: Action): State {
    switch (action.type) {
        case "tick":
            return update(state);

        case "go":
            state.elevators[action.elevator].goingTo.push(action.targetFloor);
            break;

        case "dump":
            const elevator = state.elevators[action.elevator];
            state.events.push(`${elevator.passengers.length} passengers dumped into the pit.`);
            elevator.passengers = [];
            break;

        case "close":
            state.events.push(`🔒 Forcibly closed elevator ${action.elevator}'s door.`);
            state.elevators[action.elevator].doorsOpen = false;
            break;
    }

    return state;
}

export const defaultInitialState: State = {
    config: { arrivalRate: 0.3 },
    score: 0,
    failed: false,
    timeRemaining: 110,
    floors: Array.from({ length: 7 }, () => ({ passengers: [] })),
    elevators: Array.from({ length: 1 }, () => ({
        floor: 0,
        doorsOpen: true,
        goingTo: [],
        capacity: 5,
        passengers: [],
    })),
    events: [],
};
