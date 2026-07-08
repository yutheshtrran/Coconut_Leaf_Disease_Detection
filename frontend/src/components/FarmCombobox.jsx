import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Plus, Search, MapPin } from 'lucide-react';
import { fetchFarms } from '../services/farmService';

// value: { name, isNew, farmId }
// onChange(value)
// onFarmSelected(farmDoc) — called when an existing farm is picked (passes full farm doc)
const FarmCombobox = ({ value, onChange, onFarmSelected }) => {
  const [query,    setQuery]    = useState(value?.name || '');
  const [farms,    setFarms]    = useState([]);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef  = useRef(null);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await fetchFarms(q);
      setFarms(res.farms || res.data || []);
    } catch {
      setFarms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const exactMatch = farms.some(f => f.name.toLowerCase() === query.trim().toLowerCase());
  const showNew    = query.trim().length > 0 && !exactMatch;
  const allOptions = [...farms, ...(showNew ? ['__new__'] : [])];

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    setFocusIdx(-1);
    onChange({ name: q, isNew: true, farmId: null });
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 280);
  };

  const selectFarm = (farm) => {
    setQuery(farm.name);
    setOpen(false);
    setFocusIdx(-1);
    onChange({ name: farm.name, isNew: false, farmId: farm._id });
    if (onFarmSelected) onFarmSelected(farm);
  };

  const selectNew = () => {
    setOpen(false);
    setFocusIdx(-1);
    onChange({ name: query.trim(), isNew: true, farmId: null });
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown') { setOpen(true); search(query); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(i => Math.min(i + 1, allOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusIdx >= 0) {
        const opt = allOptions[focusIdx];
        opt === '__new__' ? selectNew() : selectFarm(opt);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => { setOpen(true); if (!farms.length) search(query); }}
          onKeyDown={handleKeyDown}
          placeholder="Search or type a new farm name…"
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
        />
        <ChevronDown
          size={14}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {loading && (
            <li className="px-4 py-2.5 text-sm text-gray-400">Searching farms…</li>
          )}

          {!loading && farms.map((farm, i) => (
            <li
              key={farm._id}
              onMouseDown={() => selectFarm(farm)}
              className={`px-4 py-2.5 cursor-pointer transition flex items-start gap-2 ${
                focusIdx === i
                  ? 'bg-green-50 dark:bg-green-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{farm.name}</p>
                {farm.location?.address && (
                  <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                    <MapPin size={10} />
                    {farm.location.address}
                  </p>
                )}
              </div>
            </li>
          ))}

          {!loading && showNew && (
            <li
              onMouseDown={selectNew}
              className={`px-4 py-2.5 cursor-pointer transition flex items-center gap-2 ${
                farms.length > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''
              } ${
                focusIdx === farms.length
                  ? 'bg-green-50 dark:bg-green-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Plus size={14} className="text-green-600 dark:text-green-400 shrink-0" />
              <span className="text-sm text-green-700 dark:text-green-400">
                Create new farm: <strong>"{query.trim()}"</strong>
              </span>
            </li>
          )}

          {!loading && !farms.length && !showNew && (
            <li className="px-4 py-2.5 text-sm text-gray-400 italic">No farms found</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default FarmCombobox;
