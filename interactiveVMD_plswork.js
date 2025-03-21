
import * as THREE from 'three';
import { PDBLoader } from './mymods/PDBLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// Set up scene, camera, and renderer
let scene = new THREE.Scene();
let camera, controls, renderer;

// Set up the orthographic camera
function setupCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 100;  // Adjust this to fit your molecule's size
    const frustumSize = viewSize;

    camera = new THREE.OrthographicCamera(
        -aspect * frustumSize, aspect * frustumSize, 
        frustumSize, -frustumSize, 
        1, 1000
    );
    camera.position.set(100, 100, 100);  // Position the camera in 3D space
    camera.lookAt(new THREE.Vector3(0, 0, 0));  // Look at the origin
}

// Set up the OrbitControls
function setupControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;  // Restrict vertical movement
}

// Set up the renderer
function setupRenderer() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
}

// Handle resizing of the window
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -aspect * 100;
    camera.right = aspect * 100;
    camera.top = 100;
    camera.bottom = -100;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

// Initialize the scene
function init() {
    setupCamera();
    setupRenderer();
    setupControls();

    // Load your molecule and add it to the scene
    loadMolecule('ponatinib_Ablkinase_Jun2022.pdb', CPK, currentRep);

    // Set up the animation loop
    animate();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    controls.update();  // Update the controls (necessary for damping)
    renderer.render(scene, camera);
}

init();


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