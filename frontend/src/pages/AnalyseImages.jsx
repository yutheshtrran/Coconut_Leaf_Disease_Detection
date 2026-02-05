import React, { useState, useRef } from "react";
import { Upload, Image as ImageIcon, Loader2, AlertCircle, CheckCircle, Leaf, RefreshCw, Trash2 } from "lucide-react";

const AnalyseImages = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
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
            handleFileSelection(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    };

    const handleFileSelection = (file) => {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            setError("Please upload a valid image file (JPG, PNG, WEBP)");
            return;
        }
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setResult(null);
        setError(null);
    };

    const handleAnalyse = async () => {
        if (!selectedFile) return;

        setLoading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append("file", selectedFile);

        try {
            const response = await fetch("http://127.0.0.1:5000/predict", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to analyse image. Please try again.");
            }

            const data = await response.json();
            setResult(data);
        } catch (err) {
            console.error("Prediction error:", err);
            setError(err.message || "Failed to analyse image. Please ensure the ML server is running.");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setResult(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
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
                Upload an image of a coconut leaf or tree to detect diseases using our AI model.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
                {/* Left: Upload Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <Upload size={20} className="text-green-600 dark:text-green-400" />
                        Upload Image
                    </h2>

                    {/* Drag & Drop Zone */}
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
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {previewUrl ? (
                            <div className="space-y-4">
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="max-h-64 mx-auto rounded-lg shadow-md object-contain"
                                />
                                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedFile?.name}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <ImageIcon size={48} className="mx-auto text-gray-400 dark:text-gray-500" />
                                <div>
                                    <p className="text-gray-700 dark:text-gray-300 font-medium">
                                        Drag & drop an image here
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

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={handleAnalyse}
                            disabled={!selectedFile || loading}
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
                                    Analyse Image
                                </>
                            )}
                        </button>

                        {selectedFile && (
                            <button
                                onClick={handleReset}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                            <AlertCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                        </div>
                    )}
                </div>

                {/* Right: Results Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                        Analysis Results
                    </h2>

                    {result ? (
                        <div className="space-y-6">
                            {/* Disease Detected */}
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Detected Disease</p>
                                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 capitalize">
                                    {result.predicted_class?.replace(/_/g, ' ') || result.disease?.replace(/_/g, ' ') || 'Unknown'}
                                </p>
                            </div>

                            {/* Confidence */}
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Confidence Level</p>
                                    <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                        {((result.confidence || 0) * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-500 ${getConfidenceColor(result.confidence)}`}
                                        style={{ width: `${(result.confidence || 0) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Severity */}
                            {result.severity_level && (
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Severity Level</p>
                                    <span className={`inline-block px-4 py-2 rounded-full font-semibold ${getSeverityColor(result.severity_level)}`}>
                                        {result.severity_level}
                                    </span>
                                </div>
                            )}

                            {/* Analyse Again Button */}
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
                                Upload an image and click "Analyse Image" to see the results here.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalyseImages;
