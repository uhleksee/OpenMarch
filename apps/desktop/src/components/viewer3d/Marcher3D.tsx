import { ComponentType, memo } from "react";
import { Html } from "@react-three/drei";
import ToonMarcherModel from "./ToonMarcherModel";
import type { UniformStyle } from "./viewer3d.types";
import { getInstrumentPose, type InstrumentPose } from "./marcherPose";

export interface MarcherModelProps {
    color: string;
    variantSeed: number;
    uniformStyle: UniformStyle;
    motionRef: MarcherMotionRef;
    gaitRef: MarcherGaitRef;
    instrumentPose: InstrumentPose;
}

export interface MarcherMotionRef {
    current: boolean;
    legFacing: number;
}

/** Shared mutable phase so every marcher plants on the same musical count. */
export interface MarcherGaitRef {
    phase: number;
}

export type MarcherModelComponent = ComponentType<MarcherModelProps>;

interface Marcher3DProps {
    marcherId: number;
    drillNumber: string;
    section: string;
    color: string;
    labelVisible: boolean;
    uniformStyle: UniformStyle;
    motionRef: MarcherMotionRef;
    gaitRef: MarcherGaitRef;
    model?: MarcherModelComponent;
}

function Marcher3D({
    marcherId,
    drillNumber,
    section,
    color,
    labelVisible,
    uniformStyle,
    motionRef,
    gaitRef,
    model: Model = ToonMarcherModel,
}: Marcher3DProps) {
    return (
        <group>
            <Model
                color={color}
                variantSeed={marcherId}
                uniformStyle={uniformStyle}
                motionRef={motionRef}
                gaitRef={gaitRef}
                instrumentPose={getInstrumentPose(section)}
            />
            {labelVisible && (
                <Html
                    position={[0, 4.15, 0]}
                    center
                    distanceFactor={18}
                    style={{ pointerEvents: "none" }}
                >
                    <span className="border-stroke bg-bg-1/90 text-text rounded-4 border px-4 py-2 font-mono text-xs whitespace-nowrap shadow-sm">
                        {drillNumber}
                    </span>
                </Html>
            )}
        </group>
    );
}

export default memo(Marcher3D);
