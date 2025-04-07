import * as THREE from 'three';
import { PDBLoader } from './mymods/PDBLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';


// GLOBAL CONSTANTS
const CPK = 'Ball-and-stick';
const VDW = 'Space filling';
const lines = 'Lines';
const INSTANCED = 'instanced';
const NAIVE = 'naive';

let drawing = [CPK];

const detail = 3; // for icosahedron
let numObjects = 0;

// initialize the baseline objects  
let camera, scene, renderer, container;

scene = new THREE.Scene();
scene.background = new THREE.Color( 0x000000 );
globalThis.scene = scene;

let root = new THREE.Group();

scene.add(root);

container = document.getElementsByClassName('row')[0];

let controls;
let geometryAtoms, geometryBonds, json_atoms, json_bonds;

const PDBloader = new PDBLoader(); 
const offset = new THREE.Vector3();

const defaultParams = {
    repParams: 1, 
    instancedParams: NAIVE,
    drawParams: CPK
}

const containerWidth = 909;
const containerHeight = 454;

let maxRepTabs = defaultParams.repParams;
let instanced = defaultParams.instancedParams;

let autoRotate = true;

init();

// sets up scene, camera, renderer, controls, and GUIs 
function init() {

    setupGUI();
    setupLights();
    setupRenderer();
    
    camera = new THREE.OrthographicCamera(0,0,0,0,0,0);

    loadMolecule( 'ponatinib_Ablkinase_Jun2022.pdb', () => {
        setupCamera();
        setupControls();

        root.visible = true;

        window.addEventListener( 'resize', onWindowResize );
        onWindowResize();
        animate();

        console.log("NUMBER OF OBJECTS", numObjects);
    }); 
}

function setupGUI() {
    let gui = new GUI();

    gui.add(defaultParams, 'repParams', [ 1, 2, 3, 4 ] ).onChange((val) => {
        maxRepTabs = val;
        resetScene();
    });

    gui.add(defaultParams, 'instancedParams', [ INSTANCED, NAIVE ] ).onChange((val) => {
        instanced = val;
        resetScene();
    });

    /* gui.add(defaultParams, 'drawParams', [ CPK, VDW, lines, "all" ] ).onChange((val) => {
        if (val == "all") {
            drawing = [VDW, CPK, lines];
        } else {
            drawing = [val];
        }

        resetScene(); 
    }); */
}

function resetScene() {
    scene.traverse((obj) => {
        if (obj.isMesh) {
            obj.geometry.dispose();
            obj.material.dispose();
        } else if (obj.isInstancedMesh) {
            obj.dispose();
        }
    });

    while (scene.children.length > 0) { scene.remove(scene.children[0]); }

    numObjects = 0;
    root = new THREE.Group();
    scene.add(root);

    loadMolecule( 'ponatinib_Ablkinase_Jun2022.pdb', () => {
        setupCamera();
        setupLights();

        onWindowResize();

        console.log("NUMBER OF OBJECTS", numObjects);
    });
}

function setupCamera() {
    let box = getVisibleBoundingBox();
    const size = new THREE.Vector3();
    box.getSize(size);
    let maxDim = Math.max(size.x, size.y, size.z);

    const center = new THREE.Vector3();
    box.getCenter(center);

    let aspectRatio = window.innerWidth / window.innerHeight;

    let viewSize = Math.max(size.x, size.y, size.z);   
    let left = -aspectRatio * viewSize / 2;
    let right = aspectRatio * viewSize / 2;
    let top = viewSize / 2;
    let bottom = -viewSize / 2;
    let near = 1;   
    let far = 10000;   

    // Create the orthographic camera
    camera.left = left;
    camera.right = right;
    camera.top = top;
    camera.bottom = bottom;
    camera.near = near;
    camera.far = far;

    camera.position.set(center.x, center.y, maxDim * 2);

    globalThis.camera = camera;
    scene.add(camera);
}

function setupLights() {
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    const light1 = new THREE.DirectionalLight(0xffffff, 2.5);
    light1.position.set(1, 1, 1);
    scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 1.5);
    light2.position.set(1, -1, -1);
    scene.add(light2);
}

function setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerWidth, containerHeight);
    renderer.domElement.id = 'canvas';
    container.appendChild(renderer.domElement);
}

function setupControls() {
    const clock = new THREE.Clock();
    controls = new OrbitControls(camera, renderer.domElement);
    
    // Start the smooth rotation/animation
    function animateControls() {

        requestAnimationFrame(animateControls);

        if (autoRotate) {
            controls.autoRotate = true;  
            controls.update(clock.getDelta());  
        } else {
            controls.update();
        }

        renderer.render(scene, camera);
    }

    animateControls();
}


function getVisibleBoundingBox() {
    let box = new THREE.Box3();
    let tempBox = new THREE.Box3();

    if (instanced == INSTANCED) {
        root.traverse( (obj) => {
            if (obj.isInstancedMesh) {
                console.log("obj", obj);
                
                obj.computeBoundingBox();
                tempBox.copy(obj.boundingBox).applyMatrix4(obj.matrixWorld);
                box.union(tempBox);
                
            }
        });

    } else if (instanced == NAIVE) {
        root.traverse( (obj) => {
            if (obj.isMesh && obj.visible) {
    
                obj.geometry.computeBoundingBox();
                tempBox.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld);
                box.union(tempBox);
            } 
        })
    }   

    let helper = new THREE.Box3Helper(box, new THREE.Color(0xff0000)); 
    scene.add(helper);  
    helper.visible = true;

    return box;
}

function getBoundingBoxCenter() {

    let boundingBox = getVisibleBoundingBox();
    let center = new THREE.Vector3();
    boundingBox.getCenter(center);
    return center;
}

function calculateTime(startTime, endTime, message) {
    let totalTime = Math.abs(endTime - startTime);
    console.log(message, 'in seconds:', totalTime/1000);
}


// creates a new copy of atoms and bonds for every rep
function loadMolecule(model, callback) { 

    console.log('doing maxRepTabs', maxRepTabs, 'with', instanced);

    let startTime = new Date();
    const url = './models/molecules/' + model;

    PDBloader.load( url, function ( pdb ) {

        geometryBonds = pdb.geometryBondsManual; 
        geometryAtoms = pdb.geometryAtoms;

        json_atoms = pdb.json_atoms;
        json_bonds = pdb.json_bonds_manual.bonds_manual;

        // pre-build geometries for atoms and bonds, naive
        let sphereGeometryCPK = new THREE.IcosahedronGeometry( 1/3, detail );
        //let sphereGeometryCPK = new THREE.SphereGeometry( 1/3, 4, 4 );
        let boxGeometryCPK = new THREE.BoxGeometry( 1/75, 1/75, 0.6 );
        let sphereGeometryVDWCache = {};
        
        geometryAtoms.computeBoundingBox();
        geometryAtoms.boundingBox.getCenter( offset ).negate();  
        geometryAtoms.translate( offset.x, offset.y, offset.z );
        geometryBonds.translate( offset.x, offset.y, offset.z );

        // grab atom content from pdb so their position and color go along 
        let positions = geometryAtoms.getAttribute( 'position' );
        const colors = geometryAtoms.getAttribute( 'color' );
        const position = new THREE.Vector3();
        
        let atomStartTime = new Date();

        if (instanced == INSTANCED) {
            
            // ONLY DOING CPK ONE REP FOR NOW
            let atomCount = positions.count * maxRepTabs * drawing.length;
            let bondCount = (geometryBonds.getAttribute('position').count / 2) * maxRepTabs * drawing.length;

            // InstancedMesh for atoms
            let sphereGeometry = new THREE.IcosahedronGeometry(1/3, detail);
            let sphereMaterial = new THREE.MeshPhongMaterial();
            let atomInstancedMesh = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, atomCount);
            atomInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            let atomIndex = 0;

            atomInstancedMesh.castShadow = false;
            atomInstancedMesh.receiveShadow = false;

            // InstancedMesh for bonds
            let boxGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.6);
            let bondMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
            let bondInstancedMesh = new THREE.InstancedMesh(boxGeometry, bondMaterial, bondCount);
            bondInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            let bondIndex = 0;

            // LOAD IN ATOMS 
            for ( let i = 0; i < positions.count; i ++ ) {

                position.set(positions.getX(i), positions.getY(i), positions.getZ(i));
                let color = new THREE.Color(colors.getX(i), colors.getY(i), colors.getZ(i));
                
                for (let n = 0; n < maxRepTabs; n++) {
                    
                    for (let key of drawing) {
                        numObjects += 1;

                        let matrix = new THREE.Matrix4();
                        matrix.setPosition(position);
                        atomInstancedMesh.setMatrixAt(atomIndex, matrix);
                        atomInstancedMesh.setColorAt(atomIndex, color);
                        atomIndex++;
                    }
                } 
            }

            atomInstancedMesh.instanceMatrix.needsUpdate = true;
            atomInstancedMesh.instanceColor.needsUpdate = true;
            root.add(atomInstancedMesh);

            let atomEndTime = new Date();
            calculateTime(atomStartTime, atomEndTime, 'time to load atoms');

            // LOAD BONDS
            let bondStartTime = new Date();
            positions = geometryBonds.getAttribute( 'position' );
            const start = new THREE.Vector3();
            const end = new THREE.Vector3();

            for ( let i = 0; i < positions.count; i += 2 ) {

                start.set(positions.getX(i), positions.getY(i), positions.getZ(i));
                end.set(positions.getX(i+1), positions.getY(i+1), positions.getZ(i+1));

                let bondVector = new THREE.Vector3().subVectors(end, start); // Direction from start to end
                let bondLength = bondVector.length(); // Get the bond length
                let mid = new THREE.Vector3().lerpVectors(start, end, 0.5); // Midpoint for positioning

                let quaternion = new THREE.Quaternion();
                let upVector = new THREE.Vector3(0, 0, 1); // Bonds are initially aligned along Z-axis
                quaternion.setFromUnitVectors(upVector, bondVector.clone().normalize()); // Align bond to direction

                for (let n = 0; n < maxRepTabs; n++) {

                    for (let key of drawing) {

                        if (key == CPK) {
                            numObjects += 1;

                            let matrix = new THREE.Matrix4();
                            let scale = new THREE.Vector3(1, 1, bondLength); // Scale bond to correct length
                            matrix.compose(mid, quaternion, scale); // Apply position, rotation, and scale
                            bondInstancedMesh.setMatrixAt(bondIndex, matrix);
                            bondIndex++;
                        } 
                    }
                }
            }

            bondInstancedMesh.instanceMatrix.needsUpdate = true;
            root.add(bondInstancedMesh);

            let bondEndTime = new Date();
            calculateTime(bondStartTime, bondEndTime, 'time to load bonds');
        

        } else if (instanced == NAIVE) { // naive

            console.log('in naive');

            let sphereGeometry, boxGeometry;

            // LOAD IN ATOMS 
            for ( let i = 0; i < positions.count; i ++ ) {

                // loop through the positions array to get every atom 
                position.x = positions.getX( i );
                position.y = positions.getY( i );
                position.z = positions.getZ( i );
                
                for (let n = 0; n < maxRepTabs; n++) {
                    
                    for (let key of drawing) {
                        
                        let atomName = json_atoms.atoms[i][7];
                        let residue = json_atoms.atoms[i][5];
                        let resName = json_atoms.atoms[i][8];
                        let chain = json_atoms.atoms[i][6];

                        let color = new THREE.Color().setRGB(colors.getX( i ), colors.getY( i ), colors.getZ( i ));

                        let material = new THREE.MeshPhongMaterial();
                        material.color = color;

                        if (key == VDW) {
                            numObjects += 1;
                            
                            // if element doesn't yet exist in VDW cache, create a new geometry and add it
                            if (!(atomName in sphereGeometryVDWCache)) {
                                let rad = getRadius(json_atoms.atoms[i][4]) * 0.7; 
                            
                                sphereGeometry = new THREE.IcosahedronGeometry(rad, detail);
                                sphereGeometryVDWCache[atomName] = sphereGeometry;
                                                        
                            } else {
                                sphereGeometry = sphereGeometryVDWCache[atomName];
                            }

                        } else if (key == CPK) {
                            numObjects += 1;
                            sphereGeometry = sphereGeometryCPK;

                        } else if (key == lines) { // skip loading lines
                            continue;
                        }
            
                        // create atom object that is a sphere with the position, color, and content we want 
                        const object = new THREE.Mesh( sphereGeometry, material );
                        object.position.copy( position );
            
                        object.molecularElement = "atom";
                        object.style = key;
                        object.repNum = n;
                        object.residue = residue;
                        object.chain = chain;
                        object.atomName = atomName; // json_atoms.atoms[i][7]
                        object.resName = resName;
                        object.printableString = resName + residue.toString() + ':' + atomName.toUpperCase();
                        object.atomInfoSprite = null;

                        object.originalColor = new THREE.Color().setRGB(colors.getX( i ), colors.getY( i ), colors.getZ( i ));

                        object.material.color.set(color);
                        
                        // reference to original pdb within object for raycaster 
                        object.atomValue = i; 
            
                        root.add( object );

                        object.visible = true;
                    }
                } 
            }

            let atomEndTime = new Date();
            calculateTime(atomStartTime, atomEndTime, 'time to load atoms');

            // LOAD BONDS
            let bondStartTime = new Date();
            positions = geometryBonds.getAttribute( 'position' );
            const start = new THREE.Vector3();
            const end = new THREE.Vector3();

            for ( let i = 0; i < positions.count; i += 2 ) {

                let bond = json_bonds[i/2]; // loops through bonds 0 to however many bonds there are, divide by 2 because i increments by 2 
                
                let atom1 = json_atoms.atoms[bond[0]-1];
                let atom2 = json_atoms.atoms[bond[1]-1];
                let color1 = atom1[3];
                let color2 = atom2[3];

                // convert color arrays into HTML strings that can be fed into a new THREE.color
                color1 = `rgb(${color1[0]}, ${color1[1]}, ${color1[2]})`;
                color2 = `rgb(${color2[0]}, ${color2[1]}, ${color2[2]})`;

                // get bond start & end locations 
                start.x = positions.getX( i );
                start.y = positions.getY( i );
                start.z = positions.getZ( i );
        
                end.x = positions.getX( i+1 );
                end.y = positions.getY( i+1 );
                end.z = positions.getZ( i+1 );

                for (let n = 0; n < maxRepTabs; n++) {

                    for (let key of drawing) {

                        if (key == CPK) {
                            numObjects += 1;
                            boxGeometry = boxGeometryCPK;

                            const bondMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff } );
            
                            // make bond a rectangular prism & add it to scene 
                            const object = new THREE.Mesh( boxGeometry, bondMaterial );
                            object.position.copy( start );
                            object.position.lerp( end, 0.5 );
                            object.scale.set( 5, 5, start.distanceTo( end ) );

                            object.molecularElement = "bond";
                            object.style = key;
                            object.repNum = n;
                            object.atom1 = atom1;
                            object.atom2 = atom2;
                            object.originalColor = 'rgb(255, 255, 255)';

                            object.lookAt( end );
                            root.add( object );

                        } else if (key == lines) {
                            numObjects += 2;

                            let bondThickness = 0.1;
                            const bondLength = start.distanceTo(end);
                            const halfBondLength = bondLength / 2;

                            boxGeometry = new THREE.BoxGeometry(bondThickness, bondThickness, halfBondLength);  

                            const material1 = new THREE.MeshBasicMaterial({ color: color1 });
                            const material2 = new THREE.MeshBasicMaterial({ color: color2 });

                            const bondHalf1 = new THREE.Mesh(boxGeometry, material1);
                            const bondHalf2 = new THREE.Mesh(boxGeometry, material2);
                            
                            const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                            const bondDirection = new THREE.Vector3().subVectors(start, end).normalize();

                            const offset = bondDirection.clone().multiplyScalar(halfBondLength / 2);

                            bondHalf1.position.copy(midpoint).add(offset);
                            bondHalf2.position.copy(midpoint).sub(offset);

                            bondHalf1.lookAt(end);
                            
                            bondHalf2.lookAt(start);

                            bondHalf1.molecularElement = "bond";
                            bondHalf1.style = key;
                            bondHalf1.repNum = n;
                            bondHalf1.atom1 = atom1;
                            bondHalf1.atom2 = atom2;
                            bondHalf1.originalColor = color1;

                            bondHalf2.molecularElement = "bond";
                            bondHalf2.style = key;
                            bondHalf2.repNum = n;
                            bondHalf2.atom1 = atom1;
                            bondHalf2.atom2 = atom2;
                            bondHalf2.originalColor = color2;

                            root.add(bondHalf1);
                            root.add(bondHalf2);

                        } else if (key == VDW) { // skip VDW, no bonds
                            continue;
                        }  
                    }
                }
            }

            let bondEndTime = new Date();
            calculateTime(bondStartTime, bondEndTime, 'time to load bonds');
        }
        
        console.log('render');         
        render();

        let endTime = new Date();
        calculateTime(startTime, endTime, 'time to loadMolecule');

        if (callback) callback();
        
    } );
}

function onWindowResize() {

    let w = container.clientWidth;
    let h = container.clientHeight;

    let aspectRatio = w / h;
    let center = getBoundingBoxCenter();

    // For orthographic camera
    let currentHeight = camera.top - camera.bottom;
    let newWidth = currentHeight * aspectRatio;
    let centerX = (camera.left + camera.right) / 2;

    camera.left = centerX - newWidth / 2;
    camera.right = centerX + newWidth / 2;

    camera.updateProjectionMatrix();
    controls.target.set(center.x, center.y, center.z);

    renderer.setSize(w, h);
    
    render();
}

// animate the molecule (allow it to move, be clicked)
function animate() {
    requestAnimationFrame( animate );
    controls.update();
    render(); 
}

// render the molecule (adding scene and camera + objects)
function render() {
    renderer.render( scene, camera );
}

// get radius size of a given atom name 
function getRadius(atom){
    let rad; 

    if(atom == "Br"){
        rad = 1.83 }

    if(atom == "C"){
        rad = 1.7 }

    if(atom == "Cl"){
        rad = 1.75}

    if(atom == "F"){
        rad = 1.35 }

    if(atom == "H"){
        rad = 1.2 }

    if(atom == "N"){
        rad = 1.55 }

    if(atom == "O"){
        rad = 1.52 }

    if(atom == "S"){
        rad = 1.80 }

    return rad; 
}