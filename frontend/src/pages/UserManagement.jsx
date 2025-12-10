import React, { useEffect, useMemo, useState } from 'react';
import API from '../services/api';

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
const UserTable = ({ users, onChangeRole, onDeactivate, onActivate }) => (
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
          <th className="py-3 px-6 text-center">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white">
        {users.map((user, idx) => (
          <tr key={user._id} className="shadow-sm hover:shadow-lg transition-shadow duration-200 border-b border-gray-100">
            <td className="py-3 px-6 whitespace-nowrap text-sm font-medium text-gray-900 rounded-l-xl">USR-{String(idx+1).padStart(3,'0')}</td>
            <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-700">{user.username}</td>
            <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-700">{user.phoneNumber || '-'}</td>
            <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
            <td className="py-3 px-6 whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-4 py-1 text-xs font-semibold rounded-full ${getRoleStyle(user.role)}`}>
                  {user.role && user.role.charAt(0).toUpperCase()+user.role.slice(1)}
                </span>
                <select value={user.role} onChange={(e)=>onChangeRole(user, e.target.value)} className="border rounded px-2 py-1 text-xs">
                  {['admin','farmer','agronomist','general'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                </select>
              </div>
            </td>
            <td className="py-3 px-6 whitespace-nowrap">
              <span className={`inline-flex items-center px-4 py-1 text-xs font-semibold rounded-full ${getStatusStyle(user.status)}`}>
                {user.status}
              </span>
            </td>
            <td className="py-3 px-6 whitespace-nowrap text-sm rounded-r-xl">
              <div className="flex items-center justify-center space-x-2">
                {user.status === 'active' ? (
                  <button onClick={()=>onDeactivate(user)} className="text-red-500 hover:text-white hover:bg-red-500 transition duration-150 p-2 text-sm font-medium rounded-lg border border-red-500">Deactivate</button>
                ) : (
                  <button onClick={()=>onActivate(user)} className="text-green-600 hover:text-white hover:bg-green-600 transition duration-150 p-2 text-sm font-medium rounded-lg border border-green-600">Activate</button>
                )}
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
const Filters = ({ selectedRole, setSelectedRole, searchQuery, setSearchQuery }) => {
  const allRoles = ['All Roles', 'Admin', 'Farmer', 'Agronomist', 'General User'];
  return (
    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mb-6">
      <div className="relative flex-grow sm:flex-grow-0">
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="w-full sm:w-56 py-2.5 pl-4 pr-10 border border-gray-300 bg-white rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [searchQuery, setSearchQuery] = useState('');
  const [notif, setNotif] = useState(null);
  const [isAdmin, setIsAdmin] = useState(true);
  const [promoteEmail, setPromoteEmail] = useState('');

  const show = (type, message) => { setNotif({ type, message }); setTimeout(()=>setNotif(null), 3000); };

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
      const searchOk = !q || (u.username && u.username.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q));
      return roleOk && searchOk;
    });
  }, [users, selectedRole, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      {/* Wrapper to move content right without affecting left side */}
      <div style={{ marginLeft: '5cm' }}>
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-8">

          {/* Header */}
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Access and Roles</h1>
            <div className="flex items-center gap-2">
              <input value={promoteEmail} onChange={(e)=>setPromoteEmail(e.target.value)} placeholder="Promote by email" className="px-3 py-2 border rounded-lg" />
              <button onClick={async()=>{
                if (!promoteEmail.trim()) return;
                try {
                  const { data } = await API.put('/users/promote', { email: promoteEmail.trim() });
                  setUsers(prev => prev.map(u => u.email === promoteEmail.trim() ? data.user : u));
                  show('success', 'Promoted to admin');
                } catch (err) {
                  show('error', err?.response?.data?.message || 'Promotion failed');
                }
              }} className="px-4 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition duration-150 shadow-md">Promote</button>
            </div>
          </div>

          {/* Admin-only guard */}
          {!isAdmin && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">You do not have permission to view this page.</div>
          )}
          {isAdmin && (
            <>
              {/* Filters */}
              <Filters selectedRole={selectedRole} setSelectedRole={setSelectedRole} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

              {/* Notifications */}
              {notif && (
                <div className={`mb-4 p-3 rounded ${notif.type==='success'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{notif.message}</div>
              )}

              {/* User Table */}
              <UserTable users={filtered} onChangeRole={onChangeRole} onDeactivate={onDeactivate} onActivate={onActivate} />
            </>
          )}

          {/* Pagination */}
          <Pagination />

        </div>
      </div>
    </div>
  );
};

export default UserManagement;
