let clustersData = {};
let currentClusterIndex = 0;

async function loadData() {
  const response = await fetch("data/cluster_peaks_and_spectra_full_payload.json");
  const rawData = await response.json();

  // Check if data is an array instead of { clusters: [...] }
  const clusterList = Array.isArray(rawData) ? rawData : rawData.clusters;

  if (!clusterList || !Array.isArray(clusterList)) {
    console.error("Malformed JSON: expected array of clusters");
    return;
  }

  clusterList.forEach((cluster, idx) => {
    clustersData[idx] = {
      ...cluster,
      peaks: [...(cluster.peaks || [])]
    };
  });

  populateClusterSelector();
  renderCluster(currentClusterIndex);
}

function populateClusterSelector() {
  const select = document.getElementById("clusterSelect");
  select.innerHTML = "";

  Object.keys(clustersData).forEach((idx) => {
    const option = document.createElement("option");
    option.value = idx;
    option.text = `Cluster ${idx}`;
    select.appendChild(option);
  });

  select.addEventListener("change", (e) => {
    currentClusterIndex = parseInt(e.target.value);
    renderCluster(currentClusterIndex);
  });
}

function renderCluster(index) {
  const cluster = clustersData[index];
  if (!cluster) return;

  const spectrum = cluster.spectrum;
  const peaks = cluster.peaks;

  const trace1 = {
    x: spectrum.x,
    y: spectrum.y,
    mode: "lines",
    name: `Cluster ${index} Spectrum`,
    line: { color: "blue" }
  };

  const trace2 = {
    x: peaks.map((p) => p.energy),
    y: peaks.map((p) => p.intensity || 0),
    text: peaks.map((p) => p.elements ? p.elements.join(", ") : ""),
    mode: "markers+text",
    name: "Peaks",
    textposition: "top center",
    marker: {
      color: peaks.map((p) => p.manual ? "green" : (p.ambiguous ? "red" : "orange")),
      size: 10
    }
  };

  Plotly.newPlot("plot", [trace1, trace2], {
    title: `Cluster ${index} - Spectra & Peaks`,
    xaxis: { title: "Energy (keV)" },
    yaxis: { title: "Intensity" }
  });

  renderTable(index);
}

function renderTable(index) {
  const cluster = clustersData[index];
  const container = document.getElementById("peakTable");
  container.innerHTML = "";

  const table = document.createElement("table");
  const header = document.createElement("thead");
  header.innerHTML = `
    <tr>
      <th>Energy (keV)</th>
      <th>Intensity</th>
      <th>Matched Elements</th>
      <th>Ambiguous</th>
      <th>Note</th>
      <th>Manual</th>
      <th>Remove</th>
    </tr>`;
  table.appendChild(header);

  const tbody = document.createElement("tbody");

  cluster.peaks.forEach((p, idx) => {
    const row = document.createElement("tr");
    row.className = p.manual ? "manual" : (p.ambiguous ? "ambiguous" : "");

    row.innerHTML = `
      <td>${p.energy.toFixed(2)}</td>
      <td>${p.intensity?.toFixed(2) || ""}</td>
      <td>${p.elements?.join(", ") || ""}</td>
      <td>${p.ambiguous ? "Yes" : "No"}</td>
      <td>${p.note || ""}</td>
      <td>${p.manual ? "Yes" : "No"}</td>
      <td><span class="remove-btn" data-idx="${idx}">🗑️</span></td>
    `;
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  container.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      cluster.peaks.splice(idx, 1);
      renderCluster(index);
    });
  });
}

function setupManualAdd() {
  const btn = document.getElementById("addPeakButton");
  btn.addEventListener("click", () => {
    const energy = parseFloat(document.getElementById("manualEnergy").value);
    if (isNaN(energy)) return alert("Energy (keV) is required");

    const intensity = parseFloat(document.getElementById("manualIntensity").value);
    const elementsStr = document.getElementById("manualElements").value.trim();
    const note = document.getElementById("manualNote").value.trim();

    const newPeak = {
      energy: energy,
      intensity: isNaN(intensity) ? undefined : intensity,
      elements: elementsStr ? elementsStr.split(",").map(e => e.trim()) : [],
      ambiguous: false,
      note: note,
      manual: true
    };

    clustersData[currentClusterIndex].peaks.push(newPeak);
    renderCluster(currentClusterIndex);

    // Clear form
    document.getElementById("manualEnergy").value = "";
    document.getElementById("manualIntensity").value = "";
    document.getElementById("manualElements").value = "";
    document.getElementById("manualNote").value = "";
  });
}

function setupDownload() {
  const btn = document.getElementById("downloadButton");
  btn.addEventListener("click", () => {
    const json = Object.values(clustersData);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edited_peaks.json";
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Init
loadData().then(() => {
  setupManualAdd();
  setupDownload();
});
