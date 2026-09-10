import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ColoredMaterial extends THREE.Material {
    color: THREE.Color;
    map?: THREE.Texture | null;
    alphaMap?: THREE.Texture | null;
}

interface InstanceCandidate {
    source: THREE.Mesh;
    material: ColoredMaterial;
    visibilityAncestors: THREE.Object3D[];
}

interface InstancePool {
    mesh: THREE.InstancedMesh;
    records: InstanceCandidate[];
}

interface MarcherBatchState {
    pools: InstancePool[];
}

interface BatchPerformanceMetricsRef {
    current: {
        batchFrameCount: number;
        batchFrameTotalMs: number;
        batchFrameWorstMs: number;
    };
}

const matrix = new THREE.Matrix4();
const rootInverse = new THREE.Matrix4();

const hasColor = (material: THREE.Material): material is ColoredMaterial =>
    "color" in material && material.color instanceof THREE.Color;

const canBatchMaterial = (
    material: THREE.Material,
): material is ColoredMaterial =>
    hasColor(material) &&
    !material.map &&
    !material.alphaMap &&
    (material instanceof THREE.MeshToonMaterial ||
        material instanceof THREE.MeshBasicMaterial);

export const getGeometrySignature = (
    geometry: THREE.BufferGeometry,
): string => {
    const parameters = (
        geometry as THREE.BufferGeometry & {
            parameters?: unknown;
        }
    ).parameters;
    return `${geometry.type}:${JSON.stringify(parameters ?? {})}`;
};

const isEffectivelyVisible = (candidate: InstanceCandidate): boolean => {
    if (!candidate.source.visible) return false;
    return candidate.visibilityAncestors.every((ancestor) => ancestor.visible);
};

const createPools = (
    candidates: InstanceCandidate[],
    material: THREE.Material,
    transparent: boolean,
): InstancePool[] => {
    const candidatesByGeometry = new Map<string, InstanceCandidate[]>();
    for (const candidate of candidates) {
        const signature = getGeometrySignature(candidate.source.geometry);
        const matchingCandidates = candidatesByGeometry.get(signature) ?? [];
        matchingCandidates.push(candidate);
        candidatesByGeometry.set(signature, matchingCandidates);
    }

    return Array.from(candidatesByGeometry.values()).map(
        (matchingCandidates) => {
            const mesh = new THREE.InstancedMesh(
                matchingCandidates[0].source.geometry,
                material,
                matchingCandidates.length,
            );
            mesh.name = transparent
                ? "Instanced marcher shadows"
                : "Instanced marcher models";
            mesh.frustumCulled = false;
            mesh.matrixAutoUpdate = false;
            mesh.renderOrder = transparent ? -1 : 0;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.raycast = () => undefined;

            mesh.setColorAt(0, matchingCandidates[0].material.color);
            mesh.count = 0;
            if (mesh.instanceColor) {
                mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
            }

            return { mesh, records: matchingCandidates };
        },
    );
};

const collectCandidates = (root: THREE.Group): InstanceCandidate[] => {
    const candidates: InstanceCandidate[] = [];
    root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object instanceof THREE.SkinnedMesh) return;
        if (Array.isArray(object.material)) return;
        if (!canBatchMaterial(object.material)) return;

        const visibilityAncestors: THREE.Object3D[] = [];
        let ancestor = object.parent;
        while (ancestor && ancestor !== root) {
            visibilityAncestors.push(ancestor);
            ancestor = ancestor.parent;
        }
        candidates.push({
            source: object,
            material: object.material,
            visibilityAncestors,
        });
    });
    return candidates;
};

/**
 * Keeps the articulated React scene graph as the animation source, but renders
 * matching procedural pieces through hardware instances. Textured and skinned
 * meshes are left alone so future GLB marcher models can use their own renderer.
 */
export default function BatchedMarcherLayer({
    children,
    rebuildKey,
    measurePerformance,
    performanceMetricsRef,
}: {
    children: ReactNode;
    rebuildKey: string;
    measurePerformance: boolean;
    performanceMetricsRef: BatchPerformanceMetricsRef;
}) {
    const sourceRef = useRef<THREE.Group>(null);
    const batchStateRef = useRef<MarcherBatchState | null>(null);
    const [batchState, setBatchState] = useState<MarcherBatchState | null>(
        null,
    );

    useLayoutEffect(() => {
        const source = sourceRef.current;
        if (!source) return;

        source.updateWorldMatrix(true, true);
        const candidates = collectCandidates(source);
        const opaqueCandidates = candidates.filter(
            (candidate) =>
                !candidate.material.transparent &&
                candidate.material.side !== THREE.DoubleSide,
        );
        const doubleSidedCandidates = candidates.filter(
            (candidate) =>
                !candidate.material.transparent &&
                candidate.material.side === THREE.DoubleSide,
        );
        const transparentCandidates = candidates.filter(
            (candidate) => candidate.material.transparent,
        );
        const solidMaterial = new THREE.MeshToonMaterial({
            color: "white",
        });
        const doubleSidedMaterial = new THREE.MeshToonMaterial({
            color: "white",
            side: THREE.DoubleSide,
        });
        const transparentMaterial = new THREE.MeshBasicMaterial({
            color: "white",
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
        });
        const pools = [
            ...createPools(opaqueCandidates, solidMaterial, false),
            ...createPools(doubleSidedCandidates, doubleSidedMaterial, false),
            ...createPools(transparentCandidates, transparentMaterial, true),
        ];
        const sourceParent = source.parent;
        source.removeFromParent();

        const nextState: MarcherBatchState = { pools };
        batchStateRef.current = nextState;
        setBatchState(nextState);

        return () => {
            if (sourceParent && source.parent !== sourceParent) {
                sourceParent.add(source);
            }
            for (const pool of pools) pool.mesh.dispose();
            solidMaterial.dispose();
            doubleSidedMaterial.dispose();
            transparentMaterial.dispose();
            if (batchStateRef.current === nextState) {
                batchStateRef.current = null;
            }
        };
    }, [rebuildKey]);

    useFrame(() => {
        const source = sourceRef.current;
        const currentBatchState = batchStateRef.current;
        if (!source || !currentBatchState) return;
        const startedAt = measurePerformance ? performance.now() : 0;

        source.updateWorldMatrix(true, true);
        rootInverse.copy(source.matrixWorld).invert();

        for (const pool of currentBatchState.pools) {
            let visibleInstanceCount = 0;
            for (const record of pool.records) {
                if (!isEffectivelyVisible(record)) continue;
                matrix.multiplyMatrices(rootInverse, record.source.matrixWorld);
                pool.mesh.setMatrixAt(visibleInstanceCount, matrix);
                pool.mesh.setColorAt(
                    visibleInstanceCount,
                    record.material.color,
                );
                visibleInstanceCount += 1;
            }
            pool.mesh.count = visibleInstanceCount;
            if (visibleInstanceCount > 0) {
                pool.mesh.instanceMatrix.needsUpdate = true;
            }
            if (visibleInstanceCount > 0 && pool.mesh.instanceColor) {
                pool.mesh.instanceColor.needsUpdate = true;
            }
        }

        if (measurePerformance) {
            const duration = performance.now() - startedAt;
            const metrics = performanceMetricsRef.current;
            metrics.batchFrameCount += 1;
            metrics.batchFrameTotalMs += duration;
            metrics.batchFrameWorstMs = Math.max(
                metrics.batchFrameWorstMs,
                duration,
            );
        }
    });

    return (
        <group>
            <group ref={sourceRef}>{children}</group>
            {batchState?.pools.map((pool) => (
                <primitive key={pool.mesh.uuid} object={pool.mesh} />
            ))}
        </group>
    );
}
