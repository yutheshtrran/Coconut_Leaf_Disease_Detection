import React, { useEffect, useRef, useState } from "react";
import { User, Mail, Phone, BookOpen, Camera, Save, CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import * as userService from "../services/userService";
import Toast from "./Toast";
import Cropper from "react-easy-crop";
import { cropImageToBlob } from "../utils/cropImage";

const Profile = () => {
  const { user, setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const fileInputRef = useRef(null);
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedSrc, setSelectedSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [removePhotoPending, setRemovePhotoPending] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarRef = useRef(null);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (showAvatarMenu && avatarRef.current && !avatarRef.current.contains(e.target)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [showAvatarMenu]);

  useEffect(() => {
    (async () => {
      if (user) {
        setName(user.username || "");
        setEmail(user.email || "");
      }
      try {
        const profile = await userService.getProfile();
        const u = profile.user || profile;
        setName(u.username || "");
        setEmail(u.email || "");
        setPhone(u.phoneNumber || "");
        setBio(u.bio || "");
        setAvatarUrl(u.profileImageUrl || "");
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          setErrorMsg("Not authenticated — please sign in.");
          setTimeout(() => {
            setErrorMsg("");
            navigate("/login");
          }, 1500);
        } else {
          const msg = err?.response?.data?.message || "Failed to load profile";
          setErrorMsg(msg);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const sanitizedPhone = (phone || "").replace(/[\s\-()]/g, "");
    if (sanitizedPhone && !/^\+?[1-9]\d{1,14}$/.test(sanitizedPhone)) {
      setErrorMsg("Invalid phone. Use E.164, e.g., +94771234567.");
      setTimeout(() => setErrorMsg("") , 3500);
      return;
    }
    setShowPasswordModal(true);
  };

  const confirmSaveWithPassword = async () => {
    try {
      setIsSaving(true);
      const sanitizedPhone = (phone || "").replace(/[\s\-()]/g, "");
      const payload = { username: name, phoneNumber: sanitizedPhone, bio, currentPassword };
      const updated = await userService.updateProfile(payload);
      let updatedUser = updated?.user || { ...user, username: name, phoneNumber: sanitizedPhone, bio };
      if (removePhotoPending) {
        const resp = await userService.deleteProfilePhoto(currentPassword);
        const u = resp.user || resp;
        updatedUser = u;
        setAvatarUrl("");
        setRemovePhotoPending(false);
      } else if (pendingPhotoFile) {
        const resp = await userService.uploadProfilePhoto(pendingPhotoFile, currentPassword);
        const u = resp.user || resp;
        updatedUser = u;
        setAvatarUrl(u.profileImageUrl || "");
        setPendingPhotoFile(null);
      }
      setUser(updatedUser);
      setIsSuccessVisible(true);
      setTimeout(() => setIsSuccessVisible(false), 3000);
      setShowPasswordModal(false);
      setCurrentPassword("");
    } catch (err) {
      const msg = err?.response?.data?.message || "Update failed";
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg("") , 3500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Client-side validation: type and size
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const maxMB = Number(import.meta.env.VITE_MAX_PROFILE_IMAGE_MB ?? 5);
    if (!allowed.includes(file.type)) {
      setErrorMsg('Unsupported image type. Use JPG, PNG, or WEBP.');
      setTimeout(() => setErrorMsg(''), 3500);
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      setErrorMsg(`Image too large. Max ${maxMB}MB.`);
      setTimeout(() => setErrorMsg(''), 3500);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedSrc(reader.result);
      setShowCropper(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = (_, areaPx) => setCroppedPixels(areaPx);

  const handleCropConfirm = async () => {
    try {
      setUploading(true);
      const blob = await cropImageToBlob(selectedSrc, croppedPixels, 'image/jpeg', 0.9);
      const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
      // Defer actual upload until Save Changes with password
      setPendingPhotoFile(file);
      setAvatarUrl(URL.createObjectURL(blob));
      setShowCropper(false);
      setSelectedSrc("");
    } catch (err) {
      const msg = err?.response?.data?.message || "Photo selection failed";
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg("") , 3500);
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setSelectedSrc("");
  };

  const markRemovePhoto = () => {
    setRemovePhotoPending(true);
    setPendingPhotoFile(null);
    setAvatarUrl("");
  };

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col items-center p-4 sm:p-8 pt-16">
      <Toast type={errorMsg ? 'error' : 'info'} message={errorMsg} onClose={() => setErrorMsg("")} />

      {isSuccessVisible && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-green-600 text-white rounded-xl shadow-2xl flex items-center gap-3">
          <CheckCircle size={20} />
          <p className="font-semibold">Profile updated successfully!</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-4xl text-center">
          <p className="text-gray-500">Loading profile…</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-4xl">
          {showCropper && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-xl p-4">
                <div className="relative w-full h-[50vh] bg-gray-100 rounded-lg overflow-hidden">
                  <Cropper
                    image={selectedSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                <div className="flex items-center justify-between mt-4">
                  <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-2/3" />
                  <div className="space-x-2">
                    <button onClick={handleCropCancel} className="px-4 py-2 rounded-lg bg-gray-200">Cancel</button>
                    <button onClick={handleCropConfirm} className="px-4 py-2 rounded-lg bg-green-600 text-white">Apply</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <h1 className="text-4xl font-extrabold text-green-800 mb-8 tracking-tight">My Profile Settings</h1>

          <div className="flex flex-col md:flex-row items-center gap-8 pb-6 border-b border-gray-200 mb-6">
            <div ref={avatarRef} className="relative w-full md:w-auto flex flex-col items-center">
              <div className="rounded-full w-32 h-32 bg-green-100 flex items-center justify-center text-green-600 border-4 border-green-300 shadow-lg overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={64} />
                )}
              </div>
              <button
                className="absolute bottom-0 right-0 p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition duration-150 shadow-md border-2 border-white"
                aria-label="Edit Profile Photo"
                onClick={() => setShowAvatarMenu(v => !v)}
              >
                <Camera size={18} />
              </button>
              {showAvatarMenu && (
                <div className="absolute -bottom-16 right-0 bg-white border border-gray-200 shadow-lg rounded-lg p-2 z-10 w-40">
                  <button
                    className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded"
                    onClick={() => { setShowAvatarMenu(false); handleAvatarClick(); }}
                  >
                    Upload Image
                  </button>
                  <button
                    className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-red-600"
                    onClick={() => { setShowAvatarMenu(false); markRemovePhoto(); }}
                  >
                    Delete Image
                  </button>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-full">
                  <svg className="animate-spin h-8 w-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-bold text-gray-800 mb-1">{name}</h2>
              <p className="text-lg text-green-600 font-medium mb-1 flex items-center justify-center md:justify-start gap-2">
                <Mail size={16} />{email}
              </p>
              {phone && (
                <p className="text-md text-gray-500 flex items-center justify-center md:justify-start gap-2">
                  <Phone size={16} />{phone}
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <User size={16} className="text-green-500" /> Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <Mail size={16} className="text-green-500" /> Email Address
                </label>
                <input type="email" value={email} readOnly placeholder="your.email@example.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <Phone size={16} className="text-green-500" /> Phone Number
              </label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g., +94771234567" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <BookOpen size={16} className="text-green-500" /> Biography / Description
              </label>
              <textarea rows="4" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us a little bit about your role or yourself..." className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700">
                <Save size={20} />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-md p-6">
            <h2 className="text-xl font-semibold mb-3">Confirm Password</h2>
            <p className="text-sm text-gray-600 mb-4">Enter your current password to save profile changes.</p>
            <input type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} placeholder="Current password" className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4" disabled={isSaving} />
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg bg-gray-200" onClick={()=>{setShowPasswordModal(false); setCurrentPassword("");}} disabled={isSaving}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-green-600 text-white flex items-center gap-2" onClick={confirmSaveWithPassword} disabled={isSaving}>
                {isSaving && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                )}
                {isSaving ? 'Saving…' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;