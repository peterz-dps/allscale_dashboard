
// ------------------------------------------------------------------------
//                       Chart Properties and Ops
// ------------------------------------------------------------------------

// the number of nodes involved
var numNodes = 0;

// the size of the grid
var gridSize = new THREE.Vector3();

// list of boxes to be drawn
var boxes = [];

// a function processing update state information
function updateMetaData(state, id) {

  // get number of nodes
  numNodes = state.length;

  // get the grid size and create list of boxes
  boxes = [];
  gridSize = new THREE.Vector3();
  state.forEach(function (node) {
    node.owned_data.forEach(function (data_item) {
      if (data_item.id != id) return;
      data_item.region.forEach(function (box) {

        // keep track of grid size boundaries
        gridSize.x = Math.max(gridSize.x, box.to[0]);
        gridSize.y = Math.max(gridSize.y, box.to[1]);
        gridSize.z = Math.max(gridSize.z, box.to[2]);

        function hue(id) {
          return id / numNodes * 360;
          //return ((id * 101) % numNodes)/numNodes * 360
        }

        // add box to render list
        boxes.push({
          "min": new THREE.Vector3(...box.from),
          "max": new THREE.Vector3(...box.to),
          "color": new THREE.Color(`hsl( ${hue(node.id)}, 100%, 50%)`)
        });
      });
    });
  });

}

// process meta-data state
updateMetaData(data_distribution_state[3], 1);


// ------------------------------------------------------------------------
//                       Rendering Operations
// ------------------------------------------------------------------------

var camera, scene, renderer;
var geometry, material, mesh;

var controls;

init();
animate();

function createBox(size, pos) {

  // create the box geometry
  var geometry = new THREE.BoxBufferGeometry();
  var position = pos.clone();
  var rotation = new THREE.Euler();
  var scale = size.clone();
  var quaternion = new THREE.Quaternion();
  quaternion.setFromEuler(rotation, false);
  var matrix = new THREE.Matrix4();
  matrix.compose(position, quaternion, scale);
  geometry.applyMatrix(matrix);
  return geometry;
}

function buildScene() {

  // save old rotation
  var rot = scene.rotation.y;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  // restore rotation
  scene.rotation.y = rot;

  var N = gridSize;

  // the size of each cell
  var cell_size = new THREE.Vector3(1 / gridSize.x, 1 / gridSize.y, 1 / gridSize.z);
  var gap = new THREE.Vector3(0.02, 0.02, 0.02);

  var origin = new THREE.Vector3(-0.5, -0.5, -0.5);

  boxes.forEach(function (region_box) {

    // get the size of this box
    var boxSize = region_box.max.clone().sub(region_box.min);
    var boxCenter = region_box.max.clone().add(region_box.min).multiplyScalar(0.5);

    // get the box
    boxSize.multiply(cell_size).sub(gap);
    var position = cell_size.clone().multiply(boxCenter).add(origin);
    //var position = new THREE.Vector3(i*(size.x+0.01),j*(size.y+0.01),k*(size.z+0.01));
    var box = createBox(boxSize, position);

    // pick a color
    var color = region_box.color;

    // create the filling
    var material = new THREE.MeshStandardMaterial();
    material.color = color.clone();
    material.emissive = color.clone();
    material.transparent = true;
    material.opacity = 0.25;
    material.depthTest = true;
    var mesh = new THREE.Mesh(box, material);
    scene.add(mesh);

    // get a wireframe for it
    var geo = new THREE.EdgesGeometry(box);
    var mat = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    var wireframe = new THREE.LineSegments(geo, mat);
    scene.add(wireframe);


  });

  // draw the bounding box
  var box = createBox(new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0));
  var color = new THREE.Color(0, 0, 0);
  var geo = new THREE.EdgesGeometry(box);
  var mat = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
  var wireframe = new THREE.LineSegments(geo, mat);
  scene.add(wireframe);

}

function init() {
  var dataviz = document.getElementById("dataviz");
  var width = dataviz.offsetWidth;
  var height = dataviz.offsetHeight;

  camera = new THREE.PerspectiveCamera(30, width / height, 0.01, 10);
  camera.position.set(2.0, 2.4, 3.0);
  camera.up.set(0, 1, 0);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  // setup the interactive controls support
  controls = new THREE.TrackballControls(camera);
  controls.rotateSpeed = 1.0;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.8;
  controls.noZoom = false;
  controls.noPan = true;
  controls.staticMoving = true;
  controls.dynamicDampingFactor = 0.3;

  scene = new THREE.Scene();
  buildScene();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  dataviz.appendChild(renderer.domElement);
}
//
function onMouseMove(e) {
  /*
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  */
}
function animate() {
  requestAnimationFrame(animate);

  scene.rotation.y += 0.005;

  render();
  // stats.update();
}
function pick() {
  /*
  //render the picking scene off-screen
  renderer.render( pickingScene, camera, pickingTexture );
  //create buffer for reading single pixel
  var pixelBuffer = new Uint8Array( 4 );
  //read the pixel under the mouse from the texture
  renderer.readRenderTargetPixels( pickingTexture, mouse.x, pickingTexture.height - mouse.y, 1, 1, pixelBuffer );
  //interpret the pixel as an ID
  var id = ( pixelBuffer[ 0 ] << 16 ) | ( pixelBuffer[ 1 ] << 8 ) | ( pixelBuffer[ 2 ] );
  var data = pickingData[ id ];
  if ( data) {
    //move our highlightBox so that it surrounds the picked object
    if ( data.position && data.rotation && data.scale ){
      highlightBox.position.copy( data.position );
      highlightBox.rotation.copy( data.rotation );
      highlightBox.scale.copy( data.scale ).add( offset );
      highlightBox.visible = true;
    }
  } else {
    highlightBox.visible = false;
  }
  */
}
function render() {
  controls.update();
  pick();
  renderer.render(scene, camera);
}


function switchTo(file, id) {

  if (file >= data_distribution_state.length) {
    console.log(`Only ${data_distribution_state.length} states available.`);
    return;
  }

  // update the data model
  updateMetaData(data_distribution_state[file], id);

  // re-build the scene
  buildScene();
}
