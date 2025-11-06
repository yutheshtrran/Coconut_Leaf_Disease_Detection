import React, { useState } from "react";
import { Upload as UploadIcon, ChevronDown } from "lucide-react";

// Mock list of farms for the dropdown
const farms = [
  { id: 1, name: "Green Acres Farm" },
  { id: 2, name: "Sunset Fields Co." },
  { id: 3, name: "Riverbend Plantation" },
];

// Mock disease data
const diseaseLevels = [
  { name: "Leaf Spot", level: 70 },
  { name: "Powdery Mildew", level: 40 },
  { name: "Rust", level: 20 },
];

const Upload = () => {
  const [farm, setFarm] = useState("");
  const [plot, setPlot] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFarmChange = (e) => setFarm(e.target.value);
  const handlePlotChange = (e) => setPlot(e.target.value);
  const handleNotesChange = (e) => setNotes(e.target.value);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
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

  return (
    <div className="ml-64 pt-16 p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-emerald-800 mb-6">Upload Drone Images</h1>
      <p className="text-gray-700 mb-6">
        Upload leaf or drone images for automated plantation health analysis.
      </p>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 space-y-6 max-w-6xl flex flex-col md:flex-row md:space-x-6">

        {/* LEFT SIDE FORM */}
        <div className="flex-1 space-y-6">
          {/* Farm & Plot Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Farm
              </label>
              <select
                value={farm}
                onChange={handleFarmChange}
                className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg shadow-sm focus:border-emerald-600 focus:ring-emerald-500 appearance-none bg-white text-gray-900"
              >
                <option value="" disabled>
                  Select farm
                </option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-emerald-400 pointer-events-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Plot/Section <span className="text-gray-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={plot}
                onChange={handlePlotChange}
                placeholder="e.g., A1, North Section"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:border-emerald-600 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Drag & Drop Upload */}
          <label
            htmlFor="file-upload"
            className={`flex flex-col items-center justify-center p-10 rounded-xl border-2 border-dashed transition duration-300 cursor-pointer
              ${
                isDragActive
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-gray-300 bg-gray-100 hover:bg-gray-200"
              }
            `}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <UploadIcon className="h-10 w-10 text-emerald-500 mb-3" />
            <p className="text-gray-800 mb-2 font-medium">Drop images here</p>
            <p className="text-gray-500 text-sm mb-4">or click to browse your computer</p>

            <input
              type="file"
              id="file-upload"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFiles.length > 0 && (
              <p className="mt-3 text-gray-800 font-medium">
                {selectedFiles.length} file(s) selected
              </p>
            )}

            <p className="mt-4 text-gray-500 text-xs">
              Supported formats: JPG, PNG, TIFF (max 50MB per file)
            </p>
          </label>

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Notes <span className="text-gray-500">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={handleNotesChange}
              rows={4}
              placeholder="Add any observations or context about this flight..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:border-emerald-600 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
            />
          </div>

          {/* Submit Button */}
          <div className="mt-6 text-right">
            <button
              type="button"
              className="inline-flex items-center justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition duration-150"
            >
              Start Analysis
            </button>
          </div>
        </div>

        {/* RIGHT SIDE PANEL */}
        <div className="mt-6 md:mt-0 w-full md:w-1/3 bg-gray-100 p-5 rounded-xl shadow-inner border border-gray-200 flex flex-col space-y-6">

          {/* Disease Levels */}
          <div>
            <h3 className="text-emerald-800 font-semibold mb-4 text-center">
              Disease Levels
            </h3>
            {diseaseLevels.map((disease) => (
              <div key={disease.name} className="mb-4">
                <div className="flex justify-between mb-1 text-sm text-gray-700 font-medium">
                  <span>{disease.name}</span>
                  <span>{disease.level}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-emerald-600 h-4 rounded-full"
                    style={{ width: `${disease.level}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Uploaded Image Preview */}
          <div>
            <h3 className="text-emerald-800 font-semibold mb-4 text-center">
              Uploaded Images
            </h3>
            {selectedFiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {selectedFiles.slice(0, 4).map((file, idx) => (
                  <img
                    key={idx}
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-24 object-cover rounded-lg border border-gray-300 shadow-sm"
                  />
                ))}
                {selectedFiles.length > 4 && (
                  <p className="col-span-2 text-center text-gray-600 text-sm mt-2">
                    +{selectedFiles.length - 4} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm">
                No images uploaded yet
              </p>
            )}
          </div>

          {/* Recommended Actions */}
          <div className="bg-emerald-50 p-4 rounded-xl border border-gray-200 shadow-inner">
            <h3 className="text-emerald-800 font-semibold mb-3 text-center">
              Recommended Actions
            </h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>Apply fungicide treatment to affected areas.</li>
              <li>Increase canopy airflow through pruning.</li>
              <li>Schedule follow-up drone scan in 7 days.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
