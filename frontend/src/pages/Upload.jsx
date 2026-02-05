import React, { useState } from "react";
import { Upload as UploadIcon, ChevronDown } from "lucide-react";

const farms = [
  { id: 1, name: "Green Acres Farm" },
  { id: 2, name: "Sunset Fields Co." },
  { id: 3, name: "Riverbend Plantation" },
];

const Upload = () => {
  const [farm, setFarm] = useState("");
  const [plot, setPlot] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [diseaseLevels, setDiseaseLevels] = useState([]); // aggregated results
  const [diseaseRemedies, setDiseaseRemedies] = useState({}); // map of disease -> remedy
  const [healthyPercent, setHealthyPercent] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFarmChange = (e) => setFarm(e.target.value);
  const handlePlotChange = (e) => setPlot(e.target.value);
  const handleNotesChange = (e) => setNotes(e.target.value);

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleStartAnalysis = async () => {
    if (selectedFiles.length === 0) return alert("Please upload at least one image.");
    setLoading(true);

    const counts = {}; // disease occurrence counts
    const totalImages = selectedFiles.length;

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://127.0.0.1:5000/predict", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();

        // Support responses shaped like { prediction: { disease, confidence, percentage }, ... }
        const pred = data && (data.prediction || data);
        const diseaseName = (pred && (pred.disease || pred.class)) || 'Unknown';
        const confidenceVal = pred && (pred.percentage ?? (pred.confidence != null ? Math.round(pred.confidence * 100) : null));
        const remedy = pred && pred.remedy;

        if (!counts[diseaseName]) counts[diseaseName] = 0;
        counts[diseaseName] += 1;
        // Store remedy for this disease
        if (remedy) {
          setDiseaseRemedies(prev => ({ ...prev, [diseaseName]: remedy }));
        }
        // optionally we could store per-image confidences for later use
      } catch (err) {
        console.error("Prediction error:", err);
      }
    }

    // Convert counts to percentages
    const aggregatedResults = Object.keys(counts).map((name) => ({
      name,
      level: Math.round((counts[name] / totalImages) * 100),
    }));

    // Compute healthy percentage (case-insensitive key match)
    const healthyCount = Object.keys(counts).reduce((acc, n) => acc + ((n && n.toLowerCase() === 'healthy') ? counts[n] : 0), 0);
    const healthyPct = totalImages > 0 ? Math.round((healthyCount / totalImages) * 100) : 0;

    setHealthyPercent(healthyPct);

    setDiseaseLevels(aggregatedResults);
    setLoading(false);
  };

  return (
    <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold text-emerald-800 mb-6">Upload Drone Images</h1>
      <p className="text-gray-700 mb-6">
        Upload leaf or drone images for automated plantation health analysis.
      </p>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 space-y-6 max-w-6xl flex flex-col md:flex-row md:space-x-6">

        {/* LEFT SIDE FORM */}
        <div className="flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Farm</label>
              <div className="relative">
                <select value={farm} onChange={handleFarmChange} className="w-full pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:border-emerald-600 focus:ring-emerald-500 appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="" disabled>Select farm</option>
                  {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-emerald-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Plot/Section <span className="text-gray-500">(Optional)</span>
              </label>
              <input type="text" value={plot} onChange={handlePlotChange} placeholder="e.g., A1, North Section" className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:border-emerald-600 focus:ring-emerald-500 text-gray-900 placeholder-gray-400" />
            </div>
          </div>

          {/* Drag & Drop */}
          <label htmlFor="file-upload" className={`flex flex-col items-center justify-center p-10 rounded-xl border-2 border-dashed transition duration-300 cursor-pointer
            ${isDragActive ? "border-emerald-600 bg-emerald-50" : "border-gray-300 bg-gray-100 hover:bg-gray-200"}`}
            onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
            <UploadIcon className="h-10 w-10 text-emerald-500 mb-3" />
            <p className="text-gray-800 mb-2 font-medium">Drop images here</p>
            <p className="text-gray-500 text-sm mb-4">or click to browse your computer</p>
            <input type="file" id="file-upload" multiple onChange={handleFileSelect} className="hidden" />
            {selectedFiles.length > 0 && <p className="mt-3 text-gray-800 font-medium">{selectedFiles.length} file(s) selected</p>}
            <p className="mt-4 text-gray-500 text-xs">Supported formats: JPG, PNG, TIFF (max 50MB per file)</p>
          </label>

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-800 mb-1">Notes <span className="text-gray-500">(Optional)</span></label>
            <textarea value={notes} onChange={handleNotesChange} rows={4} placeholder="Add any observations or context about this flight..." className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:border-emerald-600 focus:ring-emerald-500 text-gray-900 placeholder-gray-400" />
          </div>

          <div className="mt-6 text-right">
            <button type="button" onClick={handleStartAnalysis} disabled={loading} className="inline-flex items-center justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition duration-150">
              {loading ? "Analyzing..." : "Start Analysis"}
            </button>
          </div>
        </div>

        {/* RIGHT SIDE PANEL */}
        <div className="mt-6 md:mt-0 w-full md:w-1/3 bg-gray-100 p-5 rounded-xl shadow-inner border border-gray-200 flex flex-col space-y-6">
          <div>
            <h3 className="text-emerald-800 font-semibold mb-4 text-center">Disease Levels</h3>
            <div className="text-center mb-4">
              <span className="text-sm text-gray-600">Healthy:</span>
              <div className="text-2xl font-semibold text-emerald-700">{healthyPercent != null ? `${healthyPercent}%` : '--'}</div>
            </div>
            {diseaseLevels.length > 0 ? (
              diseaseLevels.map((disease, idx) => (
                <div key={idx} className="mb-4">
                  <div className="flex justify-between mb-1 text-sm text-gray-700 font-medium">
                    <span>{disease.name}</span>
                    <span>{disease.level}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div className="bg-emerald-600 h-4 rounded-full" style={{ width: `${disease.level}%` }} />
                  </div>
                  {diseaseRemedies[disease.name] && (
                    <p className="text-xs text-gray-600 mt-2 italic">
                      <strong>Remedy:</strong> {diseaseRemedies[disease.name]}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 text-sm">No predictions yet</p>
            )}
          </div>

          <div>
            <h3 className="text-emerald-800 font-semibold mb-4 text-center">Uploaded Images</h3>
            {selectedFiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {selectedFiles.slice(0, 4).map((file, idx) => (
                  <img key={idx} src={URL.createObjectURL(file)} alt={file.name} className="w-full h-24 object-cover rounded-lg border border-gray-300 shadow-sm" />
                ))}
                {selectedFiles.length > 4 && (
                  <p className="col-span-2 text-center text-gray-600 text-sm mt-2">+{selectedFiles.length - 4} more</p>
                )}
              </div>
            ) : <p className="text-center text-gray-500 text-sm">No images uploaded yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
