const ML = 'http://127.0.0.1:5001';

export const startFarmMap = async (videoFile, conf = 0.35) => {
  const fd = new FormData();
  fd.append('file', videoFile);
  fd.append('conf', String(conf));
  const r = await fetch(`${ML}/farm-map/start`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`Upload failed (${r.status})`);
  return r.json();
};

export const getFarmMapProgress = async (sessionId) => {
  const r = await fetch(`${ML}/farm-map/progress/${sessionId}`);
  if (!r.ok) throw new Error(`Progress check failed (${r.status})`);
  return r.json();
};

export const getFarmMapResult = async (sessionId) => {
  const r = await fetch(`${ML}/farm-map/result/${sessionId}`);
  if (r.status === 202) return r.json();
  if (!r.ok) throw new Error(`Fetching result failed (${r.status})`);
  return r.json();
};

export const analyseTreeDisease = async (sessionId, treeId) => {
  const r = await fetch(`${ML}/farm-map/disease/${sessionId}/${treeId}`, { method: 'POST' });
  if (!r.ok) throw new Error(`Disease analysis failed (${r.status})`);
  return r.json();
};
