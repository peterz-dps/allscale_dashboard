const numNodes = 16;

var timeStep = 0;
var widgets = {};
var dataStore = Array(numNodes).fill();

function mkNodeWidgetContainer(id) {
  return $('<div>')
    .attr('id', `node${id}`)
    .addClass('node')
    .append(
      $('<div>').addClass('node-info').append(
        $('<div>').addClass('node-title').text(`Node ${id}`),
        $('<div>').addClass('node-state').text('offline'),
      ),
      $('<div>').addClass(`node-cpu`).append(
        $('<div>').addClass('node-chart-title').text('CPU'),
        $('<div>').addClass('node-x-axis'),
        $('<div>').addClass('node-y-axis'),
        $('<div>').addClass('node-time-chart')
      ),
      $('<div>').addClass(`node-mem`).append(
        $('<div>').addClass('node-chart-title').text('Memory'),
        $('<div>').addClass('node-x-axis'),
        $('<div>').addClass('node-y-axis'),
        $('<div>').addClass('node-time-chart')
      ),
      $('<div>').addClass('node-net').append(
        $('<div>').addClass('node-chart-title').text('Network'),
        $('<div>').addClass('node-x-axis'),
        $('<div>').addClass('node-y-axis'),
        $('<div>').addClass('node-time-chart')
      ),
      $('<div>').addClass('node-pro'),
      $('<div>').addClass('node-details'),
  );
}

function addNodes(count) {
  for (let id = 0; id < count; id++) {
    $('#dashboard').append(mkNodeWidgetContainer(id));
    widgets[id] = initNodeWidgets(id);
  }
}

function initNodeWidgets(id) {
  dataStore[id] = {
    cpu: [],
    memory: [],
    network_in: [],
    network_out: [],
  }

  return {
    'cpu': initCpuWidget(id),
    'mem': initMemWidget(id),
    'net': initNetWidget(id),
    'pro': initProWidget(id),
  }
}

function initCpuWidget(id) {
  let graph = new Rickshaw.Graph({
    element: document.querySelector(`#node${id} .node-cpu .node-time-chart`),
    max: 100,
    series: [
      {
        color: 'steelblue',
        data: dataStore[id].cpu,
      }
    ]
  });

  new Rickshaw.Graph.Axis.X({
    graph: graph,
    orientation: 'bottom',
    pixelsPerTick: 60,
    element: document.querySelector(`#node${id} .node-cpu .node-x-axis`),
  });
  new Rickshaw.Graph.Axis.Y({
    graph: graph,
    orientation: 'left',
    pixelsPerTick: 30,
    element: document.querySelector(`#node${id} .node-cpu .node-y-axis`),
  });

  return graph;
}

function initMemWidget(id) {
  let graph = new Rickshaw.Graph({
    element: document.querySelector(`#node${id} .node-mem .node-time-chart`),
    series: [
      {
        color: 'darkorange',
        data: dataStore[id].memory,
      }
    ]
  });

  new Rickshaw.Graph.Axis.X({
    graph: graph,
    orientation: 'bottom',
    pixelsPerTick: 60,
    element: document.querySelector(`#node${id} .node-mem .node-x-axis`),
  });
  new Rickshaw.Graph.Axis.Y({
    graph: graph,
    orientation: 'left',
    tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
    pixelsPerTick: 30,
    element: document.querySelector(`#node${id} .node-mem .node-y-axis`),
  });

  return graph;
}

function initNetWidget(id) {
  let graph = new Rickshaw.Graph({
    element: document.querySelector(`#node${id} .node-net .node-time-chart`),
    render: 'area',
    stroke: true,
    series: [
      {
        stroke: 'steelblue',
        color: 'rgba(192, 132, 255, 0.3)',
        data: dataStore[id].network_in,
      },
      {
        stroke: 'orange',
        color: 'rgba(96, 170, 255, 0.5)',
        data: dataStore[id].network_out,
      },
    ],
  });

  new Rickshaw.Graph.Axis.X({
    graph: graph,
    orientation: 'bottom',
    pixelsPerTick: 60,
    element: document.querySelector(`#node${id} .node-net .node-x-axis`),
  });
  new Rickshaw.Graph.Axis.Y({
    graph: graph,
    orientation: 'left',
    tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
    pixelsPerTick: 30,
    element: document.querySelector(`#node${id} .node-net .node-y-axis`),
  });

  return graph;
}

function initProWidget(id) {
  return new JustGage({
    parentNode: document.querySelector(`#node${id} .node-pro`),
    value: 0,
    min: 0,
    max: 100,
    title: "Productivity",
    levelColors: ['#e54b4b', '#faed70', '#2ddafd'],
    startAnimationTime: 0,
    refreshAnimationTime: 0,
  });
}

function updateWidgets(nodeData) {
  let id = nodeData.id;

  $(`#node${id} .node-state`).text(nodeData.state);
  if (nodeData.state != "online") {
    $(`#node${id}`).addClass('node-offline');
    return;
  } else {
    $(`#node${id}`).removeClass('node-offline');
  }

  // CPU
  dataStore[id].cpu = shiftPush(dataStore[id].cpu, { x: timeStep, y: nodeData.cpu_load * 100 });
  widgets[id].cpu.render();

  // Memory
  dataStore[id].memory = shiftPush(dataStore[id].memory, { x: timeStep, y: nodeData.mem_load });
  widgets[id].mem.render();

  // Network
  dataStore[id].network_in = shiftPush(dataStore[id].network_in, { x: timeStep, y: nodeData.network_in });
  dataStore[id].network_out = shiftPush(dataStore[id].network_out, { x: timeStep, y: nodeData.network_out });
  widgets[id].net.renderer.unstack = true;
  widgets[id].net.render();

  // Productivity
  widgets[id].pro.refresh((1 - nodeData.idle_rate) * 100);

  // Details
  $(`#node${id} .node-details`).empty().append(
    $('<p>').html(`Task Throughput<br>${nodeData.task_throughput} &nbsp;&nbsp; (${nodeData.weighted_task_througput.toFixed(2)})`),
    $('<p>').html(`Owned Data<br># ${nodeData.owned_data.length}`),
  );
}

function processMessage(evt) {
  data = JSON.parse(evt.data);
  // console.log(data);

  if (timeStep >= data.time) return;
  timeStep = data.time;

  for (let i = 0; i < numNodes; i++) {
    updateWidgets(data.nodes[i]);
  }
}

// ------------------------------------------------------------------ Utilities

function shiftPush(array, element, limit = 10) {
  if (array.length >= limit) array.shift();
  array.push(element);
  return array;
}
