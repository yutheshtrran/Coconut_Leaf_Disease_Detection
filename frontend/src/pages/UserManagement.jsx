<<<<<<< HEAD
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
=======
import React, { useEffect, useMemo, useState } from 'react';
import API from '../services/api';
import { Trash2, MoreHorizontal } from 'lucide-react';

const ITEMS_PER_PAGE = 5;
>>>>>>> origin/dev-m3

// Role badge helper
const getRoleStyle = (role) => {
  const map = {
    admin: 'bg-green-100 text-green-700',
    farmer: 'bg-blue-100 text-blue-700',
    agronomist: 'bg-yellow-100 text-yellow-700',
    general: 'bg-gray-100 text-gray-700',
  };
  return map[role] || 'bg-gray-100 text-gray-700';
};

// Status badge helper
const getStatusStyle = (status) => {
  return status === 'active' ? 'bg-green-500 text-white' : 'bg-gray-400 text-white';
};

// Confirmation Modal Component
function DeleteConfirmModal({ user, onConfirm, onCancel, isLoading }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Delete User</h2>
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete <strong>{user?.username}</strong> ({user?.email})? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={isLoading} className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Table component
<<<<<<< HEAD
const UserTable = ({ users }) => (
=======
const UserTable = ({ users, onChangeRole, onDeactivate, onActivate, onDelete }) => (
>>>>>>> origin/dev-m3
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
<<<<<<< HEAD
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
=======
        {users.length === 0 ? (
          <tr><td colSpan="7" className="py-4 px-6 text-center text-gray-500">No users found</td></tr>
        ) : (
          users.map((user, idx) => (
            <tr key={user._id} className="shadow-sm hover:shadow-lg transition-shadow duration-200 border-b border-gray-100">
              <td className="py-3 px-6 whitespace-nowrap text-sm font-medium text-gray-900">{user._id.slice(-6).toUpperCase()}</td>
              <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-700">{user.username}</td>
              <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-700">{user.phoneNumber || '-'}</td>
              <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
              <td className="py-3 px-6 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${getRoleStyle(user.role)}`}>
                    {user.role && user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                  <select value={user.role} onChange={(e) => onChangeRole(user, e.target.value)} className="border rounded px-2 py-1 text-xs">
                    {['admin', 'farmer', 'agronomist', 'general'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
              </td>
              <td className="py-3 px-6 whitespace-nowrap">
                <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${getStatusStyle(user.status)}`}>
                  {user.status && user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                </span>
              </td>
              <td className="py-3 px-6 whitespace-nowrap text-sm">
                <div className="flex items-center justify-center gap-2">
                  {user.status === 'active' ? (
                    <button onClick={() => onDeactivate(user)} className="px-3 py-1 text-red-500 border border-red-500 rounded-lg hover:bg-red-50 text-xs font-medium">Deactivate</button>
                  ) : (
                    <button onClick={() => onActivate(user)} className="px-3 py-1 text-green-600 border border-green-600 rounded-lg hover:bg-green-50 text-xs font-medium">Activate</button>
                  )}
                  <button onClick={() => onDelete(user)} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
>>>>>>> origin/dev-m3
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
      </div>
      <div className="flex-1 relative">
        <input
          type="text"
          placeholder="Search by ID / Name / Phone / Email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full py-2.5 pl-4 pr-10 border border-gray-300 bg-white rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
    </div>
  );
};

// Pagination component
const Pagination = ({ currentPage, setCurrentPage, totalPages }) => {
  return (
    <div className="flex justify-start items-center gap-2 mt-6">
      <button
        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
        disabled={currentPage === 1}
        className="px-4 py-2 text-sm font-semibold rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
        <button
          key={page}
          onClick={() => setCurrentPage(page)}
          className={`px-3 py-2 text-sm font-semibold rounded-lg ${
            currentPage === page ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {page}
        </button>
      ))}
      <button
        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
        className="px-4 py-2 text-sm font-semibold rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
};

// Main component
const UserManagement = () => {
<<<<<<< HEAD
  const users = initialUsers;
=======
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [searchQuery, setSearchQuery] = useState('');
  const [notif, setNotif] = useState(null);
  const [isAdmin, setIsAdmin] = useState(true);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const show = (type, message) => { setNotif({ type, message }); setTimeout(() => setNotif(null), 3000); };

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data } = await API.get('/auth/me');
        setIsAdmin(data?.user?.role === 'admin');
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const { data } = await API.get('/users');
        setUsers(data.users || []);
      } catch (err) {
        show('error', err?.response?.data?.message || 'Failed to load users');
      } finally { setLoading(false); }
    };
    loadUsers();
  }, []);

  const onChangeRole = async (user, role) => {
    try {
      const { data } = await API.put(`/users/${user._id}`, { role });
      setUsers(prev => prev.map(u => u._id === user._id ? data.user : u));
      show('success', 'Role updated');
    } catch (err) {
      show('error', err?.response?.data?.message || 'Update failed');
    }
  };

  const onDeactivate = async (user) => {
    try {
      const { data } = await API.put(`/users/${user._id}`, { status: 'inactive' });
      setUsers(prev => prev.map(u => u._id === user._id ? data.user : u));
      show('success', 'User deactivated');
    } catch (err) { show('error', 'Action failed'); }
  };

  const onActivate = async (user) => {
    try {
      const { data } = await API.put(`/users/${user._id}`, { status: 'active' });
      setUsers(prev => prev.map(u => u._id === user._id ? data.user : u));
      show('success', 'User activated');
    } catch (err) { show('error', 'Action failed'); }
  };

  const onDelete = (user) => {
    setDeleteTarget(user);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await API.delete(`/users/${deleteTarget._id}/admin`);
      setUsers(prev => prev.filter(u => u._id !== deleteTarget._id));
      show('success', 'User deleted');
      setDeleteTarget(null);
      setCurrentPage(1);
    } catch (err) {
      show('error', err?.response?.data?.message || 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const roleMap = {
      'Admin': 'admin',
      'Farmer': 'farmer',
      'Agronomist': 'agronomist',
      'General User': 'general',
    };
    const selected = roleMap[selectedRole] || 'all';
    return users.filter(u => {
      const roleOk = selectedRole === 'All Roles' || u.role === selected;
      const q = searchQuery.trim().toLowerCase();
      const searchOk = !q || 
        (u._id && u._id.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) || 
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phoneNumber && u.phoneNumber.toLowerCase().includes(q));
      return roleOk && searchOk;
    });
  }, [users, selectedRole, searchQuery]);
>>>>>>> origin/dev-m3

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedUsers = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <div style={{ marginLeft: '5cm' }}>
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Access and Roles</h1>
<<<<<<< HEAD
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

=======
            <div className="flex items-center gap-2">
              <input value={promoteEmail} onChange={(e) => setPromoteEmail(e.target.value)} placeholder="Promote by email" className="px-3 py-2 border rounded-lg" />
              <button onClick={async () => {
                if (!promoteEmail.trim()) return;
                try {
                  const { data } = await API.put('/users/promote', { email: promoteEmail.trim() });
                  setUsers(prev => prev.map(u => u.email === promoteEmail.trim() ? data.user : u));
                  setPromoteEmail('');
                  show('success', 'Promoted to admin');
                } catch (err) {
                  show('error', err?.response?.data?.message || 'Promotion failed');
                }
              }} className="px-4 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition duration-150">Promote</button>
            </div>
          </div>

          {!isAdmin ? (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">You do not have permission to view this page.</div>
          ) : (
            <>
              <Filters selectedRole={selectedRole} setSelectedRole={setSelectedRole} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
              {notif && <div className={`mb-4 p-3 rounded ${notif.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{notif.message}</div>}
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <>
                  <UserTable users={paginatedUsers} onChangeRole={onChangeRole} onDeactivate={onDeactivate} onActivate={onActivate} onDelete={onDelete} />
                  <Pagination currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={totalPages} />
                </>
              )}
            </>
          )}
>>>>>>> origin/dev-m3
        </div>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal user={deleteTarget} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} isLoading={isDeleting} />
      )}
    </div>
  );
};

export default UserManagement;

