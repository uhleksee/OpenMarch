import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { getGeometrySignature } from "../BatchedMarcherLayer";

describe("batched marcher geometry", () => {
    it("groups matching primitives into the same instance pool", () => {
        expect(getGeometrySignature(new THREE.BoxGeometry(1, 2, 3))).toBe(
            getGeometrySignature(new THREE.BoxGeometry(1, 2, 3)),
        );
    });

    it("keeps differently sized primitives in separate pools", () => {
        expect(
            getGeometrySignature(new THREE.SphereGeometry(0.4, 8, 6)),
        ).not.toBe(getGeometrySignature(new THREE.SphereGeometry(0.6, 8, 6)));
    });
});
