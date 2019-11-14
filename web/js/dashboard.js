const numNodes = 16;

var ws = new WebSocket(`ws://${window.location.host}/ws`);

var timeStep = 0;
var summary;
var widgets = {};
var maxNetwork = 0;
var refresher;
var dataStore = Array(numNodes).fill();
var summaryDataStore = { cpu: [], mem: [] }; // abusing "mem" for power

function initSummary() {
  $('#summary').append(
    $('<div>')
      .attr('id', `node-total`)
      .addClass('node node-total')
      .append(
        $('<div>').addClass('node-info').append(
          $('<div>').addClass('node-title').text(`System`),
        ),
        //$('<div>').addClass('node-gap'),
        $('<div>').addClass(`node-cpu`).append(
          $('<div>').addClass('node-chart-title').text('Average CPU Usage'),
          $('<div>').addClass('node-x-axis'),
          $('<div>').addClass('node-y-axis'),
          $('<div>').addClass('node-time-chart')
        ),
        $('<div>').addClass('node-spd'),
        $('<div>').addClass(`node-mem`).append(
          $('<div>').addClass('node-chart-title').text('Power'),
          $('<div>').addClass('node-x-axis'),
          $('<div>').addClass('node-y-axis'),
          $('<div>').addClass('node-time-chart')
        ),
        $('<div>').addClass('node-pow'),
      )
  );

  summary = {
    'cpu': initCpuWidget("-total"),
    'spd': initSpdWidget("-total"),
    'mem': initMemWidget("-total"),
    'pow': initPowWidget("-total"),
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
        $('<div>').addClass('node-chart-title').text('CPU Usage'),
        $('<div>').addClass('node-x-axis'),
        $('<div>').addClass('node-y-axis'),
        $('<div>').addClass('node-time-chart')
      ),
      $('<div>').addClass('node-spd'),
      $('<div>').addClass(`node-mem`).append(
        $('<div>').addClass('node-chart-title').text('Power'),
        $('<div>').addClass('node-x-axis'),
        $('<div>').addClass('node-y-axis'),
        $('<div>').addClass('node-time-chart')
      ),
      $('<div>').addClass('node-pow'),
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
        data: String(id) == "-total" ? summaryDataStore.cpu : dataStore[id].cpu,
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
    min: 2,
    max: String(id) == "-total" ? 5.2 * 16 : 5.2,
    interpolation: 'linear',
    stroke: true,
    series: [
      {
        color: '#ed7d31',
        stroke: '#ae5a21',
        data: String(id) == "-total" ? summaryDataStore.mem : dataStore[id].memory,
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
    pixelsPerTick: 15,
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
    tickFormat: formatBase1024KMGTP,
    pixelsPerTick: 16,
    element: document.querySelector(`#node${id} .node-net .node-y-axis`),
  });

  graph.renderer.unstack = true;

  return graph;
}

function initGageWidget(id, kind, label, colors) {
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
  let res = initGageWidget(id, "spd", String(id) == "-total" ? "Avg CPU Speed" : "CPU Speed", ['#2ddafd', '#faed70', '#e54b4b']);
  res.config.min = 300000;
  res.config.max = 1800000;
  res.config.textRenderer = function(value) {
    return (value / 1000000.0).toFixed(1) + "GHz";
  };
  return res;
}

function initPowWidget(id) {
  let res = initGageWidget(id, "pow", String(id) == "-total" ? "Total Power" : "Power", ['#2ddafd', '#faed70', '#e54b4b']);
  res.config.min = 2;
  res.config.max = 5.2;
  if(String(id) == "-total") {
    res.config.max *= numNodes;
  }
  res.config.textRenderer = function(value) {
    return value.toFixed(1) + "W";
  };
  return res;
}


function updateDataStore(nodeData) {
  let id = nodeData.id;

  $(`#node${id} .node-state`).text(nodeData.state);

  dataStore[id].timeStamp = timeStep;
  dataStore[id].cpu = shiftPush(dataStore[id].cpu, { x: timeStep, y: nodeData.cpu_load * 100 });
  dataStore[id].memory = shiftPush(dataStore[id].memory, { x: timeStep, y: nodeData.cur_power.toFixed(1) });
  dataStore[id].network_in = shiftPush(dataStore[id].network_in, { x: timeStep, y: nodeData.network_in });
  dataStore[id].network_out = shiftPush(dataStore[id].network_out, { x: timeStep, y: -nodeData.network_out });
  dataStore[id].raw = nodeData;
}

function updateWidget(id) {
  let nodeData = dataStore[id].raw;
  if (!nodeData) return;
  let currentTime = Math.floor(Date.now() / 1000);

  if(dataStore[id].timeStamp + 5 < currentTime) {
    $(`#node${id}`).addClass('node-offline');
    $(`#node${id} .node-state`).text("offline");
    return;
    
  } else {
    $(`#node${id}`).removeClass('node-offline');
    $(`#node${id} .node-state`).text("active");
  }

  maxNetwork = Math.max(maxNetwork, nodeData.network_in, nodeData.network_out);
  widgets[id].net.max = maxNetwork;
  widgets[id].net.min = -maxNetwork;

  widgets[id].cpu.render();
  widgets[id].mem.render();
  widgets[id].net.render();
  widgets[id].spd.refresh(nodeData.speed);
  widgets[id].pow.refresh(nodeData.cur_power);
}

function updateWidgets() {
  for (let id = 0; id < numNodes; id++) {
    updateWidget(id);
  }
  
  let currentTime = Math.floor(Date.now() / 1000);

  let totalCPULoad = 0;
  let totalCPUSpeed = 0;
  let totalPower = 0;
  let onlineNodeCount = 0;
  for(let id = 0; id < numNodes; ++id) {
    if(!dataStore[id].raw) continue;
    if(dataStore[id].timeStamp + 5 < currentTime) continue;

    totalCPULoad += dataStore[id].raw.cpu_load;
    totalCPUSpeed += dataStore[id].raw.speed;
    totalPower += dataStore[id].raw.cur_power;
    ++onlineNodeCount
  }
  
  let avgSpeed = onlineNodeCount != 0 ? totalCPUSpeed / onlineNodeCount : 0
  summary.spd.refresh(avgSpeed);
  summary.pow.refresh(totalPower);
  
  let avgCPULoad = totalCPULoad != 0 ? totalCPULoad / onlineNodeCount : 0
  summaryDataStore.cpu = shiftPush(summaryDataStore.cpu, { x: currentTime, y: avgCPULoad * 100 });
  summary.cpu.render();
  summaryDataStore.mem = shiftPush(summaryDataStore.mem, { x: currentTime, y: totalPower });
  summary.mem.render();
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
  timeStep = Math.floor(Date.now() / 1000);

  // update nodes
  for (let i = 0; i < data.nodes.length; i++) {
    updateDataStore(data.nodes[i]);
  }

  if (!refresher) {
    setRefreshInterval(1000);
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
