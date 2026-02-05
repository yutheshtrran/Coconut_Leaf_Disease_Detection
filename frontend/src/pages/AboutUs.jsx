import React from "react";
import {
  Palmtree,
  Target,
  Eye,
  Users,
  Map,
  BarChart,
  Globe,
  CheckCircle2
} from "lucide-react";

const AboutUs = () => {
  const stats = [
    { label: "Farms Monitored", value: "500+", icon: Map },
    { label: "Hectares Covered", value: "10,000+", icon: Globe },
    { label: "Analyses Completed", value: "50,000+", icon: BarChart },
    { label: "Active Users", value: "1,200+", icon: Users },
  ];

  const values = [
    {
      title: "Innovation",
      description:
        "Leveraging cutting-edge technology to solve agricultural challenges",
    },
    {
      title: "Sustainability",
      description:
        "Promoting sustainable farming practices through data-driven insights",
    },
    {
      title: "Accessibility",
      description:
        "Making advanced farm management tools accessible to all farmers",
    },
    {
      title: "Excellence",
      description:
        "Delivering accurate, reliable, and actionable agricultural intelligence",
    },
  ];

  return (
    <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900 min-h-screen font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-600 to-green-800 text-white p-10 rounded-2xl shadow-lg mb-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Palmtree className="absolute top-10 right-10 w-32 h-32 text-white/50" />
          <Globe className="absolute bottom-5 left-10 w-24 h-24 text-white/50" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-white p-3 rounded-xl shadow-lg">
              <Palmtree className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
              CocoGuard
            </h1>
          </div>
          <p className="text-green-100 text-lg md:text-xl max-w-3xl mt-2">
            Empowering coconut farmers with intelligent drone analytics and
            real-time plantation health monitoring.
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-12">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="text-center bg-white dark:bg-gray-800 rounded-xl p-6 border border-green-200 dark:border-green-800/50 shadow-md hover:shadow-xl transition-all hover:scale-[1.03]"
            >
              <Icon className="w-8 h-8 mx-auto mb-3 text-green-600 dark:text-green-400" />
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-green-700 dark:text-green-400 mb-1 break-words">
                {stat.value}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Mission & Vision */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-l-green-600 dark:border-l-green-500 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">Our Mission</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            To revolutionize coconut plantation management through innovative
            drone technology and AI-powered analytics, helping farmers maximize
            yields, reduce losses, and practice sustainable agriculture.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600 dark:border-l-blue-500 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400">Our Vision</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            To become the leading agricultural intelligence platform in
            Southeast Asia, transforming how coconut plantations are managed and
            monitored.
          </p>
        </div>
      </div>

      {/* Core Values */}
      <div>
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6 border-b dark:border-gray-700 pb-2">
          Our Core Values
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {values.map((value, idx) => (
            <div
              key={idx}
              className="flex flex-col p-5 bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-gray-700 shadow-sm hover:bg-green-50 dark:hover:bg-gray-700 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <h4 className="text-lg font-bold text-green-700 dark:text-green-400 break-words">
                  {value.title}
                </h4>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{value.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 text-center text-gray-600 dark:text-gray-400 border-t dark:border-gray-700 pt-6">
        <p className="text-sm font-medium">
          © {new Date().getFullYear()} CocoGuard. All rights reserved. | Making agriculture smarter,
          one farm at a time.
        </p>
      </div>
    </div>
  );
};

export default AboutUs;
