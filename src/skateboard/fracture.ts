import * as THREE from 'three';
import type { SkateboardSettingsValue } from './settings';
/** Cut the actual textured deck, preserving every UV channel and material
 * group. The source geometry is borrowed and is never changed or disposed. */
export function sliceBoardGeometry(source: THREE.BufferGeometry, side: -1 | 1): THREE.BufferGeometry {
    const names = Object.keys(source.attributes);
    const output = Object.fromEntries(names.map(name => [name, [] as number[]]));
    const position = source.getAttribute('position');
    const index = source.getIndex();
    const groups = source.groups.length ? source.groups : [{ start: 0, count: index?.count ?? position.count, materialIndex: 0 }];
    const result = new THREE.BufferGeometry();
    type Vertex = Record<string, number[]>;
    const read = (i: number): Vertex => Object.fromEntries(names.map(name => {
        const a = source.getAttribute(name);
        return [name, Array.from({ length: a.itemSize }, (_, c) => a.getComponent(i, c))];
    }));
    for (const group of groups) {
        const start = output.position.length / 3;
        for (let i = group.start; i < group.start + group.count; i += 3) {
            const triangle = [0, 1, 2].map(j => read(index ? index.getX(i + j) : i + j));
            const clipped: Vertex[] = [];
            for (let j = 0; j < 3; j++) {
                const a = triangle[j], b = triangle[(j + 1) % 3];
                const da = a.position[2] * side, db = b.position[2] * side;
                if (da >= 0)
                    clipped.push(a);
                if ((da >= 0) !== (db >= 0)) {
                    const t = da / (da - db);
                    clipped.push(Object.fromEntries(names.map(name => [name,
                        a[name].map((v, k) => v + (b[name][k] - v) * t),
                    ])));
                }
            }
            for (let j = 1; j < clipped.length - 1; j++) {
                for (const v of [clipped[0], clipped[j], clipped[j + 1]])
                    for (const name of names)
                        output[name].push(...v[name]);
            }
        }
        const count = output.position.length / 3 - start;
        if (count)
            result.addGroup(start, count, group.materialIndex);
    }
    for (const name of names)
        result.setAttribute(name, new THREE.Float32BufferAttribute(output[name], source.getAttribute(name).itemSize));
    result.computeVertexNormals();
    result.computeBoundingBox();
    result.computeBoundingSphere();
    result.name = `discarded-deck-${side > 0 ? 'nose' : 'tail'}`;
    return result;
}
/** Per-level fracture resources; detached boards continue borrowing their
 * original textures, wheels and trucks, even after the live board is rebuilt. */
export class BoardFractures {
    private slices = new Map<THREE.BufferGeometry, [
        THREE.BufferGeometry,
        THREE.BufferGeometry
    ]>();
    private edges = new Map<THREE.BufferGeometry, [
        THREE.BufferGeometry,
        THREE.BufferGeometry,
        THREE.BufferGeometry
    ]>();
    private owned = new Set<THREE.BufferGeometry>();
    private wood = new THREE.MeshBasicMaterial({ color: 0xc79958, side: THREE.DoubleSide });
    split(source: THREE.Group): [
        THREE.Group,
        THREE.Group
    ] {
        source.updateWorldMatrix(true, true);
        const inverse = source.matrixWorld.clone().invert();
        const halves: [
            THREE.Group,
            THREE.Group
        ] = [new THREE.Group(), new THREE.Group()];
        halves[0].name = 'snapped-board-nose';
        halves[1].name = 'snapped-board-tail';
        for (const half of halves)
            half.userData.settings = source.userData.settings;
        source.traverseVisible(object => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh || !mesh.geometry)
                return;
            const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
            if (mesh.name === 'Deck_ContinuousRoundedKick') {
                let slices = this.slices.get(mesh.geometry);
                if (!slices) {
                    slices = [sliceBoardGeometry(mesh.geometry, 1), sliceBoardGeometry(mesh.geometry, -1)];
                    this.slices.set(mesh.geometry, slices);
                    for (const geometry of slices)
                        this.owned.add(geometry);
                }
                for (let i = 0; i < 2; i++) {
                    const piece = new THREE.Mesh(slices[i], mesh.material);
                    piece.name = 'Deck_ContinuousRoundedKick';
                    matrix.decompose(piece.position, piece.quaternion, piece.scale);
                    halves[i].add(piece);
                }
            }
            else {
                mesh.geometry.computeBoundingBox();
                const center = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(matrix);
                const piece = new THREE.Mesh(mesh.geometry, mesh.material);
                piece.name = mesh.name;
                matrix.decompose(piece.position, piece.quaternion, piece.scale);
                halves[center.z >= 0 ? 0 : 1].add(piece);
            }
        });
        const settings = source.userData.settings as SkateboardSettingsValue;
        const deck = source.getObjectByName('Deck_ContinuousRoundedKick') as THREE.Mesh | undefined;
        if (settings && deck) {
            const scale = settings.overallScale;
            const width = settings.deckHalfWidth * 2 * scale;
            const thickness = settings.deckThickness * scale;
            const y = (settings.boardToGroundDistance - settings.deckThickness * 0.5) * scale;
            // Raw wood at the split, plus a few exaggerated torn plywood teeth.
            let edges = this.edges.get(deck.geometry);
            if (!edges) {
                const cap = new THREE.BoxGeometry(width, thickness, 0.008 * scale);
                this.owned.add(cap);
                const teeth: THREE.BufferGeometry[] = [];
                for (let i = 0; i < 2; i++) {
                    const vertices: number[] = [];
                    for (let tooth = 0; tooth < 7; tooth++) {
                        const x = -width / 2 + width * (tooth + 0.2) / 7;
                        const tip = (i === 0 ? -1 : 1) * (0.018 + (tooth % 3) * 0.012) * scale;
                        vertices.push(x, y + thickness / 2, 0, x + width / 10, y + thickness / 2, 0, x + width / 18, y, tip);
                    }
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    geometry.computeVertexNormals();
                    this.owned.add(geometry);
                    teeth.push(geometry);
                }
                edges = [cap, teeth[0], teeth[1]];
                this.edges.set(deck.geometry, edges);
            }
            for (let i = 0; i < 2; i++) {
                const edge = new THREE.Mesh(edges[0], this.wood);
                edge.position.set(0, y, 0);
                halves[i].add(edge);
                halves[i].add(new THREE.Mesh(edges[i + 1], this.wood));
            }
        }
        return halves;
    }
    dispose(): void {
        for (const geometry of this.owned)
            geometry.dispose();
        this.owned.clear();
        this.slices.clear();
        this.edges.clear();
        this.wood.dispose();
    }
}
