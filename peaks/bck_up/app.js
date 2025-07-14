let spectraData = null;
let peaksData = null;
let clusterKeys = [];

document.addEventListener("DOMContentLoaded", async () => {
  setupUI();
  await loadData();
});

function setupUI() {
  document.getElementById("downloadBtn").addEventListener("click", downloadData);
}

async function loadData() {
  try {
    const spectraRes = await fetch("data/cluster_peaks_and_spectra_full_payload.json");
    spectraData = await spectraRes.json();

    const peaksRes = await fetch("data/cluster_peaks_structured_manual_curation.json");
    peaksData = await peaksRes.json();

    // Use keys from the JSON directly
    clusterKeys = Object.keys(spectraData.spectra_by_cluster);

    createClusterDropdown(clusterKeys);
    renderCluster(clusterKeys[0]); // default
  } catch (error) {
    console.error("Error loading data:", error);
    alert("Failed to load JSON data. Check file paths or run with a local server.");
  }
}

function createClusterDropdown(clusters) {
  const panel = document.getElementById("controls");
  const select = document.createElement("select");
  select.id = "clusterSelect";

  clusters.forEach(key => {
    const option = document.createElement("option");
    option.value = key;
    option.text = key.replace("Cluster_", "Cluster ");
    select.appendChild(option);
  });

  select.addEventListener("change", e => renderCluster(e.target.value));
  panel.appendChild(select);
}

function renderCluster(clusterKey) {
  if (!spectraData || !spectraData.energy || !spectraData.spectra_by_cluster?.[clusterKey]) {
    console.error("Spectra data missing or invalid for cluster:", clusterKey);
    return;
  }

  const energy = spectraData.energy;
  const intensity = spectraData.spectra_by_cluster[clusterKey];

  // Extract cluster number from "Cluster_0" format
  const clusterId = parseInt(clusterKey.replace("Cluster_", ""));

  const peaks = peaksData.filter(p => p.cluster === clusterId);

  const spectraTrace = {
    x: energy,
    y: intensity,
    mode: 'lines',
    name: `Cluster ${clusterId} Spectrum`,
    line: { color: 'blue' },
    type: 'scatter'
  };

  const peakMarkers = peaks.map(peak => ({
    x: [peak.energy_keV],
    y: [peak.intensity],
    mode: 'markers+text',
    name: peak.matches.map(m => m.element).join(', '),
    text: peak.matches.map(m => m.element).join(', '),
    textposition: 'top center',
    marker: {
      size: 10,
      color: peak.is_ambiguous ? 'red' : 'green',
      symbol: peak.is_ambiguous ? 'cross' : 'circle'
    },
    type: 'scatter'
  }));

  Plotly.newPlot('plot', [spectraTrace, ...peakMarkers], {
    title: `Cluster ${clusterId} - Spectra & Peaks`,
    xaxis: { title: 'Energy (keV)' },
    yaxis: { title: 'Intensity' }
  });

  renderPeakTable(peaks);
}

function renderPeakTable(peaks) {
  const container = document.getElementById("peakTable");
  if (!peaks.length) {
    container.innerHTML = "<p>No peaks available for this cluster.</p>";
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  thead.innerHTML = `
    <tr>
      <th>Energy (keV)</th>
      <th>Intensity</th>
      <th>Matched Elements</th>
      <th>Ambiguous</th>
    </tr>
  `;

  peaks.forEach(peak => {
    const row = document.createElement("tr");
    if (peak.is_ambiguous) row.classList.add("ambiguous");

    row.innerHTML = `
      <td>${peak.energy_keV.toFixed(2)}</td>
      <td>${peak.intensity.toFixed(2)}</td>
      <td>${peak.matches.map(m => `${m.element} (${m.line})`).join(", ")}</td>
      <td>${peak.is_ambiguous ? "Yes" : "No"}</td>
    `;

    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.innerHTML = ""; // clear previous table
  container.appendChild(table);
}

function downloadData() {
  const dataStr = JSON.stringify({ spectraData, peaksData }, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cluster_data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
