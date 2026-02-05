import React, { useState, useEffect } from 'react';
import api from '../services/api';

// INLINE ICONS
const Edit2 = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);
const Trash2 = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);
const AlertCircle = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const Save = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);
const X = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const Eye = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const ImageIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
  </svg>
);

// API Base
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ManageDiseases() {
  const [diseases, setDiseases] = useState([]);
  const [formData, setFormData] = useState({ name: '', description: '', impact: '', remedy: '' });
  const [images, setImages] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState(null);

  useEffect(() => { fetchDiseases(); }, []);

  const fetchDiseases = async () => {
    try {
      const res = await api.get('/diseases');
      setDiseases(res.data);
    } catch (err) {
      setMessage({ text: 'Failed to fetch diseases', type: 'error' });
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleImages = (e) => setImages(Array.from(e.target.files));

  const resetForm = () => {
    setFormData({ name: '', description: '', impact: '', remedy: '' });
    setImages([]);
    setEditingId(null);
  };

  const getImageSrc = (img) => img.startsWith('http') ? img : `${API_BASE}${img}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const data = new FormData();
      data.append('name', formData.name.trim());
      data.append('description', formData.description);
      data.append('impact', formData.impact);
      data.append('remedy', formData.remedy);
      images.forEach(img => data.append('images', img));

      if (editingId) await api.put(`/diseases/${editingId}`, data);
      else await api.post('/diseases', data);

      setMessage({ text: editingId ? 'Record updated!' : 'Record added!', type: 'success' });
      await fetchDiseases();
      resetForm();
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to save disease', type: 'error' });
    } finally { setLoading(false); }
  };

  const startEdit = (disease) => {
    setFormData({ name: disease.name, description: disease.description, impact: disease.impact, remedy: disease.remedy });
    setImages([]);
    setEditingId(disease._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteDisease = async (id) => {
    if (!window.confirm('Are you sure to delete this record?')) return;
    try {
      await api.delete(`/diseases/${id}`);
      setMessage({ text: 'Record deleted!', type: 'success' });
      fetchDiseases();
    } catch {
      setMessage({ text: 'Failed to delete', type: 'error' });
    }
  };

  const openModal = (disease) => { setSelectedDisease(disease); setModalOpen(true); };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 pb-20 flex justify-end transition-colors duration-300">
      <div className="pt-8 px-4 sm:px-8 max-w-6xl w-full">

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">Disease Database Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Add and manage crop diseases, impacts, and remedies.</p>
        </header>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl flex items-center ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
            <AlertCircle className="mr-3" size={20} />
            <span className="font-medium">{message.text}</span>
            <button onClick={() => setMessage({ text: '', type: '' })} className="ml-auto opacity-50 hover:opacity-100"><X size={18} /></button>
          </div>
        )}

        {/* Form */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-12 transition-colors duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className={`p-2 rounded-lg ${editingId ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
              {editingId ? <Edit2 size={20} /> : <Save size={20} />}
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{editingId ? 'Update Disease Record' : 'Create New Entry'}</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Disease Name <span className="text-red-500">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Leaf Rust" className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" required />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Sample Photos</label>
                <input type="file" multiple accept="image/*" onChange={handleImages} className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 dark:file:bg-green-900/30 file:text-green-700 dark:file:text-green-300 hover:file:bg-green-100 dark:hover:file:bg-green-900/50 cursor-pointer" />
                {images.length > 0 && <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ {images.length} images staged for upload</p>}
              </div>
            </div>
            <div className="space-y-4">
              <textarea name="description" value={formData.description} onChange={handleChange} rows="3" placeholder="Detailed description..." className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" />
              <textarea name="impact" value={formData.impact} onChange={handleChange} rows="3" placeholder="Impact on crops..." className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" />
              <textarea name="remedy" value={formData.remedy} onChange={handleChange} rows="4" placeholder="Recommended remedies..." className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" />
            </div>
            <div className="flex flex-wrap gap-4 pt-4">
              <button type="submit" disabled={loading} className={`min-w-[140px] px-8 py-3 rounded-xl font-bold text-white shadow-lg shadow-green-200 dark:shadow-green-900/30 transition-all flex items-center justify-center gap-2 ${loading ? 'bg-gray-400 dark:bg-gray-600' : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}>
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Save size={18} />{editingId ? 'Update Record' : 'Save Disease'}</>}
              </button>
              {editingId && <button type="button" onClick={resetForm} className="px-8 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center gap-2"><X size={18} /> Cancel Edit</button>}
            </div>
          </form>
        </section>

        {/* Existing Records */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Existing Records ({diseases.length})</h2>
          <div className="h-px bg-gray-200 dark:bg-gray-700 flex-grow mx-6"></div>
        </div>

        {/* Records Grid */}
        {diseases.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-20 text-center">
            <div className="bg-gray-50 dark:bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon size={32} className="text-gray-300 dark:text-gray-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">Your disease database is currently empty.</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm">Fill out the form above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {diseases.map(disease => {
              const samples = disease.samples || [];
              const visibleImages = samples.slice(0, 3);
              const moreCount = samples.length - 3;
              return (
                <div key={disease._id} className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-green-200 dark:hover:border-green-700 transition-all overflow-hidden flex flex-col">
                  <div className="h-40 bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                    {samples.length > 0 ? <img src={samples[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> :
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-500"><ImageIcon size={40} /></div>}
                    <div className="absolute top-3 left-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm">{samples.length} Photos</div>
                  </div>
                  <div className="p-6 flex-grow">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{disease.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2"><span className="font-bold text-gray-800 dark:text-gray-200 uppercase text-[10px] tracking-wider block mb-0.5">Description</span>{disease.description || 'No description provided.'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-2"><span className="font-bold text-gray-800 dark:text-gray-200 uppercase text-[10px] tracking-wider block mb-0.5">Impact</span>{disease.impact || 'Not specified.'}</p>
                  </div>
                  {samples.length > 0 &&
                    <div className="grid grid-cols-3 gap-2 px-6 mb-6">
                      {visibleImages.map((img, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-100 dark:border-gray-600">
                          <img src={img} className="w-full h-full object-cover" alt="" />
                          {i === 2 && moreCount > 0 && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xs">+{moreCount}</div>}
                        </div>
                      ))}
                    </div>
                  }
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <button onClick={() => openModal(disease)} className="text-green-600 dark:text-green-400 font-bold text-sm hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1.5 transition-colors"><Eye size={16} /> Details</button>
                    <div className="flex gap-4">
                      <button onClick={() => startEdit(disease)} className="p-2 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"><Edit2 size={18} /></button>
                      <button onClick={() => deleteDisease(disease._id)} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal */}
        {modalOpen && selectedDisease && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 z-10 bg-white dark:bg-gray-800">
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100">{selectedDisease.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Comprehensive Case Study</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-800 dark:hover:text-gray-100 rounded-full transition-all"><X size={24} /></button>
              </div>
              <div className="overflow-y-auto p-8 space-y-8">
                <section><h4 className="text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-widest mb-2">Description</h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedDisease.description || 'No description.'}</p></section>
                <section><h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">Primary Impact</h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedDisease.impact || 'No impact data.'}</p></section>
                <section className="bg-green-50 dark:bg-green-900/30 rounded-2xl p-6 border border-green-100 dark:border-green-800"><h4 className="text-xs font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-2">Recommended Remedy</h4>
                  <p className="text-green-800 dark:text-green-300 leading-relaxed whitespace-pre-wrap">{selectedDisease.remedy || 'No remedies provided.'}</p></section>

                {selectedDisease.samples?.length > 0 && (
                  <div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><ImageIcon size={20} /> Photo Gallery</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {selectedDisease.samples.map((img, i) => <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"><img src={img} alt={`Detail ${i + 1}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" /></div>)}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-8 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                <button onClick={() => setModalOpen(false)} className="px-6 py-2 bg-gray-800 dark:bg-gray-600 text-white font-bold rounded-xl hover:bg-gray-900 dark:hover:bg-gray-500 transition-colors">Close Viewer</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
