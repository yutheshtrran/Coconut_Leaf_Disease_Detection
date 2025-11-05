import React from "react";
import { Link, useLocation } from "react-router-dom";

const NavLink = ({ name, icon: Icon, to }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);

  const baseClasses =
    "flex items-center space-x-3 p-3 ml-2 text-gray-700 transition duration-150 ease-in-out cursor-pointer rounded-xl hover:bg-green-50/70";
  const activeClasses = isActive
    ? "bg-green-100/70 text-green-700 font-semibold shadow-inner"
    : "text-gray-700 hover:text-green-600";

  return (
    <Link to={to} className={`${baseClasses} ${activeClasses}`}>
      <Icon className="w-5 h-5" />
      <span className="text-base">{name}</span>
    </Link>
  );
};

export default NavLink;
