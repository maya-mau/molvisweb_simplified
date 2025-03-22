import * as THREE from 'three';

function createInstancedMesh(atoms, bonds) {
    const scene = new THREE.Scene();
    
    // Create instanced mesh for atoms
    const atomGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const atomMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const atomMesh = new THREE.InstancedMesh(atomGeometry, atomMaterial, atoms.length);
    
    const dummy = new THREE.Object3D();
    atoms.forEach((atom, index) => {
        dummy.position.set(atom.x, atom.y, atom.z);
        dummy.updateMatrix();
        atomMesh.setMatrixAt(index, dummy.matrix);
    });
    atomMesh.instanceMatrix.needsUpdate = true;
    scene.add(atomMesh);
    
    // Create instanced mesh for bonds
    const bondGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
    const bondMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    const bondMesh = new THREE.InstancedMesh(bondGeometry, bondMaterial, bonds.length);
    
    bonds.forEach((bond, index) => {
        const start = new THREE.Vector3(bond.start.x, bond.start.y, bond.start.z);
        const end = new THREE.Vector3(bond.end.x, bond.end.y, bond.end.z);
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const dir = new THREE.Vector3().subVectors(end, start);
        const length = dir.length();
        dir.normalize();
        
        // Set position
        dummy.position.copy(mid);
        
        // Align with bond direction
        const axis = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, dir);
        dummy.quaternion.copy(quaternion);
        
        // Scale to correct length
        dummy.scale.set(1, length, 1);
        
        dummy.updateMatrix();
        bondMesh.setMatrixAt(index, dummy.matrix);
    });
    bondMesh.instanceMatrix.needsUpdate = true;
    scene.add(bondMesh);
    
    return scene;
}

export { createInstancedMesh };
