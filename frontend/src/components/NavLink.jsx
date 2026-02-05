import React from "react";
import { Link, useLocation } from "react-router-dom";

const NavLink = ({ name, icon: Icon, to }) => {
  const location = useLocation();
  // For root path '/', use exact match; for other paths, use startsWith
  const isActive = to === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(to);

  const baseClasses =
    "flex items-center space-x-3 p-3 ml-2 text-gray-700 dark:text-gray-300 transition duration-150 ease-in-out cursor-pointer rounded-xl hover:bg-green-50/70 dark:hover:bg-green-900/30";
  const activeClasses = isActive
    ? "bg-green-100/70 dark:bg-green-800/50 text-green-700 dark:text-green-400 font-semibold shadow-inner"
    : "text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400";

  return (
    <Link to={to} className={`${baseClasses} ${activeClasses}`}>
      <Icon className="w-5 h-5" />
      <span className="text-base">{name}</span>
    </Link>
  );
};

export default NavLink;

