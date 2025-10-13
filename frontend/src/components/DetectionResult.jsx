import React from 'react';

const DetectionResult = ({ result }) => {
  return (
    <div className="p-4 border rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-2">Detection Result</h2>
      {result ? (
        <div>
          <p className="text-lg">Detected Issue: {result.issue}</p>
          <p className="text-md">Confidence: {result.confidence}%</p>
          {result.imageUrl && (
            <img
              src={result.imageUrl}
              alt="Detection Result"
              className="mt-2 rounded"
            />
          )}
        </div>
      ) : (
        <p className="text-md text-gray-500">No results to display.</p>
      )}
    </div>
  );
};

export default DetectionResult;
