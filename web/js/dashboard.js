const numNodes = 16;

var ws = new WebSocket(`ws://${window.location.host}/ws`);

var timeStep = 0;
var summary;
var widgets = {};
var maxNetwork = 0;
var refresher;
var dataStore = Array(numNodes).fill();

function initSummary() {
  $('#summary').append(
    $('<div>')
      .attr('id',`node-total`)
      .addClass('node node-total')
      .append(
        $('<div>').addClass('node-info').append(
          $('<div>').addClass('node-title').text(`System`),
        ),
        $('<div>').addClass('node-gap'),
        $('<div>').addClass('node-spd'),
        $('<div>').addClass('node-eff'),
        $('<div>').addClass('node-pow'),
        $('<div>').addClass('node-sco'),
        $('<div>').addClass('node-details'),
      )
    );

    summary = {
      'spd' : initSpdWidget("-total"),
      'eff' : initEffWidget("-total"),
      'pow' : initPowWidget("-total"),
      'sco' : initScoreWidget("-total"),
    }
}

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
      $('<div>').addClass('node-spd'),
      $('<div>').addClass('node-eff'),
      $('<div>').addClass('node-pow'),
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
    'spd': initSpdWidget(id),
    'eff': initEffWidget(id),
    'pow': initPowWidget(id),
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
    tickFormat: function (x) { return x % 100000 },
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
    tickFormat: function (x) { return x % 100000 },
  });
  new Rickshaw.Graph.Axis.Y({
    graph: graph,
    orientation: 'left',
    tickFormat: formatBase1024KMGTP,
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
    tickFormat: function (x) { return x % 100000 },
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

function initGageWidget(id,kind,label,colors) {
  return new JustGage({
    parentNode: document.querySelector(`#node${id} .node-${kind}`),
    value: 0,
    min: 0,
    max: 100,
    title: label,
    levelColors: colors,
    startAnimationTime: 0,
    refreshAnimationTime: 0,
  });
}

function initSpdWidget(id) {
  return initGageWidget(id,"spd","Speed",['#e54b4b', '#faed70', '#2ddafd']);
}

function initEffWidget(id) {
  return initGageWidget(id,"eff","Efficiency",['#e54b4b', '#faed70', '#2ddafd']);
}

function initPowWidget(id) {
  return initGageWidget(id,"pow","Power",['#2ddafd', '#faed70', '#e54b4b']);
}

function initScoreWidget(id) {
  return initGageWidget(id,"sco","Score",['#e54b4b', '#faed70', '#2ddafd']);
}


function updateDataStore(nodeData) {
  let id = nodeData.id;

  $(`#node${id} .node-state`).text(nodeData.state);
  if (nodeData.state == "offline") {
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

  maxNetwork = Math.max(maxNetwork, nodeData.network_in, nodeData.network_out);
  widgets[id].net.max = maxNetwork;
  widgets[id].net.min = -maxNetwork;

  widgets[id].cpu.render();
  widgets[id].mem.render();
  widgets[id].net.render();
  widgets[id].spd.refresh(nodeData.speed * 100);
  widgets[id].eff.refresh(nodeData.efficiency * 100);
  widgets[id].pow.refresh(nodeData.power * 100);

  $(`#node${id} .node-details`).empty().append(
    $('<p>').html(`Task Throughput<br>${nodeData.task_throughput.toFixed(2)} &nbsp;&nbsp; (${nodeData.weighted_task_througput.toFixed(2)})`),
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

function updateSummary(data) {

  summary.spd.refresh(data.speed * 100);
  summary.eff.refresh(data.efficiency * 100);
  summary.pow.refresh(data.power * 100);
  summary.sco.refresh(data.score * 100);

  var total_tasks = 0;
  var total_weighted_tasks = 0;
  var items = new Set();
  data.nodes.forEach(function(cur){
    if (cur.state == "offline") return;
    total_tasks += cur.task_throughput;
    total_weighted_tasks += cur.weighted_task_througput;
    cur.owned_data.forEach(function(entry){
      items.add(entry.id);
    });
  });

  $(`#node-total .node-details`).empty().append(
    $('<p>').html(`Task Throughput<br>${total_tasks.toFixed(2)} &nbsp;&nbsp; (${total_weighted_tasks.toFixed(2)})`),
    $('<p>').html(`Data Items<br># ${items.size}`),
  );
}

function processStatus(data) {
  if (timeStep >= data.time) return;
  timeStep = data.time;

  // update summary
  updateSummary(data);

  // update nodes
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

function formatBase1024KMGTP(y) {
  var abs_y = Math.abs(y);
  if (abs_y >= 1125899906842624) return (y / 1125899906842624).toFixed(0) + "P";
  else if (abs_y >= 1099511627776) return (y / 1099511627776).toFixed(0) + "T";
  else if (abs_y >= 1073741824) return (y / 1073741824).toFixed(0) + "G";
  else if (abs_y >= 1048576) return (y / 1048576).toFixed(0) + "M";
  else if (abs_y >= 1024) return (y / 1024).toFixed(0) + "K";
  else if (abs_y < 1 && abs_y > 0) return y.toFixed(2);
  else if (abs_y === 0) return '';
  else { return y }
};
