import { ComponentType } from "react";
import { Html } from "@react-three/drei";
import ToonMarcherModel from "./ToonMarcherModel";

export interface MarcherModelProps {
    color: string;
    variantSeed: number;
}

export type MarcherModelComponent = ComponentType<MarcherModelProps>;

interface Marcher3DProps {
    marcherId: number;
    drillNumber: string;
    color: string;
    labelVisible: boolean;
    model?: MarcherModelComponent;
}

export default function Marcher3D({
    marcherId,
    drillNumber,
    color,
    labelVisible,
    model: Model = ToonMarcherModel,
}: Marcher3DProps) {
    return (
        <group>
            <Model color={color} variantSeed={marcherId} />
            {labelVisible && (
                <Html
                    position={[0, 3.05, 0]}
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
