let spectraData = null;
let peaksData = null;
let clusterKeys = [];
let currentClusterId = null;
let selectedPeakIndex = null;

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

  currentClusterId = parseInt(clusterKey.replace("Cluster_", ""));
  selectedPeakIndex = null;

  const energy = spectraData.energy;
  const intensity = spectraData.spectra_by_cluster[clusterKey];
  const peaks = peaksData.filter(p => p.cluster === currentClusterId);

  const spectraTrace = {
    x: energy,
    y: intensity,
    mode: 'lines',
    name: `Cluster ${currentClusterId} Spectrum`,
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
    title: `Cluster ${currentClusterId} - Spectra & Peaks`,
    xaxis: { title: 'Energy (keV)' },
    yaxis: { title: 'Intensity' }
  });

  renderPeakTable(peaks);
  clearEditorForm();
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

  peaks.forEach((peak, index) => {
    const row = document.createElement("tr");
    if (peak.is_ambiguous) row.classList.add("ambiguous");

    row.innerHTML = `
      <td>${peak.energy_keV.toFixed(2)}</td>
      <td>${peak.intensity.toFixed(2)}</td>
      <td>${peak.matches.map(m => `${m.element} (${m.line})`).join(", ")}</td>
      <td>${peak.is_ambiguous ? "Yes" : "No"}</td>
    `;

    row.addEventListener("click", () => {
      selectedPeakIndex = peaksData.findIndex(p => p.cluster === currentClusterId && p.energy_keV === peak.energy_keV);
      showEditorForm(peaksData[selectedPeakIndex]);
    });

    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.innerHTML = "";
  container.appendChild(table);
}

function showEditorForm(peak) {
  const form = document.getElementById("peakEditor");
  form.innerHTML = `
    <h3>Edit Peak</h3>
    <label>Energy (keV)</label>
    <input type="text" value="${peak.energy_keV.toFixed(2)}" readonly />

    <label>Intensity</label>
    <input type="text" value="${peak.intensity.toFixed(2)}" readonly />

    <label>Matched Elements</label>
    <input type="text" id="editElements" value="${peak.matches.map(m => `${m.element} (${m.line})`).join(", ")}" />

    <label>Ambiguous</label>
    <input type="checkbox" id="editAmbiguous" ${peak.is_ambiguous ? "checked" : ""} />

    <label>Notes</label>
    <textarea id="editNotes">${peak.notes || ""}</textarea>

    <button onclick="savePeakEdits()">Save Changes</button>
  `;
}

function clearEditorForm() {
  document.getElementById("peakEditor").innerHTML = "";
}

function savePeakEdits() {
  if (selectedPeakIndex == null) return;

  const elementsStr = document.getElementById("editElements").value;
  const isAmbiguous = document.getElementById("editAmbiguous").checked;
  const notes = document.getElementById("editNotes").value;

  const matches = elementsStr.split(",").map(part => {
    const [element, line] = part.trim().split("(");
    return {
      element: element.trim(),
      line: line ? line.replace(")", "").trim() : ""
    };
  });

  const peak = peaksData[selectedPeakIndex];
  peak.matches = matches;
  peak.is_ambiguous = isAmbiguous;
  peak.notes = notes;

  renderCluster("Cluster_" + currentClusterId); // refresh everything
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
