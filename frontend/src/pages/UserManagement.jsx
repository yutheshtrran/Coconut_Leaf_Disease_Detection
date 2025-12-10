import React, { useState } from 'react';

// Mock data
const initialUsers = [
  { id: 'USR-001', name: 'Admin', phone: '+94 77 711 1111', email: 'admin@cocoguard.com', role: 'Admin', status: 'Active', lastLogin: '2023-10-26' },
  { id: 'USR-002', name: 'John Farmer', phone: '+94 77 722 2222', email: 'john@example.com', role: 'Farmer', status: 'Active', lastLogin: '2023-10-25' },
  { id: 'USR-003', name: 'Sarah Admin', phone: '+94 77 733 3333', email: 'sarah@example.com', role: 'Admin', status: 'Active', lastLogin: '2023-10-26' },
  { id: 'USR-004', name: 'Mike Farmer', phone: '+94 77 744 4444', email: 'mike@example.com', role: 'Farmer', status: 'Active', lastLogin: '2023-10-24' },
  { id: 'USR-005', name: 'Emily Agronomist', phone: '+94 77 755 5555', email: 'emily@example.com', role: 'Agronomist', status: 'Inactive', lastLogin: '2023-10-15' },
  { id: 'USR-006', name: 'David Farmer', phone: '+94 77 766 6666', email: 'david@example.com', role: 'Farmer', status: 'Active', lastLogin: '2023-10-23' },
  { id: 'USR-007', name: 'Lisa Admin', phone: '+94 77 777 7777', email: 'lisa@example.com', role: 'Admin', status: 'Active', lastLogin: '2023-10-26' },
];

// Role badge helper
const getRoleStyle = (role) => {
  switch (role) {
    case 'Admin': return 'bg-green-100 text-green-700';
    case 'Farmer': return 'bg-blue-100 text-blue-700';
    case 'Agronomist': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

// Status badge helper
const getStatusStyle = (status) => {
  return status === 'Active' ? 'bg-green-500 text-white' : 'bg-gray-400 text-white';
};

// Table component
const UserTable = ({ users }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full table-auto border-separate border-spacing-y-2">
      <thead className="text-gray-500 text-sm uppercase bg-white border-b-2 border-gray-100">
        <tr>
          <th className="py-3 px-6 text-left">User ID</th>
          <th className="py-3 px-6 text-left">Name</th>
          <th className="py-3 px-6 text-left">Phone</th>
          <th className="py-3 px-6 text-left">Email</th>
          <th className="py-3 px-6 text-left">Role</th>
          <th className="py-3 px-6 text-left">Status</th>
          <th className="py-3 px-6 text-left">Last Login</th>
          <th className="py-3 px-6 text-center">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white">
        {users.map(user => (
          <tr key={user.id} className="shadow-sm hover:shadow-lg transition-shadow duration-200 border-b border-gray-100">
            <td className="py-3 px-6 whitespace-nowrap text-sm font-medium text-gray-900 rounded-l-xl">{user.id}</td>
            <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-700">{user.name}</td>
            <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-700">{user.phone}</td>
            <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
            <td className="py-3 px-6 whitespace-nowrap">
              <span className={`inline-flex items-center px-4 py-1 text-xs font-semibold rounded-full ${getRoleStyle(user.role)}`}>
                {user.role}
              </span>
            </td>
            <td className="py-3 px-6 whitespace-nowrap">
              <span className={`inline-flex items-center px-4 py-1 text-xs font-semibold rounded-full ${getStatusStyle(user.status)}`}>
                {user.status}
              </span>
            </td>
            <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-700">{user.lastLogin}</td>
            <td className="py-3 px-6 whitespace-nowrap text-sm rounded-r-xl">
              <div className="flex items-center justify-center space-x-2">
                <button className="text-gray-600 hover:text-indigo-600 transition duration-150 p-2 text-sm font-medium rounded-lg border border-gray-300">Edit</button>
                <button className="text-red-500 hover:text-white hover:bg-red-500 transition duration-150 p-2 text-sm font-medium rounded-lg border border-red-500">Deactivate</button>
                <button className="text-gray-400 hover:text-gray-700 transition duration-150 p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Filters component
const Filters = () => {
  const allRoles = ['All Roles', 'Admin', 'Farmer', 'Agronomist'];
  const [selectedRole, setSelectedRole] = useState(allRoles[0]);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mb-6">
      <div className="relative flex-grow sm:flex-grow-0">
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="w-full sm:w-48 py-2.5 pl-4 pr-10 border border-gray-300 bg-white rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
        >
          {allRoles.map(role => <option key={role} value={role}>{role}</option>)}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
      <div className="flex-1 relative">
        <input
          type="text"
          placeholder="Search by Name / Email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full py-2.5 pl-4 pr-10 border border-gray-300 bg-white rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
    </div>
  );
};

// Pagination component
const Pagination = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 2;
  const PageButton = ({ page, isCurrent }) => (
    <button
      onClick={() => setCurrentPage(page)}
      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-150 ${isCurrent ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      {page}
    </button>
  );
  return (
    <div className="flex justify-start items-center space-x-2 mt-8">
      <button
        onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-4 py-2 text-sm font-semibold rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
      >
        Previous
      </button>
      <PageButton page={1} isCurrent={currentPage === 1} />
      <PageButton page={2} isCurrent={currentPage === 2} />
      <button
        onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-4 py-2 text-sm font-semibold rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
      >
        Next
      </button>
    </div>
  );
};

// Main component
const UserManagement = () => {
  const users = initialUsers;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      {/* Wrapper to move content right without affecting left side */}
      <div style={{ marginLeft: '5cm' }}>
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-8">

          {/* Header */}
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Access and Roles</h1>
            <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition duration-150 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add New User
            </button>
          </div>

          {/* Filters */}
          <Filters />

          {/* User Table */}
          <UserTable users={users} />

          {/* Pagination */}
          <Pagination />

        </div>
      </div>
    </div>
  );
};

export default UserManagement;
