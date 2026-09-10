import type { InstrumentKind } from "./instrumentCatalog";
import type { InstrumentFinish } from "./viewer3d.types";
import { STORYBOOK_THEME } from "./sceneTheme";

export interface EquipmentModelProps {
    kind: InstrumentKind;
    finish: InstrumentFinish;
    accentColor: string;
}

const finishColors = {
    brass: { light: "#f4c75c", dark: "#a96d27" },
    silver: { light: "#dce8e9", dark: "#819497" },
} as const;

function Bell({ color, scale = 1 }: { color: string; scale?: number }) {
    return (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={scale}>
            <cylinderGeometry args={[0.27, 0.1, 0.42, 10, 1, true]} />
            <meshToonMaterial color={color} side={2} />
        </mesh>
    );
}

function ValveHorn({
    kind,
    light,
    dark,
}: {
    kind: "trumpet" | "mellophone" | "baritone";
    light: string;
    dark: string;
}) {
    const isBaritone = kind === "baritone";
    const isMellophone = kind === "mellophone";
    const hornScale = isBaritone ? 1.28 : isMellophone ? 1.12 : 0.94;

    return (
        <group position={[0, isBaritone ? 1.48 : 1.82, 0.92]} scale={hornScale}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.065, 0.065, 1.18, 8]} />
                <meshToonMaterial color={light} />
            </mesh>
            <group position={[0, 0, 0.72]}>
                <Bell color={light} scale={isBaritone ? 1.35 : 1} />
            </group>
            {[-0.14, 0, 0.14].map((x) => (
                <mesh key={x} position={[x, 0.17, 0.1]}>
                    <cylinderGeometry args={[0.045, 0.045, 0.32, 6]} />
                    <meshToonMaterial color={dark} />
                </mesh>
            ))}
            <mesh position={[0, -0.22, 0.05]}>
                <torusGeometry args={[0.24, 0.045, 6, 12]} />
                <meshToonMaterial color={dark} />
            </mesh>
        </group>
    );
}

function Trombone({ light, dark }: { light: string; dark: string }) {
    return (
        <group position={[0, 1.72, 1.05]}>
            {[-0.11, 0.11].map((x) => (
                <mesh
                    key={x}
                    position={[x, 0, 0.36]}
                    rotation={[Math.PI / 2, 0, 0]}
                >
                    <cylinderGeometry args={[0.035, 0.035, 1.9, 6]} />
                    <meshToonMaterial color={light} />
                </mesh>
            ))}
            <mesh position={[0, -0.1, 1.32]}>
                <torusGeometry args={[0.11, 0.035, 6, 10, Math.PI]} />
                <meshToonMaterial color={dark} />
            </mesh>
            <group position={[0, 0.03, -0.7]} rotation={[0, Math.PI, 0]}>
                <Bell color={light} scale={1.15} />
            </group>
        </group>
    );
}

function Tuba({ light, dark }: { light: string; dark: string }) {
    return (
        <group position={[0, 1.55, 0.12]}>
            <mesh>
                <torusGeometry args={[0.72, 0.095, 7, 18]} />
                <meshToonMaterial color={light} />
            </mesh>
            <mesh position={[0.58, 0.62, 0]}>
                <torusGeometry args={[0.3, 0.07, 6, 14, Math.PI * 1.5]} />
                <meshToonMaterial color={dark} />
            </mesh>
            <group position={[0.57, 1.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <Bell color={light} scale={1.65} />
            </group>
        </group>
    );
}

function Flute({ light, dark }: { light: string; dark: string }) {
    return (
        <group position={[0, 1.9, 0.58]} rotation={[0, 0, Math.PI / 2]}>
            <mesh>
                <cylinderGeometry args={[0.045, 0.045, 1.65, 8]} />
                <meshToonMaterial color={light} />
            </mesh>
            {[-0.5, -0.18, 0.16, 0.48].map((y) => (
                <mesh key={y} position={[0, y, 0.045]}>
                    <sphereGeometry args={[0.065, 6, 4]} />
                    <meshToonMaterial color={dark} />
                </mesh>
            ))}
        </group>
    );
}

function Clarinet({ light, dark }: { light: string; dark: string }) {
    return (
        <group position={[0, 1.42, 0.66]} rotation={[0.25, 0, 0]}>
            <mesh>
                <cylinderGeometry args={[0.065, 0.075, 1.45, 8]} />
                <meshToonMaterial color="#273138" />
            </mesh>
            <mesh position={[0, 0.82, 0]}>
                <cylinderGeometry args={[0.045, 0.06, 0.2, 8]} />
                <meshToonMaterial color={light} />
            </mesh>
            <mesh position={[0, -0.82, 0]}>
                <cylinderGeometry args={[0.18, 0.08, 0.28, 9]} />
                <meshToonMaterial color={dark} />
            </mesh>
            {[-0.42, -0.12, 0.18, 0.48].map((y) => (
                <mesh key={y} position={[0.075, y, 0]}>
                    <sphereGeometry args={[0.045, 5, 4]} />
                    <meshToonMaterial color={light} />
                </mesh>
            ))}
        </group>
    );
}

function Saxophone({ light, dark }: { light: string; dark: string }) {
    return (
        <group position={[0.08, 1.32, 0.66]} rotation={[0.16, 0, -0.12]}>
            <mesh position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.095, 0.13, 1.2, 8]} />
                <meshToonMaterial color={light} />
            </mesh>
            <mesh position={[0.08, -0.48, 0]} rotation={[0, 0, 0.5]}>
                <torusGeometry args={[0.27, 0.08, 6, 12, Math.PI * 1.25]} />
                <meshToonMaterial color={dark} />
            </mesh>
            <group position={[0.36, -0.64, 0]} rotation={[0, 0, -0.5]}>
                <Bell color={light} scale={0.9} />
            </group>
            <mesh position={[-0.04, 0.9, 0]} rotation={[0, 0, -0.4]}>
                <cylinderGeometry args={[0.035, 0.05, 0.55, 6]} />
                <meshToonMaterial color={dark} />
            </mesh>
        </group>
    );
}

function Drum({
    kind,
    accentColor,
}: {
    kind: "snare" | "bassDrum" | "flubDrum";
    accentColor: string;
}) {
    const isBass = kind === "bassDrum";
    const isFlub = kind === "flubDrum";
    const radius = isBass ? 0.72 : isFlub ? 0.46 : 0.52;
    const depth = isBass ? 0.58 : isFlub ? 0.62 : 0.4;
    const drumRotation: [number, number, number] = isBass
        ? [Math.PI / 2, 0, 0]
        : [0, 0, 0];
    return (
        <group position={[0, isBass ? 1.45 : 1.02, 0.58]}>
            <mesh rotation={drumRotation}>
                <cylinderGeometry args={[radius, radius, depth, 14]} />
                <meshToonMaterial color={accentColor} />
            </mesh>
            {[-depth / 2 - 0.015, depth / 2 + 0.015].map((offset) => (
                <mesh
                    key={offset}
                    position={isBass ? [0, 0, offset] : [0, offset, 0]}
                    rotation={drumRotation}
                >
                    <cylinderGeometry
                        args={[radius * 1.03, radius * 1.03, 0.04, 14]}
                    />
                    <meshToonMaterial color={STORYBOOK_THEME.uniformLight} />
                </mesh>
            ))}
            <mesh position={[-0.32, 0.78, -0.2]} rotation={[0.1, 0, 0.34]}>
                <boxGeometry args={[0.08, 1.45, 0.08]} />
                <meshToonMaterial color={STORYBOOK_THEME.uniformLight} />
            </mesh>
            <mesh position={[0.32, 0.78, -0.2]} rotation={[0.1, 0, -0.34]}>
                <boxGeometry args={[0.08, 1.45, 0.08]} />
                <meshToonMaterial color={STORYBOOK_THEME.uniformLight} />
            </mesh>
        </group>
    );
}

function Tenors({ accentColor }: { accentColor: string }) {
    return (
        <group position={[0, 1.0, 0.62]}>
            {[
                [-0.48, 0.02, 0.36],
                [-0.17, -0.12, 0.3],
                [0.17, -0.12, 0.3],
                [0.48, 0.02, 0.36],
            ].map(([x, y, radius], index) => (
                <mesh key={index} position={[x, y, 0]}>
                    <cylinderGeometry args={[radius, radius, 0.34, 12]} />
                    <meshToonMaterial
                        color={
                            index % 2
                                ? accentColor
                                : STORYBOOK_THEME.uniformLight
                        }
                    />
                </mesh>
            ))}
        </group>
    );
}

function Cymbals({ light, dark }: { light: string; dark: string }) {
    return (
        <group position={[0, 1.42, 0.68]}>
            {[-0.18, 0.18].map((x, index) => (
                <mesh
                    key={x}
                    position={[x, index ? 0.12 : -0.12, 0]}
                    rotation={[Math.PI / 2, 0.15 * (index ? 1 : -1), 0]}
                >
                    <cylinderGeometry args={[0.48, 0.48, 0.055, 16]} />
                    <meshToonMaterial color={index ? light : dark} />
                </mesh>
            ))}
        </group>
    );
}

function Flag({ accentColor }: { accentColor: string }) {
    return (
        <group position={[0.48, 2.12, 0.28]} rotation={[0, 0, -0.16]}>
            <mesh>
                <cylinderGeometry args={[0.035, 0.035, 4.4, 7]} />
                <meshToonMaterial color="#d8e2dc" />
            </mesh>
            <mesh position={[0.74, 1.52, 0]}>
                <boxGeometry args={[1.45, 1.08, 0.035]} />
                <meshToonMaterial color={accentColor} side={2} />
            </mesh>
            <mesh position={[0.92, 1.52, 0.025]}>
                <boxGeometry args={[0.18, 1.08, 0.02]} />
                <meshToonMaterial
                    color={STORYBOOK_THEME.uniformLight}
                    side={2}
                />
            </mesh>
        </group>
    );
}

function Rifle() {
    return (
        <group position={[0, 1.5, 0.58]} rotation={[0, 0, -0.52]}>
            <mesh>
                <boxGeometry args={[0.16, 1.82, 0.12]} />
                <meshToonMaterial color="#eee5d1" />
            </mesh>
            <mesh position={[0.2, -0.55, 0]} rotation={[0, 0, -0.34]}>
                <boxGeometry args={[0.42, 0.46, 0.16]} />
                <meshToonMaterial color="#b89a76" />
            </mesh>
            <mesh position={[0, 0.92, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.35, 6]} />
                <meshToonMaterial color="#d8e2dc" />
            </mesh>
        </group>
    );
}

function Baton({ light, accentColor }: { light: string; accentColor: string }) {
    return (
        <group position={[0, 1.62, 0.58]} rotation={[0, 0, -0.52]}>
            <mesh>
                <cylinderGeometry args={[0.025, 0.025, 1.9, 7]} />
                <meshToonMaterial color={light} />
            </mesh>
            <mesh position={[0, 1.0, 0]}>
                <sphereGeometry args={[0.11, 7, 5]} />
                <meshToonMaterial color={accentColor} />
            </mesh>
        </group>
    );
}

function Keyboard({
    accentColor,
    synthesized,
}: {
    accentColor: string;
    synthesized?: boolean;
}) {
    return (
        <group position={[0, 0.88, 1.0]}>
            <mesh>
                <boxGeometry args={[2.25, 0.3, 0.72]} />
                <meshToonMaterial
                    color={synthesized ? "#37454e" : accentColor}
                />
            </mesh>
            {Array.from({ length: 10 }, (_, index) => (
                <mesh
                    key={index}
                    position={[-0.91 + index * 0.205, 0.18, 0.05]}
                >
                    <boxGeometry args={[0.16, 0.04, 0.46]} />
                    <meshToonMaterial
                        color={
                            index % 3 === 1
                                ? STORYBOOK_THEME.uniformDark
                                : STORYBOOK_THEME.uniformLight
                        }
                    />
                </mesh>
            ))}
            {[-0.86, 0.86].map((x) => (
                <mesh key={x} position={[x, -0.72, -0.08]}>
                    <boxGeometry args={[0.09, 1.35, 0.09]} />
                    <meshToonMaterial color={STORYBOOK_THEME.pole} />
                </mesh>
            ))}
        </group>
    );
}

function AuxPercussion({ accentColor }: { accentColor: string }) {
    return (
        <group position={[0, 1.02, 0.75]}>
            {[-0.32, 0.32].map((x) => (
                <mesh key={x} position={[x, 0, 0]}>
                    <cylinderGeometry args={[0.25, 0.31, 0.62, 9]} />
                    <meshToonMaterial color={accentColor} />
                </mesh>
            ))}
            <mesh position={[0, 0.45, -0.12]}>
                <boxGeometry args={[0.9, 0.08, 0.08]} />
                <meshToonMaterial color={STORYBOOK_THEME.uniformLight} />
            </mesh>
        </group>
    );
}

/**
 * Low-draw-call silhouettes used when an instrument is too far away for its
 * small procedural parts to be visible. The instrument remains readable
 * instead of disappearing completely.
 */
export function SimplifiedMarcherEquipment({
    kind,
    finish,
    accentColor,
}: EquipmentModelProps) {
    const { light, dark } = finishColors[finish];

    if (
        kind === "trumpet" ||
        kind === "mellophone" ||
        kind === "baritone" ||
        kind === "trombone"
    ) {
        return (
            <group position={[0, 1.72, 0.84]}>
                <mesh position={[0, 0, 0.28]}>
                    <boxGeometry args={[0.42, 0.18, 1.3]} />
                    <meshToonMaterial color={light} />
                </mesh>
                <mesh position={[0, 0, 0.94]}>
                    <coneGeometry args={[0.29, 0.48, 7]} />
                    <meshToonMaterial color={dark} />
                </mesh>
            </group>
        );
    }

    if (kind === "tuba") {
        return (
            <mesh position={[0, 1.68, 0.1]}>
                <torusGeometry args={[0.66, 0.16, 5, 9]} />
                <meshToonMaterial color={light} />
            </mesh>
        );
    }

    if (kind === "flute" || kind === "clarinet" || kind === "saxophone") {
        return (
            <mesh
                position={[0, 1.55, 0.58]}
                rotation={[
                    kind === "flute" ? Math.PI / 2 : 0.18,
                    0,
                    kind === "flute" ? Math.PI / 2 : 0,
                ]}
            >
                <capsuleGeometry args={[0.08, 1.25, 2, 5]} />
                <meshToonMaterial
                    color={kind === "clarinet" ? "#273138" : light}
                />
            </mesh>
        );
    }

    if (
        kind === "snare" ||
        kind === "bassDrum" ||
        kind === "flubDrum" ||
        kind === "tenors" ||
        kind === "auxPercussion"
    ) {
        const isBass = kind === "bassDrum";
        return (
            <mesh
                position={[0, isBass ? 1.45 : 1.04, 0.56]}
                rotation={isBass ? [Math.PI / 2, 0, 0] : undefined}
            >
                <cylinderGeometry
                    args={[isBass ? 0.7 : 0.52, isBass ? 0.7 : 0.52, 0.5, 8]}
                />
                <meshToonMaterial color={accentColor} />
            </mesh>
        );
    }

    if (kind === "cymbals") {
        return (
            <mesh position={[0, 1.42, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 0.12, 10]} />
                <meshToonMaterial color={light} />
            </mesh>
        );
    }

    if (kind === "flag") {
        return (
            <group position={[0.42, 2.12, 0.24]} rotation={[0, 0, -0.16]}>
                <mesh>
                    <boxGeometry args={[0.08, 4.3, 0.08]} />
                    <meshToonMaterial color="#d8e2dc" />
                </mesh>
                <mesh position={[0.7, 1.48, 0]}>
                    <boxGeometry args={[1.35, 1, 0.05]} />
                    <meshToonMaterial color={accentColor} />
                </mesh>
            </group>
        );
    }

    if (kind === "rifle" || kind === "baton") {
        return (
            <mesh position={[0, 1.58, 0.56]} rotation={[0, 0, -0.52]}>
                <boxGeometry args={[0.14, 1.9, 0.12]} />
                <meshToonMaterial
                    color={kind === "rifle" ? "#eee5d1" : light}
                />
            </mesh>
        );
    }

    if (kind === "keyboard" || kind === "synthesizer") {
        return (
            <mesh position={[0, 0.9, 0.95]}>
                <boxGeometry args={[2.2, 0.32, 0.7]} />
                <meshToonMaterial color={accentColor} />
            </mesh>
        );
    }

    return null;
}

/**
 * Procedural first-pass equipment. Each instrument lives behind this small
 * interface so a section can later point to a GLB component without changing
 * marcher placement, animation, or drill data.
 */
export default function MarcherEquipment({
    kind,
    finish,
    accentColor,
}: EquipmentModelProps) {
    const { light, dark } = finishColors[finish];

    switch (kind) {
        case "trumpet":
        case "mellophone":
        case "baritone":
            return <ValveHorn kind={kind} light={light} dark={dark} />;
        case "trombone":
            return <Trombone light={light} dark={dark} />;
        case "tuba":
            return <Tuba light={light} dark={dark} />;
        case "flute":
            return <Flute light={light} dark={dark} />;
        case "clarinet":
            return <Clarinet light={light} dark={dark} />;
        case "saxophone":
            return <Saxophone light={light} dark={dark} />;
        case "snare":
        case "bassDrum":
        case "flubDrum":
            return <Drum kind={kind} accentColor={accentColor} />;
        case "tenors":
            return <Tenors accentColor={accentColor} />;
        case "cymbals":
            return <Cymbals light={light} dark={dark} />;
        case "flag":
            return <Flag accentColor={accentColor} />;
        case "rifle":
            return <Rifle />;
        case "baton":
            return <Baton light={light} accentColor={accentColor} />;
        case "keyboard":
            return <Keyboard accentColor={accentColor} />;
        case "synthesizer":
            return <Keyboard accentColor={accentColor} synthesized />;
        case "auxPercussion":
            return <AuxPercussion accentColor={accentColor} />;
        case "none":
        default:
            return null;
    }
}
