import { ComponentType, memo } from "react";
import { Html } from "@react-three/drei";
import ToonMarcherModel from "./ToonMarcherModel";
import type { UniformStyle } from "./viewer3d.types";

export interface MarcherModelProps {
    color: string;
    variantSeed: number;
    uniformStyle: UniformStyle;
    motionRef: MarcherMotionRef;
}

export interface MarcherMotionRef {
    current: boolean;
    legFacing: number;
}

export type MarcherModelComponent = ComponentType<MarcherModelProps>;

interface Marcher3DProps {
    marcherId: number;
    drillNumber: string;
    color: string;
    labelVisible: boolean;
    uniformStyle: UniformStyle;
    motionRef: MarcherMotionRef;
    model?: MarcherModelComponent;
}

function Marcher3D({
    marcherId,
    drillNumber,
    color,
    labelVisible,
    uniformStyle,
    motionRef,
    model: Model = ToonMarcherModel,
}: Marcher3DProps) {
    return (
        <group>
            <Model
                color={color}
                variantSeed={marcherId}
                uniformStyle={uniformStyle}
                motionRef={motionRef}
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
