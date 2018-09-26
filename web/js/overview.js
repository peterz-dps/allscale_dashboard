const numNodes = 16;

const nodeColor = [
  '#6ab73f',
  '#335358',
  '#3188a2',
  '#99691c',
  '#e0a67f',
  '#fc480d',
  '#7700ff',
  '#68064a',
  '#f047e2',
  '#fa1d70',
  '#00619b',
  '#9ca9f7',
  '#838123',
  '#b5b7d1',
  '#160c55',
  '#bdf12e',
];

var timeStep = 0;

var refresher;
var widgets = {};

var dataStore = {
  summary: {},
  nodes: Array(numNodes).fill()
}

function initSummary() {
  let colorLowGood = ['#2ddafd', '#faed70', '#e54b4b'];
  let colorLowBad = ['#e54b4b', '#faed70', '#2ddafd'];

  widgets.summary_speed = initGageWidget('summary-speed', 'Speed', colorLowBad);
  widgets.summary_efficiency = initGageWidget('summary-efficiency', 'Efficiency', colorLowBad);
  widgets.summary_power = initGageWidget('summary-power', 'Power', colorLowGood);
  widgets.summary_score = initGageWidget('summary-score', 'Score', colorLowBad);
}

function initNodes() {
  for (let i = 0; i < numNodes; i++) {
    dataStore.nodes[i] = {
      speed: [],
      efficiency: [],
      power: [],
    }
  }

  let $legend = $('#legend');

  for (let i = 0; i < numNodes; i++) {
    $legend.append(
      $('<div>')
        .attr('id', `node${i}`)
        .append(
          'Node',
          $('<div>').addClass('node-id').text(i),
          $('<div>').addClass('node-color').attr('style', `background-color: ${nodeColor[i]}`)
        )
    );
  }
}

function initWidgets() {
  widgets.speed = initLineWidget('speed');
  widgets.efficiency = initLineWidget('efficiency');
  widgets.power = initLineWidget('power');
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

  // extend for non-specified nodes
  fillInMissingNodes(data);

  updateSummary(data);

  for (let i = 0; i < data.nodes.length; i++) {
    updateNode(data.nodes[i]);
  }

  if (!refresher) {
    setRefreshInterval(500);
  }
}

function fillInMissingNodes(data) {
  var givenNodes = new Set();
  for (let i = 0; i < data.nodes.length; i++) {
    givenNodes.add(data.nodes[i].id);
  }

  for (let i = 0; i < numNodes; i++) {
    if (givenNodes.has(i)) continue;
    var node = {};
    node.id = i;
    node.state = "offline";
    data.nodes.push(node);
  }
}

function updateSummary(data) {
  dataStore.summary.speed = data.speed * 100;
  dataStore.summary.efficiency = data.efficiency * 100;
  dataStore.summary.power = data.power * 100;
  dataStore.summary.score = data.score * 100;

  var total_tasks = 0;
  var total_weighted_tasks = 0;
  var items = new Set();
  data.nodes.forEach(function (cur) {
    if (cur.state == "offline") return;
    total_tasks += cur.task_throughput;
    total_weighted_tasks += cur.weighted_task_througput;
    cur.owned_data.forEach(function (entry) {
      items.add(entry.id);
    });
  });

  dataStore.summary.total_tasks = total_tasks;
  dataStore.summary.total_weighted_tasks = total_weighted_tasks;
  dataStore.summary.data_items = items.size;
}

function updateNode(nodeData) {
  let id = nodeData.id;

  if (nodeData.state == 'standby') {
    $(`#node${id}`).addClass('standby');
    $(`#node${id}`).removeClass('offline');
  } else if (nodeData.state == 'offline') {
    $(`#node${id}`).removeClass('standby');
    $(`#node${id}`).addClass('offline');
  } else {
    $(`#node${id}`).removeClass('standby');
    $(`#node${id}`).removeClass('offline');
  }

  if (nodeData.state == 'offline') {
    dataStore.nodes[id].online = false;
    dataStore.nodes[id].speed = shiftPush(dataStore.nodes[id].speed, { x: timeStep, y: 0 });
    dataStore.nodes[id].efficiency = shiftPush(dataStore.nodes[id].efficiency, { x: timeStep, y: 0 });
    dataStore.nodes[id].power = shiftPush(dataStore.nodes[id].power, { x: timeStep, y: 0 });
    dataStore.nodes[id].raw = undefined;
  } else {
    dataStore.nodes[id].online = true;
    dataStore.nodes[id].speed = shiftPush(dataStore.nodes[id].speed, { x: timeStep, y: nodeData.speed * 100 });
    dataStore.nodes[id].efficiency = shiftPush(dataStore.nodes[id].efficiency, { x: timeStep, y: nodeData.efficiency * 100 });
    dataStore.nodes[id].power = shiftPush(dataStore.nodes[id].power, { x: timeStep, y: nodeData.power * 100 });
    dataStore.nodes[id].raw = nodeData;
  }
}

function updateWidgets() {
  widgets.summary_speed.refresh(dataStore.summary.speed);
  widgets.summary_efficiency.refresh(dataStore.summary.efficiency);
  widgets.summary_power.refresh(dataStore.summary.power);
  widgets.summary_score.refresh(dataStore.summary.score);

  $('#summary-details').empty().append(
    $('<p>').html(`Task Throughput<br>${dataStore.summary.total_tasks.toFixed(2)} &nbsp;&nbsp; (${dataStore.summary.total_weighted_tasks.toFixed(2)})`),
    $('<p>').html(`Data Items<br># ${dataStore.summary.data_items}`),
  );

  widgets.speed.render();
  widgets.efficiency.render();
  widgets.power.render();
}

// --------------------------------------------------------------------- Charts

function initGageWidget(id, label, colors) {
  return new JustGage({
    parentNode: document.querySelector(`#${id}`),
    value: 0,
    min: 0,
    max: 100,
    title: label,
    levelColors: colors,
    startAnimationTime: 0,
    refreshAnimationTime: 0,
  });
}

function initLineWidget(id) {
  let series = [];
  for (let i = 0; i < numNodes; i++) {
    series.push({
      color: nodeColor[i],
      data: dataStore.nodes[i][id],
    });
  }

  let graph = new Rickshaw.Graph({
    element: document.querySelector(`#${id} > .chart`),
    interpolation: 'linear',
    renderer: 'line',
    min: 0,
    max: 100,
    series: series,
  });

  new Rickshaw.Graph.Axis.X({
    graph: graph,
    orientation: 'bottom',
    pixelsPerTick: 60,
    element: document.querySelector(`#${id} .x-axis`),
    tickFormat: function (x) { return x % 100000 },
  });

  new Rickshaw.Graph.Axis.Y({
    graph: graph,
    orientation: 'left',
    pixelsPerTick: 30,
    element: document.querySelector(`#${id} .y-axis`),
  });

  return graph;
}

// ------------------------------------------------------------------ Utilities

function shiftPush(array, element, limit = 16) {
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
