import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-green-500 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-white text-2xl font-bold">
          Coconut Leaf Detection
        </h1>
        <ul className="flex space-x-4">
          <li>
            <Link to="/" className="text-white hover:text-gray-200">
              Home
            </Link>
          </li>
          <li>
            <Link to="/upload" className="text-white hover:text-gray-200">
              Upload
            </Link>
          </li>
          <li>
            <Link to="/reports" className="text-white hover:text-gray-200">
              Reports
            </Link>
          </li>
          <li>
            <Link to="/alerts" className="text-white hover:text-gray-200">
              Alerts
            </Link>
          </li>
          <li>
            <Link to="/login" className="text-white hover:text-gray-200">
              Login
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
