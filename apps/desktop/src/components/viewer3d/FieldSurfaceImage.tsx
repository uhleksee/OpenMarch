import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getFieldImageLayout } from "./viewer3d.utils";

const MAX_TARP_TEXTURE_SIZE = 2048;

const createTarpTexture = (
    image: HTMLImageElement,
    maxAnisotropy: number,
): { texture: THREE.Texture; downsampled: boolean } => {
    let source: HTMLImageElement | HTMLCanvasElement = image;
    let downsampled = false;
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);

    if (longestSide > MAX_TARP_TEXTURE_SIZE) {
        const scale = MAX_TARP_TEXTURE_SIZE / longestSide;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (context) {
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            source = canvas;
            downsampled = true;
        }
    }

    const texture = new THREE.Texture(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(4, maxAnisotropy);
    texture.needsUpdate = true;
    return { texture, downsampled };
};

interface FieldSurfaceImageProps {
    imageBytes: Uint8Array;
    fieldWidth: number;
    fieldDepth: number;
    mode: "fill" | "fit";
    opacity: number;
    onReady?: () => void;
}

export default function FieldSurfaceImage({
    imageBytes,
    fieldWidth,
    fieldDepth,
    mode,
    opacity,
    onReady,
}: FieldSurfaceImageProps) {
    const maxAnisotropy = useThree((state) =>
        state.gl.capabilities.getMaxAnisotropy(),
    );
    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        let disposed = false;
        let loadedTexture: THREE.Texture | null = null;
        let sourceImage: HTMLImageElement | null = new Image();
        const objectUrl = URL.createObjectURL(
            new Blob([imageBytes as unknown as BlobPart]),
        );
        let objectUrlReleased = false;
        const releaseObjectUrl = () => {
            if (objectUrlReleased) return;
            URL.revokeObjectURL(objectUrl);
            objectUrlReleased = true;
        };
        const image = sourceImage;

        setTexture(null);
        setImageSize({ width: 0, height: 0 });
        image.decoding = "async";
        image.onload = () => {
            if (disposed) return;
            const result = createTarpTexture(image, maxAnisotropy);
            loadedTexture = result.texture;
            setImageSize({
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
            setTexture(loadedTexture);
            releaseObjectUrl();
            onReady?.();

            // The canvas is now the texture source, so allow the browser to
            // release the original full-resolution decode immediately.
            if (result.downsampled) {
                image.onload = null;
                image.onerror = null;
                image.removeAttribute("src");
                sourceImage = null;
            }
        };
        image.onerror = () => {
            if (!disposed) {
                console.warn("Unable to decode the 3D field image");
                releaseObjectUrl();
                onReady?.();
            }
        };
        image.src = objectUrl;

        return () => {
            disposed = true;
            if (sourceImage) {
                sourceImage.onload = null;
                sourceImage.onerror = null;
                sourceImage.removeAttribute("src");
            }
            loadedTexture?.dispose();
            releaseObjectUrl();
        };
    }, [imageBytes, maxAnisotropy, onReady]);

    const layout = useMemo(
        () =>
            getFieldImageLayout(
                fieldWidth,
                fieldDepth,
                imageSize.width,
                imageSize.height,
                mode,
            ),
        [fieldDepth, fieldWidth, imageSize.height, imageSize.width, mode],
    );

    useEffect(() => {
        if (!texture || !layout) return;
        texture.repeat.set(layout.repeatX, layout.repeatY);
        texture.offset.set(layout.offsetX, layout.offsetY);
        texture.needsUpdate = true;
    }, [layout, texture]);

    if (!texture || !layout) return null;

    const safeOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
    return (
        <mesh
            position={[0, 0.028, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            renderOrder={0}
        >
            <planeGeometry args={[layout.width, layout.depth]} />
            <meshToonMaterial
                map={texture}
                transparent
                opacity={safeOpacity}
                depthWrite={safeOpacity >= 1}
                alphaTest={0.001}
            />
        </mesh>
    );
}
