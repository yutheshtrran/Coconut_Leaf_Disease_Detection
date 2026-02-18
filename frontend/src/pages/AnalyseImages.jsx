import React, { useState, useRef } from "react";
import { Upload, Image as ImageIcon, Loader2, AlertCircle, CheckCircle, Leaf, RefreshCw, Trash2 } from "lucide-react";

const AnalyseImages = () => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [isDragActive, setIsDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesSelection(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFilesSelection(Array.from(e.target.files));
        }
    };

    const handleFilesSelection = (files) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        const validFiles = [];
        const validPreviews = [];

        files.forEach(file => {
            if (!allowedTypes.includes(file.type)) {
                setError("Please upload valid image files (JPG, PNG, WEBP)");
            } else {
                validFiles.push(file);
                validPreviews.push(URL.createObjectURL(file));
            }
        });

        if (validFiles.length > 0) {
            setSelectedFiles(validFiles);
            setPreviewUrls(validPreviews);
            setResults([]);
            setError(null);
        }
    };

    const handleAnalyse = async () => {
        if (selectedFiles.length === 0) return;

        setLoading(true);
        setError(null);
        setResults([]);

        try {
            for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append("file", file); // Ensure backend expects 'file'

                const response = await fetch("http://127.0.0.1:5000/predict", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    const msg = `Prediction failed for ${file.name} (status ${response.status})`;
                    console.error(msg);
                    setError(msg);
                    continue;
                }

                const data = await response.json();

                // Handle different shapes of backend response
                const pred = data?.prediction || data;
                const diseaseName = pred?.disease || pred?.predicted_class || 'Unknown';
                const confidence = pred?.confidence ?? pred?.percentage ?? 0;
                const severity = pred?.severity_level ?? null;
                const remedy = pred?.remedy ?? null;

                setResults(prev => [...prev, { disease: diseaseName, confidence, severity, remedy }]);
            }
        } catch (err) {
            console.error("Prediction error:", err);
            setError(err.message || "Failed to analyse images. Make sure the ML server is running.");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSelectedFiles([]);
        setPreviewUrls([]);
        setResults([]);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const getSeverityColor = (severity) => {
        switch (severity?.toLowerCase()) {
            case 'high': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
            case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
            case 'low': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
            default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
        }
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.8) return 'bg-green-500';
        if (confidence >= 0.5) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-300">
            <h1 className="text-3xl font-bold text-green-800 dark:text-green-400 mb-2">Analyse Images</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Upload images of coconut leaves or trees to detect diseases using our AI model.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
                {/* Upload Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <Upload size={20} className="text-green-600 dark:text-green-400" />
                        Upload Images
                    </h2>

                    <div
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${isDragActive
                            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                            : "border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500 bg-gray-50 dark:bg-gray-700/50"
                            }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        {previewUrls.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                {previewUrls.map((url, idx) => (
                                    <div key={idx} className="flex flex-col items-center gap-0.5">
                                        <img src={url} alt={`Preview ${idx + 1}`} className="w-full max-h-20 rounded-md shadow-sm object-cover" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate w-full text-center">{selectedFiles[idx]?.name}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <ImageIcon size={48} className="mx-auto text-gray-400 dark:text-gray-500" />
                                <div>
                                    <p className="text-gray-700 dark:text-gray-300 font-medium">
                                        Drag & drop images here
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        or click to browse files
                                    </p>
                                </div>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Supports: JPG, PNG, WEBP
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={handleAnalyse}
                            disabled={selectedFiles.length === 0 || loading}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200 shadow-lg"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Analysing...
                                </>
                            ) : (
                                <>
                                    <Leaf size={20} />
                                    Analyse Images
                                </>
                            )}
                        </button>

                        {selectedFiles.length > 0 && (
                            <button
                                onClick={handleReset}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                            <AlertCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                        </div>
                    )}
                </div>

                {/* Results Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                        Analysis Results
                    </h2>

                    {results.length > 0 ? (
                        <div className="space-y-6">
                            {results.map((res, idx) => (
                                <div key={idx} className="space-y-4 border-b border-gray-200 dark:border-gray-600 pb-4">
                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Detected Disease</p>
                                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 capitalize">
                                            {res.disease.replace(/_/g, ' ')}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Confidence Level</p>
                                            <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                                {(res.confidence * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                                            <div className={`h-3 rounded-full transition-all duration-500 ${getConfidenceColor(res.confidence)}`} style={{ width: `${res.confidence * 100}%` }} />
                                        </div>
                                    </div>

                                    {res.severity && (
                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Severity Level</p>
                                            <span className={`inline-block px-4 py-2 rounded-full font-semibold ${getSeverityColor(res.severity)}`}>
                                                {res.severity}
                                            </span>
                                        </div>
                                    )}

                                    {res.remedy && (
                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Suggested Remedy</p>
                                            <p className="text-gray-800 dark:text-gray-100">{res.remedy}</p>
                                        </div>
                                    )}
                                </div>
                            ))}

                            <button
                                onClick={handleReset}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-200"
                            >
                                <RefreshCw size={18} />
                                Analyse Another Image
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <Leaf size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                            <p className="text-gray-500 dark:text-gray-400">
                                Upload images and click "Analyse Images" to see the results here.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalyseImages;
