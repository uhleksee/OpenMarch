import { ComponentType } from "react";
import { Html } from "@react-three/drei";

export interface MarcherModelProps {
    color: string;
}

export type MarcherModelComponent = ComponentType<MarcherModelProps>;

/**
 * First-pass marcher geometry. A GLB-backed component can implement
 * MarcherModelProps and be passed to Marcher3D without changing scene placement.
 */
export function PlaceholderMarcherModel({ color }: MarcherModelProps) {
    return (
        <group>
            <mesh position={[0, 1.35, 0]} castShadow>
                <capsuleGeometry args={[0.34, 1.15, 6, 12]} />
                <meshStandardMaterial color={color} roughness={0.72} />
            </mesh>
            <mesh position={[0, 2.35, 0]} castShadow>
                <sphereGeometry args={[0.38, 16, 12]} />
                <meshStandardMaterial color="#f2c9a5" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.12, 0]} receiveShadow>
                <cylinderGeometry args={[0.46, 0.46, 0.12, 20]} />
                <meshStandardMaterial color="#111827" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.65, -0.3]} castShadow>
                <boxGeometry args={[0.62, 0.42, 0.18]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.65} />
            </mesh>
        </group>
    );
}

interface Marcher3DProps {
    drillNumber: string;
    color: string;
    labelVisible: boolean;
    model?: MarcherModelComponent;
}

export default function Marcher3D({
    drillNumber,
    color,
    labelVisible,
    model: Model = PlaceholderMarcherModel,
}: Marcher3DProps) {
    return (
        <group>
            <Model color={color} />
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
