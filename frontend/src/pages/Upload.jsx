import React, { useState, useEffect } from "react";
import { Upload as UploadIcon, ChevronDown, AlertCircle, CheckCircle } from "lucide-react";
import * as farmService from "../services/farmService";
import API from "../services/api";

const Upload = () => {
  const [farm, setFarm] = useState("");
  const [plot, setPlot] = useState("");
  const [farms, setFarms] = useState([]);
  const [plots, setPlots] = useState([]);
  const [farmLoading, setFarmLoading] = useState(true);
  const [plotLoading, setPlotLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [diseaseLevels, setDiseaseLevels] = useState([]); // aggregated results
  const [diseaseRemedies, setDiseaseRemedies] = useState({}); // map of disease -> remedy
  const [healthyPercent, setHealthyPercent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [videoAnalysis, setVideoAnalysis] = useState(null); // Video analysis results
  const [uploadType, setUploadType] = useState(null); // 'image' or 'video'
  const [droneResult, setDroneResult] = useState(null); // Drone processing results
  const [showDroneModal, setShowDroneModal] = useState(false); // Modal for drone results
  const [reportMessage, setReportMessage] = useState(''); // Report save feedback
  const [reportError, setReportError] = useState('');

  // Fetch farms on component mount
  useEffect(() => {
    const loadFarms = async () => {
      try {
        setFarmLoading(true);
        const response = await farmService.getUserFarms();
        setFarms(response.farms || []);
      } catch (err) {
        console.error("Error loading farms:", err);
      } finally {
        setFarmLoading(false);
      }
    };

    loadFarms();
  }, []);

  // Fetch plots when farm is selected
  useEffect(() => {
    if (!farm) {
      setPlots([]);
      return;
    }

    const loadPlots = async () => {
      try {
        setPlotLoading(true);
        const response = await farmService.getFarmPlots(farm);
        setPlots(response.plots || []);
      } catch (err) {
        console.error("Error loading plots:", err);
        setPlots([]);
      } finally {
        setPlotLoading(false);
      }
    };

    loadPlots();
  }, [farm, farms]);

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
    setReportMessage('');
    setReportError('');

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

    // Save analysis as report to backend
    await saveAnalysisReport(aggregatedResults, healthyPct);
    
    setLoading(false);
  };

  const saveAnalysisReport = async (diseases, healthyPercent) => {
    if (!farm) {
      setReportError('Please select a farm before analyzing');
      return;
    }

    try {
      // Determine primary issue and severity
      let primaryIssue = 'Plantation Health Analysis';
      let maxSeverityValue = 0;
      let maxSeverityLabel = 'LOW';

      if (diseases.length > 0) {
        // Find the disease with highest percentage
        const worstDisease = diseases.reduce((prev, current) => 
          (prev.level > current.level) ? prev : current
        );
        
        primaryIssue = `${worstDisease.name} detected (${worstDisease.level}%)`;
        maxSeverityValue = worstDisease.level;
        
        // Determine severity label based on percentage
        if (maxSeverityValue >= 75) {
          maxSeverityLabel = 'CRITICAL';
        } else if (maxSeverityValue >= 50) {
          maxSeverityLabel = 'HIGH';
        } else if (maxSeverityValue >= 25) {
          maxSeverityLabel = 'MODERATE';
        } else {
          maxSeverityLabel = 'LOW';
        }
      }

      const reportData = {
        farm,
        date: new Date().toISOString().split('T')[0],
        issue: primaryIssue,
        severity: {
          value: maxSeverityValue,
          label: maxSeverityLabel
        },
        status: 'Finalized',
        plotId: plot || null,
        note: notes || null,
        analysisData: {
          totalImagesAnalyzed: selectedFiles.length,
          healthyPercent,
          diseases: diseases.map(d => ({ name: d.name, percentage: d.level }))
        }
      };

      const response = await API.post('/reports', reportData);
      setReportMessage('Analysis saved as report successfully!');
      
      // Clear message after 3 seconds
      setTimeout(() => setReportMessage(''), 3000);
    } catch (err) {
      console.error('Error saving analysis as report:', err);
      setReportError(err.response?.data?.message || 'Failed to save analysis report');
    }
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

  const handleDroneProcessing = async () => {
    if (selectedFiles.length < 2) {
      alert("Please select at least 2 images for drone processing");
      return;
    }

    setLoading(true);
    setVideoAnalysis(null);
    setHealthyPercent(null);
    setDiseaseLevels([]);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("http://127.0.0.1:5000/process-drone-images", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Drone processing failed: ${data.error || 'Unknown error'}`);
        setLoading(false);
        return;
      }

      setDroneResult(data);
      setShowDroneModal(true);
    } catch (err) {
      console.error("Drone processing error:", err);
      alert("Error processing drone images. Make sure the backend supports drone processing.");
    }

    setLoading(false);
  };

  return (
    <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold text-emerald-800 mb-6">Upload Drone Images</h1>
      <p className="text-gray-700 mb-6">
        Upload leaf or drone images for automated plantation health analysis.
      </p>

      {/* Report Messages */}
      {reportMessage && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-3">
          <CheckCircle size={20} />
          {reportMessage}
        </div>
      )}
      {reportError && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} />
          {reportError}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 space-y-6 max-w-6xl flex flex-col md:flex-row md:space-x-6">

        {/* LEFT SIDE FORM */}
        <div className="flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Farm</label>
              <div className="relative">
                <select 
                  value={farm} 
                  onChange={handleFarmChange} 
                  disabled={farmLoading}
                  className="w-full pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:border-emerald-600 focus:ring-emerald-500 appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>{farmLoading ? "Loading farms..." : "Select farm"}</option>
                  {farms.map((f) => (
                    <option key={f._id} value={f._id}>{f.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-emerald-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Plot/Section
              </label>
              <div className="relative">
                <select 
                  value={plot} 
                  onChange={handlePlotChange} 
                  disabled={!farm || plotLoading || plots.length === 0}
                  className="w-full pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:border-emerald-600 focus:ring-emerald-500 appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>
                    {plotLoading ? "Loading plots..." : plots.length === 0 ? "No plots available" : "Select plot"}
                  </option>
                  {plots.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name || p.id}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-emerald-400 pointer-events-none" />
              </div>
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

          <div className="mt-6 text-right space-x-4">
            <button type="button" onClick={handleStartAnalysis} disabled={loading} className="inline-flex items-center justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition duration-150">
              {loading ? "Analyzing..." : "Start Analysis"}
            </button>
            <button type="button" onClick={handleDroneProcessing} disabled={loading || selectedFiles.length < 2} className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-50">
              {loading ? "Processing..." : "Process Drone Images"}
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

      {/* Drone Processing Modal */}
      {showDroneModal && droneResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-emerald-800">Drone Image Analysis Results</h2>
                <button
                  onClick={() => setShowDroneModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                  <p className="text-sm text-emerald-600 mb-1">Trees Detected</p>
                  <div className="text-3xl font-bold text-emerald-700">{droneResult.num_trees}</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-600 mb-1">Images Processed</p>
                  <div className="text-3xl font-bold text-blue-700">{selectedFiles.length}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-600 mb-1">Healthy Trees</p>
                  <div className="text-3xl font-bold text-green-700">
                    {droneResult.segmentation_stats?.healthy_trees || 0}
                  </div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-red-600 mb-1">Diseased Trees</p>
                  <div className="text-3xl font-bold text-red-700">
                    {droneResult.segmentation_stats?.diseased_trees || 0}
                  </div>
                </div>
              </div>

              {/* Health Percentage */}
              {droneResult.segmentation_stats && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                  <div className="flex justify-between mb-2">
                    <p className="text-sm text-gray-600">Overall Farm Health</p>
                    <span className="font-semibold text-emerald-700">
                      {droneResult.segmentation_stats.health_percentage?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-emerald-600 h-3 rounded-full"
                      style={{ width: `${droneResult.segmentation_stats.health_percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Estimated Farm Size: {droneResult.segmentation_stats.estimated_farm_size?.toFixed(1)} hectares
                  </p>
                </div>
              )}
                {/* Annotated Image */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Annotated Panorama</h3>
                  <div className="flex justify-center">
                    <img
                      src={droneResult.annotated_image}
                      alt="Annotated panorama with tree detections"
                      className="max-w-full h-auto rounded-lg shadow-lg border border-gray-300"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2 text-center">
                    Red circles show detected coconut trees with unique IDs
                  </p>
                </div>

                {/* Tree Data Table */}
                {droneResult.tree_data && droneResult.tree_data.length > 0 && (
                  <div className="bg-white p-4 rounded-lg border border-gray-300">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Detected Trees</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full table-auto">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Tree ID</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Bounding Box</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Disease Status</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Health %</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {droneResult.tree_data.map((tree, idx) => (
                            <tr key={idx} className="border-t border-gray-200">
                              <td className="px-4 py-2 text-sm text-gray-900">{tree.id}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                [{tree.bbox.join(', ')}]
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  tree.disease?.toLowerCase() === 'healthy'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {tree.disease || 'Unknown'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {tree.health_percentage ? `${tree.health_percentage.toFixed(1)}%` : 'N/A'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {tree.confidence ? `${(tree.confidence * 100).toFixed(1)}%` : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Close Button */}
                <div className="text-center">
                  <button
                    onClick={() => setShowDroneModal(false)}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-md transition duration-150"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
