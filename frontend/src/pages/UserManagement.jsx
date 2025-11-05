import React from "react";

const UserManagement = () => {
  return (
    <div className="ml-64 pt-16 p-8 bg-gray-100 min-h-screen">
      {/* 
        ml-64 = offset for sidebar width
        pt-16 = offset for Navbar height
      */}
      <h1 className="text-3xl font-bold mb-6">User Management Page</h1>
      <p>Manage users and their roles here.</p>
    </div>
  );
};

export default UserManagement;
