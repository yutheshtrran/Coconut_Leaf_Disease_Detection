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
  const [videoAnalysis, setVideoAnalysis] = useState(null); // Video analysis results
  const [uploadType, setUploadType] = useState(null); // 'image' or 'video'

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
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(files);
      // detect type for dropped files
      const firstFile = files[0];
      const isVideo = firstFile.type && firstFile.type.startsWith('video/');
      setUploadType(isVideo ? 'video' : 'image');
    }
  };
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
      // Detect file type (image or video)
      const firstFile = e.target.files[0];
      const isVideo = firstFile.type.startsWith('video/');
      setUploadType(isVideo ? 'video' : 'image');
    }
  };

  const isVideoFile = (file) => file.type.startsWith('video/');

  const handleStartAnalysis = async () => {
    if (selectedFiles.length === 0) return alert("Please upload at least one file.");
    
    const firstFile = selectedFiles[0];
    const isVideo = isVideoFile(firstFile);

    if (isVideo) {
      // Handle video analysis
      await handleVideoAnalysis(firstFile);
    } else {
      // Handle image analysis
      await handleImageAnalysis();
    }
  };

  const handleImageAnalysis = async () => {
    setLoading(true);
    setVideoAnalysis(null);

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

  const handleVideoAnalysis = async (videoFile) => {
    setLoading(true);
    setHealthyPercent(null);
    setDiseaseLevels([]);

    const formData = new FormData();
    formData.append("file", videoFile);

    try {
      const response = await fetch("http://127.0.0.1:5000/analyze-video", {
        method: "POST",
        body: formData,
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error('Failed to parse JSON response from /analyze-video', parseErr);
      }

      if (!response.ok) {
        const msg = (data && (data.error || data.message)) || `Server returned ${response.status}`;
        console.error('Video analysis failed:', response.status, data);
        alert(`Video analysis failed: ${msg}`);
        setLoading(false);
        return;
      }

      // Parse video analysis response
      const analysis = {
        coconutTreesFound: data.coconut_trees_found || data.tree_count || 0,
        farmSize: data.farm_size || data.area || 0,
        farmSizeUnit: data.farm_size_unit || 'hectares',
        healthyTrees: data.healthy_trees || 0,
        diseasedTrees: data.diseased_trees || 0,
        treeHealth: data.tree_health_percentage || 0,
        diseaseBreakdown: data.disease_breakdown || {},
        canopyDensity: data.canopy_density || 0,
        videoProcessed: true,
      };

      setVideoAnalysis(analysis);
    } catch (err) {
      console.error("Video analysis error:", err);
      alert("Error analyzing video. Make sure the backend supports video analysis.");
    }

    setLoading(false);
  };

  return (
    <div className="ml-64 pt-16 p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-emerald-800 mb-6">Upload Drone Images</h1>
      <p className="text-gray-700 mb-6">
        Upload leaf or drone images for automated plantation health analysis.
      </p>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 space-y-6 max-w-6xl flex flex-col md:flex-row md:space-x-6">

        {/* LEFT SIDE FORM */}
        <div className="flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-800 mb-1">Farm</label>
              <select value={farm} onChange={handleFarmChange} className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg shadow-sm focus:border-emerald-600 focus:ring-emerald-500 appearance-none bg-white text-gray-900">
                <option value="" disabled>Select farm</option>
                {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-emerald-400 pointer-events-none" />
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
            <input type="file" id="file-upload" multiple onChange={handleFileSelect} accept="image/jpeg,image/png,image/tiff,video/mp4,video/avi,video/quicktime,video/x-msvideo" className="hidden" />
            {selectedFiles.length > 0 && <p className="mt-3 text-gray-800 font-medium">{selectedFiles.length} file(s) selected</p>}
            <p className="mt-4 text-gray-500 text-xs">Supported formats: JPG, PNG, TIFF, MP4, AVI, MOV (max 50MB per file)</p>
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
          
          {videoAnalysis ? (
            // VIDEO ANALYSIS RESULTS
            <div>
              <h3 className="text-emerald-800 font-semibold mb-4 text-center">Video Analysis Results</h3>
              
              {/* Coconut Trees Found */}
              <div className="mb-4 bg-white p-4 rounded-lg border border-gray-300">
                <p className="text-sm text-gray-600 mb-1">Coconut Trees Found</p>
                <div className="text-3xl font-bold text-emerald-700">{videoAnalysis.coconutTreesFound}</div>
              </div>

              {/* Farm Size */}
              <div className="mb-4 bg-white p-4 rounded-lg border border-gray-300">
                <p className="text-sm text-gray-600 mb-1">Farm Size</p>
                <div className="text-2xl font-bold text-emerald-700">
                  {videoAnalysis.farmSize} <span className="text-sm text-gray-600">{videoAnalysis.farmSizeUnit}</span>
                </div>
              </div>

              {/* Tree Health Percentage */}
              <div className="mb-4 bg-white p-4 rounded-lg border border-gray-300">
                <div className="flex justify-between mb-2">
                  <p className="text-sm text-gray-600">Overall Tree Health</p>
                  <span className="font-semibold text-emerald-700">{videoAnalysis.treeHealth}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-emerald-600 h-3 rounded-full" style={{ width: `${videoAnalysis.treeHealth}%` }} />
                </div>
              </div>

              {/* Healthy vs Diseased Trees */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <p className="text-xs text-gray-600">Healthy Trees</p>
                  <div className="text-xl font-bold text-green-700">{videoAnalysis.healthyTrees}</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <p className="text-xs text-gray-600">Diseased Trees</p>
                  <div className="text-xl font-bold text-red-700">{videoAnalysis.diseasedTrees}</div>
                </div>
              </div>

              {/* Canopy Density */}
              <div className="bg-white p-4 rounded-lg border border-gray-300">
                <div className="flex justify-between mb-2">
                  <p className="text-sm text-gray-600">Canopy Density</p>
                  <span className="font-semibold text-blue-700">{videoAnalysis.canopyDensity}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${videoAnalysis.canopyDensity}%` }} />
                </div>
              </div>

              {/* Disease Breakdown */}
              {Object.keys(videoAnalysis.diseaseBreakdown).length > 0 && (
                <div className="bg-white p-4 rounded-lg border border-gray-300">
                  <p className="text-sm font-semibold text-gray-800 mb-3">Disease Breakdown</p>
                  {Object.entries(videoAnalysis.diseaseBreakdown).map(([disease, count], idx) => (
                    <div key={idx} className="mb-2 flex justify-between text-sm">
                      <span className="text-gray-700">{disease}</span>
                      <span className="font-semibold text-gray-800">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // IMAGE ANALYSIS RESULTS
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
          )}

          <div>
            <h3 className="text-emerald-800 font-semibold mb-4 text-center">Uploaded Files</h3>
            {selectedFiles.length > 0 ? (
              <div>
                {uploadType === 'video' ? (
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-white text-sm">📹 {selectedFiles[0].name}</div>
                    <div className="text-gray-400 text-xs mt-1">
                      {(selectedFiles[0].size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedFiles.slice(0, 4).map((file, idx) => (
                      <img key={idx} src={URL.createObjectURL(file)} alt={file.name} className="w-full h-24 object-cover rounded-lg border border-gray-300 shadow-sm" />
                    ))}
                    {selectedFiles.length > 4 && (
                      <p className="col-span-2 text-center text-gray-600 text-sm mt-2">+{selectedFiles.length - 4} more</p>
                    )}
                  </div>
                )}
              </div>
            ) : <p className="text-center text-gray-500 text-sm">No files uploaded yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
