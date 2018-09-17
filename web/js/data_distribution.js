
// ------------------------------------------------------------------------
//                       Chart Properties and Ops
// ------------------------------------------------------------------------

// the number of nodes involved
var numNodes = 0;

// the size of the grid
var gridSize = new THREE.Vector3();

// the current state
var runtimeState = [];

// list of boxes to be drawn
var boxes = [];

// the currently selected data item
var currentDataItem = 1;

// updates the list of boxes to be drawn to represent the selected item
function selectDataItem( id ) {

  // update current data item selection
  currentDataItem = id;

  // get the grid size and create list of boxes
  boxes = [];
  gridSize = new THREE.Vector3();
  runtimeState.forEach(function (node) {
    if (node.state == "offline") return;
    node.owned_data.forEach(function (data_item) {
      if (data_item.id != id) return;
      data_item.region.forEach(function (box) {

        // keep track of grid size boundaries
        gridSize.x = Math.max(gridSize.x, box.to[0]);
        if (box.to.length > 1) gridSize.y = Math.max(gridSize.y, box.to[1]);
        if (box.to.length > 2) gridSize.z = Math.max(gridSize.z, box.to[2]);

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

// a function processing update state information
function updateDataModel(state) {

  // update state
  runtimeState = state;

  // get number of nodes
  numNodes = state.length;

  // update boxes to be drawn
  selectDataItem(currentDataItem);

  // update selection box options
  var selector = document.getElementById("data-item-selection");
  var oldVal = selector.value;

  // remove old options
  var numOptions = selector.length;
  for (var i=0; i < numOptions; i++) {
    selector.remove(0);
  }

  // collect new data item ids
  var dataItems = new Set();
  runtimeState.forEach(function (node) {
    if (node.state == "offline") return;
    node.owned_data.forEach(function (data_item) {
      dataItems.add(data_item.id);
    });
  });
  dataItems = Array.from(dataItems.entries()).map(p => p[0]);
  dataItems.sort((a,b)=>a-b);

  dataItems.forEach(function(id){
    var option = document.createElement("option");
    option.text = `Data Item DI-${id}`;
    option.value = id;
    selector.add(option);
  });

  selector.value = oldVal;
}

// process meta-data state (initially empty)
updateDataModel([]);


// ------------------------------------------------------------------------
//                       Rendering Operations
// ------------------------------------------------------------------------

var pcam, ocam;
var camera, scene, renderer;
var geometry, material, mesh;

var controls;

init();
animate();

function buildScene() {

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

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  var N = gridSize;

  var D = 1 + (gridSize.y > 0) + (gridSize.z > 0);
  if (D < 3) {
    // freeze camera
    if (controls.autoRotate) {
      controls.autoRotate = false;
      controls.enableRotate = false;
      camera = ocam;
    }
  } else {
    // unfreeze camera
    if (!controls.autoRotate) {
      controls.autoRotate = true;
      controls.enableRotate = true;
      camera = pcam;
    }
  }

  // the size of each cell
  var cell_size = new THREE.Vector3(
      (gridSize.x == 0) ? 0.02 : 1 / gridSize.x,
      (gridSize.y == 0) ? 0.02 : 1 / gridSize.y,
      (gridSize.z == 0) ? 0.02 : 1 / gridSize.z
    );
  var gap = new THREE.Vector3(0.02, 0.02, 0.02);

  var origin = new THREE.Vector3(
    (gridSize.x == 0) ? 0 : -0.5,
    (gridSize.y == 0) ? 0 : -0.5,
    (gridSize.z == 0) ? 0 : -0.5
  );

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
  var box = createBox(new THREE.Vector3(1, (gridSize.y > 0) ? 1 : 0.04, (gridSize.z > 0) ? 1 : 0.04), new THREE.Vector3(0, 0, 0));
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

  // orthographic camera for 1D and 2D
  ocam = new THREE.OrthographicCamera(-1,1,1,-1,1,-1);

  // perspecite camera for 3D
  pcam = new THREE.PerspectiveCamera(30, width / height, 0.01, 10);
  pcam.position.set(2.0, 2.4, 3.0);
  pcam.up.set(0, 1, 0);
  pcam.lookAt(new THREE.Vector3(0, 0, 0));

  // fix one
  camera = pcam;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  dataviz.appendChild(renderer.domElement);

  // setup the interactive controls support
  controls = new THREE.OrbitControls( camera, renderer.domElement );
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.25;
  controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
  controls.dampingFactor = 0.25;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = Math.PI / 2;
  controls.enablePan = false;

  scene = new THREE.Scene();
  buildScene();
}

function animate() {
  requestAnimationFrame(animate);

  // support control dynamics (auto rotation)
  controls.update();

  // refresh the scene
  render();
}

function render() {
  controls.update();
  renderer.render(scene, camera);
}


// ------------------------------------------------------------------------
//                       Event Handling
// ------------------------------------------------------------------------

function dataItemSelectionChanged() {
  // switch to new data item
  selectDataItem(document.getElementById("data-item-selection").value);
}

function processMessage( evt ) {
  data = JSON.parse(evt.data);
  updateDataModel(data.nodes);
  buildScene();
}

// --- manual interaction ---

function switchTo(file, id) {

  if (file >= data_distribution_state.length) {
    console.log(`Only ${data_distribution_state.length} states available.`);
    return;
  }

  // update the data model
  updateDataModel(data_distribution_state[file], id);

  // re-build the scene
  buildScene();
}
