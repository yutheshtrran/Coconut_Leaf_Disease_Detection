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
    <div className="ml-64 pt-16 p-8 bg-gray-100 min-h-screen font-sans">
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
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-12">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="text-center bg-white rounded-xl p-6 border border-green-200 shadow-md hover:shadow-xl transition-transform hover:scale-[1.03]"
            >
              <Icon className="w-8 h-8 mx-auto mb-3 text-green-600" />
              <p className="text-4xl font-extrabold text-green-700 mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Mission & Vision */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="bg-green-50 border-l-4 border-l-green-600 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold text-green-700">Our Mission</h2>
          </div>
          <p className="text-gray-700 leading-relaxed">
            To revolutionize coconut plantation management through innovative
            drone technology and AI-powered analytics, helping farmers maximize
            yields, reduce losses, and practice sustainable agriculture.
          </p>
        </div>

        <div className="bg-blue-50 border-l-4 border-l-blue-600 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-blue-700">Our Vision</h2>
          </div>
          <p className="text-gray-700 leading-relaxed">
            To become the leading agricultural intelligence platform in
            Southeast Asia, transforming how coconut plantations are managed and
            monitored.
          </p>
        </div>
      </div>

      {/* Core Values */}
      <div>
        <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-2">
          Our Core Values
        </h2>
        <div className="grid md:grid-cols-4 gap-4">
          {values.map((value, idx) => (
            <div
              key={idx}
              className="flex flex-col p-5 bg-white rounded-xl border border-green-200 shadow-sm hover:bg-green-50 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h4 className="text-lg font-bold text-green-700">
                  {value.title}
                </h4>
              </div>
              <p className="text-sm text-gray-700">{value.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 text-center text-gray-600 border-t pt-6">
        <p className="text-sm font-medium">
          © {new Date().getFullYear()} CocoGuard. All rights reserved. | Making agriculture smarter,
          one farm at a time.
        </p>
      </div>
    </div>
  );
};

export default AboutUs;
