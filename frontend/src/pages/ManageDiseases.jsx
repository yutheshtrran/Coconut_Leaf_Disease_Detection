import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, AlertCircle, Save, X, Eye, Image as ImageIcon } from 'lucide-react';
import api from '../services/api';

const ManageDiseases = () => {
  const [diseases, setDiseases] = useState([]);
  const [formData, setFormData] = useState({ name: '', description: '', impact: '', remedy: '' });
  const [images, setImages] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState(null);

  useEffect(() => {
    fetchDiseases();
  }, []);

  const fetchDiseases = async () => {
    try {
      const res = await api.get('/diseases');
      setDiseases(res.data);
    } catch (err) {
      setMessage({ text: 'Failed to load diseases', type: 'error' });
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleImages = (e) => setImages(Array.from(e.target.files));

  const resetForm = () => {
    setFormData({ name: '', description: '', impact: '', remedy: '' });
    setImages([]);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return setMessage({ text: 'Disease name required', type: 'error' });
    }

    setLoading(true);
    const data = new FormData();
    data.append('name', formData.name.trim());
    data.append('description', formData.description);
    data.append('impact', formData.impact);
    data.append('remedy', formData.remedy);
    images.forEach((img) => data.append('images', img));

    // Custom config to let browser set multipart/form-data boundary
    const config = {
      headers: {
        // Do NOT set Content-Type — browser will handle it
      },
    };

    try {
      if (editingId) {
        await api.put(`/diseases/${editingId}`, data, config);
        setMessage({ text: 'Updated successfully', type: 'success' });
      } else {
        await api.post('/diseases', data, config);
        setMessage({ text: 'Added successfully', type: 'success' });
      }
      resetForm();
      fetchDiseases();
    } catch (err) {
      console.error('Upload error:', err);
      setMessage({ text: 'Operation failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (disease) => {
    setFormData({
      name: disease.name,
      description: disease.description,
      impact: disease.impact,
      remedy: disease.remedy,
    });
    setImages([]);
    setEditingId(disease._id);
    window.scrollTo(0, 0);
  };

  const deleteDisease = async (id) => {
    if (!window.confirm('Delete this disease?')) return;
    try {
      await api.delete(`/diseases/${id}`);
      setMessage({ text: 'Deleted', type: 'success' });
      fetchDiseases();
    } catch (err) {
      setMessage({ text: 'Delete failed', type: 'error' });
    }
  };

  const openModal = (disease) => {
    setSelectedDisease(disease);
    setModalOpen(true);
  };

  return (
    <div className="ml-64 pt-14 p-4 sm:p-8 bg-gray-50 min-h-screen font-['Inter', sans-serif]" style={{ marginTop: '1cm' }}>
      <div className="max-w-7xl mx-auto">

        <h1 className="text-2xl font-bold text-gray-800 mb-8">Manage Diseases</h1>

        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            <AlertCircle className="mr-2" size={20} />
            {message.text}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-10">
          <h2 className="text-xl font-semibold mb-4">{editingId ? 'Edit Disease' : 'Add New Disease'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Disease Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sample Images (optional)</label>
                <input type="file" name="images" multiple accept="image/*" onChange={handleImages} className="w-full" />
                {images.length > 0 && <p className="text-sm text-gray-600 mt-1">{images.length} file(s) selected</p>}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="w-full border border-gray-300 rounded-lg px-4 py-2" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Impact</label>
              <textarea name="impact" value={formData.impact} onChange={handleChange} rows="3" className="w-full border border-gray-300 rounded-lg px-4 py-2" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Remedy</label>
              <textarea name="remedy" value={formData.remedy} onChange={handleChange} rows="4" className="w-full border border-gray-300 rounded-lg px-4 py-2" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center">
                <Save size={18} className="mr-2" />
                {loading ? 'Saving...' : editingId ? 'Update' : 'Add Disease'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 flex items-center">
                  <X size={18} className="mr-2" /> Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Cards */}
        <h2 className="text-xl font-semibold mb-4">Saved Diseases ({diseases.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {diseases.map((disease) => {
            const visibleImages = disease.samples?.slice(0, 3) || [];
            const moreCount = (disease.samples?.length || 0) - 3;

            return (
              <div key={disease._id} className="bg-white rounded-xl shadow-md p-5">
                <h3 className="text-lg font-bold text-gray-800">{disease.name}</h3>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2"><strong>Description:</strong> {disease.description || '—'}</p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2"><strong>Impact:</strong> {disease.impact || '—'}</p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2"><strong>Remedy:</strong> {disease.remedy || '—'}</p>

                {visibleImages.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2 flex items-center">
                      <ImageIcon size={16} className="mr-1" /> Sample Images ({disease.samples?.length || 0})
                    </p>
                    <div className="grid grid-cols-3 gap-2 relative">
                      {visibleImages.map((img, i) => (
                        <img key={i} src={`http://localhost:5000${img}`} alt={`Sample ${i + 1}`} className="w-full h-24 object-cover rounded border border-gray-200" />
                      ))}
                      {moreCount > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded text-white font-bold text-lg">
                          +{moreCount} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mt-6">
                  <button onClick={() => openModal(disease)} className="text-indigo-600 hover:text-indigo-800 flex items-center">
                    <Eye size={18} className="mr-1" /> View Details
                  </button>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(disease)} className="text-blue-600 hover:text-blue-800"><Edit2 size={20} /></button>
                    <button onClick={() => deleteDisease(disease._id)} className="text-red-600 hover:text-red-800"><Trash2 size={20} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal */}
        {modalOpen && selectedDisease && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold">{selectedDisease.name}</h2>
                <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
              </div>
              <p className="text-gray-700 mb-4"><strong>Description:</strong> {selectedDisease.description || '—'}</p>
              <p className="text-gray-700 mb-4"><strong>Impact:</strong> {selectedDisease.impact || '—'}</p>
              <p className="text-gray-700 mb-6"><strong>Remedy:</strong> {selectedDisease.remedy || '—'}</p>

              {(selectedDisease.samples?.length || 0) > 0 && (
                <div>
                  <p className="text-lg font-semibold mb-4">All Sample Images ({selectedDisease.samples.length})</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {selectedDisease.samples.map((img, i) => (
                      <img key={i} src={`http://localhost:5000${img}`} alt={`Full sample ${i + 1}`} className="w-full h-48 object-cover rounded-lg border border-gray-300 shadow" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {diseases.length === 0 && <p className="text-center text-gray-500 text-lg mt-12">No diseases added yet.</p>}

      </div>
    </div>
  );
};

export default ManageDiseases;