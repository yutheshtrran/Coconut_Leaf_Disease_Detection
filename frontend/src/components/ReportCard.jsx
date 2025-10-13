import React from 'react';

const ReportCard = ({ report }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-4 mb-4">
      <h2 className="text-xl font-bold mb-2">{report.title}</h2>
      <p className="text-gray-700">{report.description}</p>
      <div className="mt-4">
        <span className="text-sm text-gray-500">Date: {report.date}</span>
      </div>
    </div>
  );
};

export default ReportCard;
