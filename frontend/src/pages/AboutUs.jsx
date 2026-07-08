import React from "react";
import {
  Palmtree,
  Target,
  Eye,
  Globe,
  CheckCircle2,
  MapPin,
  FileBarChart2,
  Cpu,
  Leaf,
  ShieldCheck,
  Camera,
  Video,
} from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "Drone Image Analysis",
    description:
      "Upload aerial drone images to instantly detect coconut leaf diseases using a YOLOv8 deep-learning model trained on plantation data.",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800/40",
  },
  {
    icon: Video,
    title: "Drone Video Mapping",
    description:
      "Process drone footage to generate a full plantation map with per-tree disease classification and GPS-tagged positions.",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800/40",
  },
  {
    icon: Leaf,
    title: "Leaf-Level Detection",
    description:
      "Identify specific diseases — Black Beetle Attack, Magnesium Deficiency, Potassium Deficiency, Yellow Patches — from close-up leaf images.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800/40",
  },
  {
    icon: MapPin,
    title: "GPS Farm Mapping",
    description:
      "Automatically extract GPS coordinates from drone image EXIF data and pin analysis results to your registered farm locations.",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800/40",
  },
  {
    icon: FileBarChart2,
    title: "Automated Reports",
    description:
      "Generate detailed PDF reports with disease summaries, annotated detection images, severity ratings, and treatment recommendations.",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800/40",
  },
  {
    icon: ShieldCheck,
    title: "Farm Management",
    description:
      "Manage multiple farms and plots, track health history over time, and maintain a complete record of every analysis run.",
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    border: "border-teal-200 dark:border-teal-800/40",
  },
];

const steps = [
  {
    step: "01",
    title: "Capture",
    description: "Fly your drone over the plantation and capture images or video footage of the coconut trees.",
    color: "bg-green-600",
  },
  {
    step: "02",
    title: "Upload & Analyse",
    description: "Upload the footage to CocoGuard. The AI model processes each tree and detects signs of disease.",
    color: "bg-blue-600",
  },
  {
    step: "03",
    title: "Review Results",
    description: "View an annotated plantation map, per-tree disease classification, and confidence scores.",
    color: "bg-purple-600",
  },
  {
    step: "04",
    title: "Act",
    description: "Export a detailed report with treatment recommendations and GPS coordinates for targeted intervention.",
    color: "bg-orange-600",
  },
];

const values = [
  { title: "Innovation",     description: "Leveraging cutting-edge AI to solve real agricultural challenges." },
  { title: "Sustainability", description: "Promoting sustainable farming practices through data-driven insights." },
  { title: "Accessibility",  description: "Making advanced farm management tools accessible to every farmer." },
  { title: "Excellence",     description: "Delivering accurate, reliable, and actionable agricultural intelligence." },
];

const AboutUs = () => {
  return (
    <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900 min-h-screen font-sans transition-colors duration-300">

      {/* Hero header */}
      <div className="bg-gradient-to-br from-green-600 to-green-800 text-white p-10 rounded-2xl shadow-lg mb-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Palmtree className="absolute top-10 right-10 w-32 h-32" />
          <Globe className="absolute bottom-5 left-10 w-24 h-24" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-white p-3 rounded-xl shadow-lg">
              <Palmtree className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">CocoGuard</h1>
          </div>
          <p className="text-green-100 text-lg md:text-xl max-w-3xl mt-2">
            Empowering coconut farmers with intelligent drone analytics and
            real-time plantation health monitoring.
          </p>
        </div>
      </div>

      {/* Mission & Vision */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-l-green-600 dark:border-l-green-500 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">Our Mission</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            To revolutionize coconut plantation management through innovative drone
            technology and AI-powered analytics, helping farmers maximize yields,
            reduce losses, and practice sustainable agriculture.
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600 dark:border-l-blue-500 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400">Our Vision</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            To become the leading agricultural intelligence platform in Southeast
            Asia, transforming how coconut plantations are managed and monitored
            through accessible, accurate, and actionable AI tools.
          </p>
        </div>
      </div>

      {/* Key Features */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">What CocoGuard Does</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          A complete platform for drone-based coconut plantation disease detection and management.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className={`flex flex-col gap-3 p-5 rounded-xl border shadow-sm ${f.bg} ${f.border} hover:shadow-md transition-shadow`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm`}>
                  <Icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className={`font-bold text-base ${f.color}`}>{f.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">How It Works</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">From flight to actionable insight in four steps.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm flex flex-col gap-3">
              <span className={`text-xs font-black tracking-widest text-white ${s.color} rounded-full w-9 h-9 flex items-center justify-center`}>
                {s.step}
              </span>
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">{s.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Technology */}
      <div className="mb-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-6 h-6 text-green-600 dark:text-green-400" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">The Technology</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-1">AI Detection Model</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              YOLOv8 object detection model fine-tuned on annotated coconut plantation imagery to classify diseases with per-tree bounding boxes and confidence scores.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-1">Drone Data Pipeline</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Processes both still images and video frames. GPS coordinates are extracted directly from EXIF metadata embedded in DJI and compatible drone images.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-1">Full-Stack Platform</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              React frontend, Node.js/Express backend, MongoDB database, Python/Flask ML service — all containerised and deployable via Docker Compose.
            </p>
          </div>
        </div>
      </div>

      {/* Core Values */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6 border-b dark:border-gray-700 pb-2">
          Our Core Values
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {values.map((v, i) => (
            <div
              key={i}
              className="flex flex-col p-5 bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-gray-700 shadow-sm hover:bg-green-50 dark:hover:bg-gray-700 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <h4 className="text-lg font-bold text-green-700 dark:text-green-400">{v.title}</h4>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{v.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 text-center text-gray-600 dark:text-gray-400 border-t dark:border-gray-700 pt-6">
        <p className="text-sm font-medium">
          © {new Date().getFullYear()} CocoGuard. All rights reserved. | Making agriculture smarter, one farm at a time.
        </p>
      </div>
    </div>
  );
};

export default AboutUs;
