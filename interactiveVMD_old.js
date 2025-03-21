// import three js and all the addons that are used in this script 
import * as THREE from 'three';
import { PDBLoader } from './mymods/PDBLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
//import { TW } from '/TWPackage.js';
//import { TW } from 'tw';

import CameraControls from 'https://cdn.jsdelivr.net/npm/camera-controls/dist/camera-controls.module.js';

CameraControls.install( { THREE: THREE } );


// GLOBAL CONSTANTS
const CPK = 'Ball-and-stick';
const VDW = 'Space filling';
const lines = 'Lines';
const reps = [VDW, CPK, lines];


// icosahedron 
const detail = 3;

// initialize the baseline objects  
let camera, scene, renderer, container;
container = document.getElementsByClassName('row')[0];

let controls;
let root = new THREE.Group();
let geometryAtoms, geometryBonds, json_atoms, json_bonds, json_bonds_manual, json_bonds_conect, residues, chains;
// let outlinePass, composer;
var raycaster, mouse = {x: 0, y: 0 }

let initialPosition, initialQuaternion;
let initialTarget = new THREE.Vector3(0,0,0);

const PDBloader = new PDBLoader(); 
const offset = new THREE.Vector3();

// setting default/on load molecule  

const defaultParams = {
    repParams: 1 
}

let selectedObject = null;

const containerWidth = 909;
const containerHeight = 454;


var numRepTabs = 1;
var currentRep = 0;

globalThis.numRepTabs = numRepTabs;
globalThis.currentRep = currentRep;

const maxRepTabs = 1;

let frames = 0, prevTime = performance.now();
const framesOn = true;

// specific settings for the raycaster (clicker) that make it senstitive enough to distinguish atoms 
raycaster = new THREE.Raycaster();
raycaster.near = .1;
raycaster.far = Infinity;
raycaster.params.Points.threshold = 0.1; 
raycaster.params.Line.threshold = 0.1;  


init();


// init function - sets up scene, camera, renderer, controls, and GUIs 
function init() {

    // initialize main window 
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x000000 );
    globalThis.scene = scene;
    scene.add(root);

    setupGUI();
    setupLights();
    setupRenderer();
    

    // initialize camera
    camera = new THREE.OrthographicCamera(0,0,0,0,0,0);

    // the default/first molecule to show up 
    loadMolecule( 'ponatinib_Ablkinase_Jun2022.pdb', CPK, currentRep, () => {
        // The camera will be updated after the molecule is fully loaded
        setupCamera();
        setupControls();

        root.visible = true;

        // dynamic screen size 
        //window.addEventListener( 'resize', onWindowResize );

        onWindowResize();

        animate();
    }); 
}

function setupGUI() {
    var gui = new GUI();
    gui.add(defaultParams, 'repParams', 1, 4).onChange(() => {
        console.log("Representation changed!");
        // Optionally trigger a redraw
    });
}

function setupCamera() {
    let box = getVisibleBoundingBox();
    const size = new THREE.Vector3();
    box.getSize(size);

    const center = new THREE.Vector3();
    box.getCenter(center);

    // Compute the aspect ratio based on the container's width and height
    let aspectRatio = window.innerWidth / window.innerHeight;

    // Set the size of the camera frustum to fit the bounding box
    let viewSize = Math.max(size.x, size.y, size.z);  // Use the largest dimension for the view size
    let left = -aspectRatio * viewSize / 2;
    let right = aspectRatio * viewSize / 2;
    let top = viewSize / 2;
    let bottom = -viewSize / 2;
    let near = 1;  // Near clipping plane (usually a small positive number)
    let far = 10000;  // Far clipping plane (adjust based on your scene size)

    // Create the orthographic camera
    camera.left = left;
    camera.right = right;
    camera.top = top;
    camera.bottom = bottom;
    camera.near = near;
    camera.far = far;

    console.log('Bounding Box Center:', center);
    console.log('Bounding Box Size:', size);


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
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerWidth, containerHeight);
    renderer.domElement.id = 'canvas';
    container.appendChild(renderer.domElement);
}

function setupControls() {
    const clock = new THREE.Clock();
    controls = new OrbitControls(camera, renderer.domElement);

    controls.enableRotate = true;  // Enable rotation
    controls.enableZoom = true;    // Enable zoom
    controls.enablePan = true;     // Enable pan
    
    // Start the smooth rotation/animation
    function animateControls() {
        requestAnimationFrame(animateControls);

        // If you want auto-rotation, you can modify azimuthAngle or other properties here
        controls.autoRotate = true;  
        controls.update(clock.getDelta());  // Update controls for smoothness
        renderer.render(scene, camera);
    }

    animateControls();
}

function storeInitialView() {
    initialPosition.copy(camera.position);
    initialQuaternion.copy(camera.quaternion);
    
    //initialTarget.copy(controls.getTarget);
    controls.getTarget(initialTarget);
}

function getVisibleBoundingBox() {
    let box = new THREE.Box3();
    let tempBox = new THREE.Box3();

    root.traverse( (obj) => {
        if (obj.isMesh && obj.visible) {

            obj.geometry.computeBoundingBox();
            tempBox.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld);
            box.union(tempBox);
        } 
    })

    let helper = new THREE.Box3Helper(box, new THREE.Color(0xff0000)); // Red color
    scene.add(helper);  // Add helper to scene for visualization
    helper.visible = true;

    return box;
}

function addAxes() {
    const axesHelper = new THREE.AxesHelper( 100 );
    scene.add( axesHelper );
}

function getBoundingBoxCenter() {

    let boundingBox = getVisibleBoundingBox();
    let center = new THREE.Vector3();
    boundingBox.getCenter(center);
    return center;
}

function recenterCamera(camera, controls) {

    let boundingBox = getVisibleBoundingBox();
    let center = getBoundingBoxCenter();
    
    let size = boundingBox.getSize(new THREE.Vector3());
    let maxDim = Math.max(size.x, size.y, size.z);

    if (camera.isPerspectiveCamera) {
        let distanceMultiplier = 2.5; // Adjust this value to zoom out more
        let distance = maxDim * distanceMultiplier;
    
        camera.position.set(
            center.x,
            center.y,
            center.z + distance
        );
    
        let aspect = window.innerWidth / window.innerHeight;
        let fov = 2 * Math.atan((maxDim / 2) / distance) * (180 / Math.PI);
        camera.fov = Math.min(Math.max(fov, 30), 75); // Clamp FOV between 30 and 75 degrees
        camera.aspect = aspect;
        camera.near = 0.1;
        camera.far = maxDim * 10;
    
        controls.minDistance = maxDim * 0.5;
        controls.maxDistance = maxDim * 10;
        controls.getTarget(center);

    } else {

        //console.log('camera is orthographic');

        let scaleFactor = 5; // Increase this value to zoom out more
        let left = (-size.x) / 2 * scaleFactor;
        let right = (size.x) / 2 * scaleFactor;
        let top = size.y / 2 * scaleFactor;
        let bottom = -size.y / 2 * scaleFactor;
        let near = -maxDim * 5;
        let far = maxDim * 5;

        camera.left = left;
        camera.right = right;
        camera.top = top;
        camera.bottom = bottom;
        camera.near = near;
        camera.far = far;

        camera.position.set(center.x, center.y, maxDim * 2);
        controls.target.set(center.x, center.y, center.z);
        /* let target = new THREE.Vector3(0,0,0);
        controls.getTarget(target);
         */
    }

    
    camera.updateProjectionMatrix();
    //controls.update();

    storeInitialView();
}

function calculateTime(startTime, endTime, message) {
    let totalTime = Math.abs(endTime - startTime);
    //console.log('time in milliseconds:', totalTime);
    console.log(message, 'in seconds:', totalTime/1000);
}


// creates a new copy of atoms and bonds for every tab
// from the given pdb and given representation style, 
// then loads default molecule (rep 0, CPK) into scene 
function loadMolecule(model, representation, rep, callback) { 
    let startTime = new Date();

    console.log('in new new version that creates a new copy and atoms/bonds for every tab')
    console.log("loading model", model, "representation", representation);

    // grab model file 
    const url = './models/molecules/' + model;

    // load by the pdb file 
    PDBloader.load( url, function ( pdb ) {
        // properties of pdb loader that isolate the atoms & bonds
        let manual = true; // TO DO - use manual for now, implement options for manual OR conect later

        if (manual) { 
            geometryBonds = pdb.geometryBondsManual; 
        } else { 
            geometryBonds = pdb.geometryBondsConect;
        }

        //console.log("pdb.geometryBondsManual", pdb.geometryBondsManual.attributes.position.array);

        geometryAtoms = pdb.geometryAtoms;

        json_atoms = pdb.json_atoms;
        //console.log("json_atoms.atoms", json_atoms.atoms);
        json_bonds_manual = pdb.json_bonds_manual.bonds_manual;
        json_bonds_conect = pdb.json_bonds_conect.bonds_conect;

        json_bonds = json_bonds_manual;

        residues = pdb.residues;
        chains = pdb.chains;
         
        let sphereGeometry, boxGeometry;

        // pre-build geometries for atoms and bonds
        let sphereGeometryCPK = new THREE.IcosahedronGeometry(1/3, detail );
        let boxGeometryCPK = new THREE.BoxGeometry( 1/75, 1/75, 0.6 );
        let sphereGeometryVDWCache = {};
        let boxGeometryLinesCache = {};
        
        let randTime = new Date();

        //starting setup to put atoms into scene 
        geometryAtoms.computeBoundingBox();
        geometryAtoms.boundingBox.getCenter( offset ).negate(); // the offset moves the center of the bounding box to the origin?
        geometryAtoms.translate( offset.x, offset.y, offset.z );
        geometryBonds.translate( offset.x, offset.y, offset.z );

        //grab atom content from pdb so their position and color go along 
        let positions = geometryAtoms.getAttribute( 'position' );

        const colors = geometryAtoms.getAttribute( 'color' );
        const position = new THREE.Vector3();
        
        root.visible = true;
        let randTimeEnd = new Date();
        calculateTime(randTime, randTimeEnd, 'stuff before atom loading');

        let atomStartTime = new Date();

        // LOAD IN ATOMS 
        for ( let i = 0; i < positions.count; i ++ ) {

            // loop through the positions array to get every atom 
            position.x = positions.getX( i );
            position.y = positions.getY( i );
            position.z = positions.getZ( i );

            //console.log("json_atoms.atoms", json_atoms.atoms)            
            
            // create a set of atoms/bonds for each tab
            for (let n = 0; n < maxRepTabs; n++) {
                //console.log('loaded atoms for tab', n);
                
                // create a set of atoms/bonds in each of the 3 styles for each tab
                for (let key of reps) {
                    //console.log('loaded atoms for style', key);
                    
                    let atomName = json_atoms.atoms[i][7];
                    let residue = json_atoms.atoms[i][5];
                    let resName = json_atoms.atoms[i][8];
                    let chain = json_atoms.atoms[i][6];

                    let color = new THREE.Color().setRGB(colors.getX( i ), colors.getY( i ), colors.getZ( i ));

                    let material = new THREE.MeshPhongMaterial();
                    material.color = color;

                    if (key == VDW) {
                        
                        // if element doesn't yet exist in VDW cache, create a new geometry and add it
                        if (!(atomName in sphereGeometryVDWCache)) {
                            let rad = getRadius(json_atoms.atoms[i][4]) * 0.7; 
                        
                            sphereGeometry = new THREE.IcosahedronGeometry(rad, detail);
                            sphereGeometryVDWCache[atomName] = sphereGeometry;
                                                    
                        } else {
                            sphereGeometry = sphereGeometryVDWCache[atomName];
                        }

                    } else if (key == CPK) {
                        sphereGeometry = sphereGeometryCPK;

                    } else if (key == lines) { // skip loading lines
                        continue;
                    }
        
                    // create atom object that is a sphere with the position, color, and content we want 
                    const object = new THREE.Mesh( sphereGeometry, material );
                    object.position.copy( position );
                    //object.position.multiplyScalar( 75 ); // TODOlater figure out why scaling
                    //object.scale.multiplyScalar( 25 );
                    //sphereGeometry.computeBoundingSphere();
        
                    object.molecularElement = "atom";
                    object.style = key;
                    object.repNum = n;
                    object.residue = residue;
                    object.chain = chain;
                    object.atomName = atomName; // json_atoms.atoms[i][7]
                    object.resName = resName;
                    object.printableString = resName + residue.toString() + ':' + atomName.toUpperCase();
                    object.atomInfoSprite = null;

                    /* console.log('residue', residue);
                    console.log('atomName', atomName);
                    console.log('resName', resName);

                    console.log('object.printableString', object.printableString); */

                    object.originalColor = new THREE.Color().setRGB(colors.getX( i ), colors.getY( i ), colors.getZ( i ));

                    object.material.color.set(color);
                    
                    // reference to original pdb within object for raycaster 
                    object.atomValue = i; 
        
                    // add atom object to scene 
                    root.add( object );

                    if (key == representation && n == rep) {
                        object.visible = true;
                    } else {
                        object.visible = false;
                    }
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
                //console.log('loaded bonds for tab', n);

                for (let key of reps) {

                    if (key == CPK) {
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

                        // only if key is equal to the rep we want and rep is correct, make visible, else hide
                        if (key == representation && n == rep) {
                            object.visible = true;
                        } else {
                            object.visible = false;
                        }

                    } else if (key == lines) {

                        let bondThickness = 0.1;
                        const bondLength = start.distanceTo(end);
                        const halfBondLength = bondLength / 2;

                        boxGeometry = new THREE.BoxGeometry(bondThickness, bondThickness, halfBondLength);  
                        //console.log('colors', color1, color2);

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

                       /*  console.log('bondhalf1', bondHalf1);
                        console.log('bondHalf2', bondHalf2); */

                        root.add(bondHalf1);
                        root.add(bondHalf2);

                        // only if key is equal to the rep we want and rep is correct, make visible, else hide
                        if (key == representation && n == rep) {
                            bondHalf1.visible = true;
                            bondHalf2.visible = true;
                        } else {
                            bondHalf1.visible = false;
                            bondHalf2.visible = false;
                        } 

                    } else if (key == VDW) { // skip VDW, no bonds
                        continue;
                    }  
                }
            }
        }

        let bondEndTime = new Date();
        calculateTime(bondStartTime, bondEndTime, 'time to load bonds');
    
        // render the scene after adding all the new atom & bond objects   
        //storeInitialView();

        console.log('render');         
        render();

        let endTime = new Date();
        calculateTime(startTime, endTime, 'time to loadMolecule');

        if (callback) callback();
        
    } );
}

function onWindowResize() {
    //console.log('in onWindowResize()');

    let w = container.clientWidth;
    let h = container.clientHeight;
    //console.log('w', w, 'h', h);

    let aspectRatio = w / h;
    let center = getBoundingBoxCenter();

    // Adjust the camera's aspect ratio
    if (camera.isOrthographicCamera) {

        // For orthographic camera
        let currentHeight = camera.top - camera.bottom;
        let newWidth = currentHeight * aspectRatio;
        let centerX = (camera.left + camera.right) / 2;

        camera.left = centerX - newWidth / 2;
        camera.right = centerX + newWidth / 2;

    } else if (camera.isPerspectiveCamera) {

        // For perspective camera
        camera.aspect = aspectRatio;
    }

    camera.updateProjectionMatrix();
    controls.target.set(center.x, center.y, center.z);
    //controls.update();

    // Update renderer size
    renderer.setSize(w, h);
    
    render();
}



// animate the molecule (allow it to move, be clicked)
function animate() {
    //console.log("animated")
    requestAnimationFrame( animate );

    // FPS
    if (framesOn) {
        frames ++;
        const time = performance.now();
        
        if ( time >= prevTime + 1000 ) {
        
            console.log( Math.round( ( frames * 1000 ) / ( time - prevTime ) ) );
        
        frames = 0;
        prevTime = time;
        
        }

        controls.update();
        camera.updateProjectionMatrix();
    } else {
        controls.update();
    }

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


