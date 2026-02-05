import React from 'react';
import { Link } from 'react-router-dom';

export default function AuthLayout({ children, title }) {
  const PalmTreeLogo = () => (
    <svg
      className="w-8 h-8 mr-2 text-white"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v20" />
      <path d="M17 7c-2 2-2 7-2 7s-5 0-7 2" />
      <path d="M7 7c2 2 2 7 2 7s5 0 7 2" />
      <path d="M12 2l-3 3" />
      <path d="M12 2l3 3" />
    </svg>
  );

  const LeftPanel = () => (
    <div className="flex flex-col justify-between p-8 md:p-16 w-full md:w-5/12 text-white min-h-[300px] md:h-screen bg-[#387637] relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div
          className="absolute -right-24 -bottom-24 text-[150px] transform rotate-12 select-none"
          style={{ filter: 'grayscale(100%) blur(3px)' }}
        >
          🌴
        </div>
        <div
          className="absolute left-0 top-0 text-7xl transform -rotate-45 select-none"
          style={{ filter: 'grayscale(100%) blur(3px)' }}
        >
          🌿
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex items-center mb-16">
          <PalmTreeLogo />
          <span className="text-xl font-semibold">CocoGuard</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6">Smart Coconut Farm Management</h1>
        <p className="text-lg mb-12 opacity-90">Monitor your plantation health with advanced drone analytics and real-time insights.</p>

        <div className="space-y-6">
          {[
            { title: 'Real-time Monitoring', desc: 'Track plantation health across all your farms' },
            { title: 'Drone Analytics', desc: 'Advanced flight data analysis and reporting' },
            { title: 'Smart Alerts', desc: 'Get notified of critical farm conditions' },
          ].map((feature, index) => (
            <div key={index} className="flex items-start">
              <span className="text-[#A4C936] text-2xl mr-4 mt-0.5 font-bold">✓</span>
              <div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="opacity-80 text-sm">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-16 text-sm opacity-70 relative z-10">© {new Date().getFullYear()} CocoGuard. All rights reserved.</p>
    </div>
  );

  const RightPanel = () => (
    <div className="w-full md:w-7/12 p-8 pt-16 md:p-16 md:pt-24 flex items-center justify-center bg-white h-auto md:h-screen relative overflow-y-auto">
      <div className="w-full max-w-md">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">{title || 'Authenticate'}</h2>
        {children}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row font-[Inter] bg-gray-100">
      {LeftPanel()}
      {RightPanel()}
    </div>
  );
}
