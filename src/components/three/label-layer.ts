import * as THREE from "three";
import type { Camera } from "three";

/*
   3D anchors, HTML labels.

   Text drawn inside a WebGL canvas is either a bitmap that goes soft the
   moment you zoom, or a whole font-mesh pipeline. Neither is worth it when
   the page already has typography: the labels are ordinary DOM, positioned
   each frame from their world anchors, so they stay crisp at any zoom, use
   the site's own type, and are selectable and readable by a screen reader.

   Positions are written straight to style.transform inside the render loop.
   Routing them through React state would re-render the tree sixty times a
   second to move some text.
*/

export interface Anchor {
  id: string;
  position: [number, number, number];
  /** Pixels to nudge the label off its anchor, so it clears the mark. */
  offset?: [number, number];
}

const v = new THREE.Vector3();

export function projectLabels(
  anchors: Anchor[],
  nodes: Map<string, HTMLElement>,
  camera: Camera,
  width: number,
  height: number
): void {
  for (const a of anchors) {
    const node = nodes.get(a.id);
    if (!node) continue;

    v.set(a.position[0], a.position[1], a.position[2]).project(camera);

    /* z outside [-1, 1] means the anchor is behind the camera or past the far
       plane. Without this check a label behind the viewer reappears mirrored
       on the opposite side of the screen, which looks like a bug and is. */
    if (v.z < -1 || v.z > 1) {
      node.style.opacity = "0";
      node.style.pointerEvents = "none";
      continue;
    }

    const x = (v.x * 0.5 + 0.5) * width + (a.offset?.[0] ?? 0);
    const y = (-v.y * 0.5 + 0.5) * height + (a.offset?.[1] ?? 0);

    node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    node.style.opacity = "1";
  }
}
