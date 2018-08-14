const numNodes = 16;

var ws = new WebSocket(`ws://${window.location.host}/ws`);

var timeStep = 0;
var widgets = {};
var refresher;
var dataStore = Array(numNodes).fill();

function mkNodeWidgetContainer(id) {
  return $('<div>')
    .attr('id', `node${id}`)
    .addClass('node node-offline')
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
        $('<div>').addClass('node-chart-title').append(
          'Network &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;',
          $('<span>').attr('style', 'color: #70ad47').text('In'),
          ' / ',
          $('<span>').attr('style', 'color: #c0504d').text('Out')
        ),
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
    interpolation: 'linear',
    stroke: true,
    series: [
      {
        color: '#5b9bd5',
        stroke: '#41719c',
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
    interpolation: 'linear',
    stroke: true,
    series: [
      {
        color: '#ed7d31',
        stroke: '#ae5a21',
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
    tickFormat: Rickshaw.Fixtures.Number.formatBase1024KMGTP,
    pixelsPerTick: 30,
    element: document.querySelector(`#node${id} .node-mem .node-y-axis`),
  });

  return graph;
}

function initNetWidget(id) {
  let graph = new Rickshaw.Graph({
    element: document.querySelector(`#node${id} .node-net .node-time-chart`),
    render: 'area',
    min: 'auto',
    interpolation: 'linear',
    stroke: true,
    series: [
      {
        color: '#70ad47',
        stroke: '#507e32',
        data: dataStore[id].network_in,
      },
      {
        color: '#c0504d',
        stroke: '#8c3836',
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
    pixelsPerTick: 16,
    element: document.querySelector(`#node${id} .node-net .node-y-axis`),
  });

  graph.renderer.unstack = true;

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

function updateDataStore(nodeData) {
  let id = nodeData.id;

  $(`#node${id} .node-state`).text(nodeData.state);
  if (nodeData.state != "online") {
    $(`#node${id}`).addClass('node-offline');

    dataStore[id].online = false;
    dataStore[id].cpu = shiftPush(dataStore[id].cpu, { x: timeStep, y: 0 });
    dataStore[id].memory = shiftPush(dataStore[id].memory, { x: timeStep, y: 0 });
    dataStore[id].network_in = shiftPush(dataStore[id].network_in, { x: timeStep, y: 0 });
    dataStore[id].network_out = shiftPush(dataStore[id].network_out, { x: timeStep, y: 0 });
    dataStore[id].raw = undefined;

    return;
  } else {
    $(`#node${id}`).removeClass('node-offline');

    dataStore[id].online = true;
    dataStore[id].cpu = shiftPush(dataStore[id].cpu, { x: timeStep, y: nodeData.cpu_load * 100 });
    dataStore[id].memory = shiftPush(dataStore[id].memory, { x: timeStep, y: nodeData.mem_load });
    dataStore[id].network_in = shiftPush(dataStore[id].network_in, { x: timeStep, y: nodeData.network_in });
    dataStore[id].network_out = shiftPush(dataStore[id].network_out, { x: timeStep, y: -nodeData.network_out });
    dataStore[id].raw = nodeData;
  }
}

function updateWidget(id) {
  let nodeData = dataStore[id].raw;

  if (!dataStore[id].online) return;

  widgets[id].mem.max = nodeData.total_memory;

  widgets[id].cpu.render();
  widgets[id].mem.render();
  widgets[id].net.render();
  widgets[id].pro.refresh((1 - nodeData.idle_rate) * 100);

  $(`#node${id} .node-details`).empty().append(
    $('<p>').html(`Task Throughput<br>${nodeData.task_throughput} &nbsp;&nbsp; (${nodeData.weighted_task_througput.toFixed(2)})`),
    $('<p>').html(`Owned Data<br># ${nodeData.owned_data.length}`),
  );
}

function updateWidgets() {
  for (let id = 0; id < numNodes; id++) {
    updateWidget(id);
  }
}

function processMessage(evt) {
  data = JSON.parse(evt.data);
  // console.log(data);

  if (data.type == "status") {
    processStatus(data);
  } else {
    console.warn("Unknown message type: " + data.type);
  }
}

function processStatus(data) {
  if (timeStep >= data.time) return;
  timeStep = data.time;

  for (let i = 0; i < data.nodes.length; i++) {
    updateDataStore(data.nodes[i]);
  }

  if (!refresher) {
    setRefreshInterval(500);
  }
}

// ------------------------------------------------------------------ Utilities

function shiftPush(array, element, limit = 10) {
  if (array.length >= limit) array.shift();
  array.push(element);
  return array;
}

function setRefreshInterval(ms) {
  if (refresher) {
    clearInterval(refresher);
  }
  refresher = setInterval(updateWidgets, ms);
}
