import React from "react";

const AboutUs = () => {
  return (
    <div className="ml-64 pt-16 p-8 bg-gray-100 min-h-screen">
      {/* 
        ml-64 = offset for sidebar width (if you have a sidebar)
        pt-16 = offset for Navbar height
      */}
      <h1 className="text-3xl font-bold mb-6">About Us</h1>
      <p className="text-gray-700 mb-4">
        Welcome to CocoLeaf Detect! We are committed to providing AI-powered solutions for the early detection of coconut leaf diseases.
      </p>
      <p className="text-gray-700 mb-4">
        Our mission is to help farmers monitor the health of their coconut plantations, reduce losses, and improve crop yields through advanced technology.
      </p>
      <p className="text-gray-700">
        Navigate through our platform to upload leaf images, view historical analysis reports, and receive alerts for potential issues in your plantation.
      </p>
    </div>
  );
};

export default AboutUs;
