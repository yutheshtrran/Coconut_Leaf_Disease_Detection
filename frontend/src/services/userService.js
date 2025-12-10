import API from './api';

export async function getProfile() {
  const res = await API.get('/users/profile', {
    params: { _ts: Date.now() },
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  return res.data;
}

export async function updateProfile(payload) {
  const { data } = await API.put('/users/profile', payload);
  return data;
}

export async function uploadProfilePhoto(file, currentPassword) {
  const form = new FormData();
  form.append('profilePhoto', file);
  if (currentPassword) form.append('currentPassword', currentPassword);
  const { data } = await API.post('/users/profile/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteProfilePhoto(currentPassword) {
  const { data } = await API.delete('/users/profile/photo', { data: { currentPassword } });
  return data;
}

export async function updateSecurity(payload) {
  const { data } = await API.put('/users/security', payload);
  return data;
}
