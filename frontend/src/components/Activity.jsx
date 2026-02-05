import React from "react";
import { List, UploadCloud, Lock, FileText, Globe, CheckCircle, AlertTriangle } from "lucide-react";

// Helper function to map actions to icons and status colors
const getActivityDetails = (action) => {
  let icon = Globe; // Default icon
  let color = "text-gray-500";
  let status = null;

  if (action.includes("Uploaded drone images")) {
    icon = UploadCloud;
    color = "text-blue-500";
  } else if (action.includes("Updated password")) {
    icon = Lock;
    color = "text-yellow-600";
    status = <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1"><AlertTriangle size={12} /> Security Event</span>;
  } else if (action.includes("Generated disease analysis report")) {
    icon = FileText;
    color = "text-green-600";
  } else if (action.includes("Added new farm plot")) {
    icon = Globe;
    color = "text-purple-500";
  }

  return { icon, color, status };
};

const Activity = () => {
  const activities = [
    { id: 1, action: "Uploaded drone images for Farm A1", time: "2 hours ago" },
    { id: 2, action: "Updated password", time: "Yesterday" },
    { id: 3, action: "Generated disease analysis report", time: "3 days ago" },
    { id: 4, action: "Added new farm plot 'B2'", time: "1 week ago" },
    { id: 5, action: "Logged in successfully from new device (IP 203.0.113.44)", time: "1 day ago" },
    { id: 6, action: "Email alerts setting disabled", time: "1 hour ago" },
  ];

  return (
    // Adopted the modern, centered background layout with dark mode
    <div className="flex flex-col items-center p-4 sm:p-6 w-full transition-colors duration-300">
      <h1 className="text-4xl font-extrabold text-green-800 dark:text-green-400 mb-8 tracking-tight flex items-center gap-3">
        <List size={32} className="text-green-600 dark:text-green-500" /> Recent Activity Log
      </h1>

      {/* Enhanced Card Styling */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 w-full max-w-4xl transition-colors duration-300">

        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          Last 6 Actions
        </h2>

        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {activities.map((item) => {
            const { icon: Icon, color, status } = getActivityDetails(item.action);

            return (
              <li key={item.id} className="py-4 flex items-center justify-between transition duration-150 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 -mx-2 rounded-lg">

                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Icon with colored background */}
                  <div className={`p-3 rounded-full ${color} bg-opacity-10 dark:bg-opacity-20`} style={{ backgroundColor: `${color}10` }}>
                    <Icon size={20} className={color} />
                  </div>

                  {/* Action Description */}
                  <div className="min-w-0">
                    <p className="text-gray-800 dark:text-gray-100 font-medium truncate flex items-center">
                      {item.action}
                      {status}
                    </p>
                    {/* Status/Time stamp */}
                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 block">{item.time}</span>
                  </div>
                </div>

                <CheckCircle size={20} className="text-green-500 dark:text-green-400 flex-shrink-0" title="Action Completed" />
              </li>
            );
          })}
        </ul>

        {/* Call to action or footer */}
        <div className="pt-6 text-center border-t border-gray-100 dark:border-gray-700 mt-6">
          <button className="text-green-600 dark:text-green-400 font-semibold hover:text-green-700 dark:hover:text-green-300 transition duration-150">
            View Full Audit History →
          </button>
        </div>

      </div>
    </div>
  );
};

export default Activity;