// src/hooks/useProfile.js
import { useState, useEffect, useRef } from 'react';
import { signOut, updateProfile as fbUpdateProfile, updatePassword } from 'firebase/auth';
import { auth, db, storage } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getSocket, BACKEND_URL } from '../services/socket';

export default function useProfile({ user, activeConv, setActiveConv, setConversations, showErrToast, setConfirmDialog }) {
  const socket = getSocket();

  async function authFetch(url, options = {}) {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}` } });
  }

  // ── Profiel state ─────────────────────────────────────────────────────────
  const [profileTab,     setProfileTab]     = useState('account');
  const [newName,        setNewName]        = useState(user.displayName || '');
  const [photoFile,      setPhotoFile]      = useState(null);
  const [photoPreview,   setPhotoPreview]   = useState(localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL || null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg,     setProfileMsg]     = useState('');

  const [newUsername,      setNewUsername]      = useState('');
  const [usernameLoading,  setUsernameLoading]  = useState(false);
  const [usernameMsg,      setUsernameMsg]      = useState('');

  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showNewPassword,  setShowNewPassword]  = useState(false);
  const [passwordLoading,  setPasswordLoading]  = useState(false);
  const [passwordMsg,      setPasswordMsg]      = useState('');

  const [chatBg,        setChatBg]        = useState(null);
  const [chatBgLoading, setChatBgLoading] = useState(false);
  const [chatBgTab,     setChatBgTab]     = useState('foto');
  const [chatBgMsg,     setChatBgMsg]     = useState('');

  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [avatarOptions,     setAvatarOptions]     = useState(null);

  const [groupPhotoLoading, setGroupPhotoLoading] = useState(false);

  const photoInputRef = useRef(null);
  const bgInputRef    = useRef(null);
  const blobUrlRef    = useRef(null);

  // Ruim blob URL op bij unmount
  useEffect(() => {
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, []);

  // ── Herstel profielfoto + laad chat achtergrond bij mount ────────────────
  useEffect(() => {
    if (!localStorage.getItem(`pulse_photo_${user.uid}`)) {
      getDoc(doc(db, 'users', user.uid)).then(d => {
        if (d.exists() && d.data().photoURL) {
          localStorage.setItem(`pulse_photo_${user.uid}`, d.data().photoURL);
          setPhotoPreview(d.data().photoURL);
        }
      }).catch(e => { console.warn('[Pulse] Fout:', e.message); });
    }
  }, [user.uid]);

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(d => {
      if (!d.exists()) return;
      const { chatBackgroundURL, chatBackgroundColor, username } = d.data();
      if (chatBackgroundURL)        setChatBg({ type: 'photo', url: chatBackgroundURL });
      else if (chatBackgroundColor) setChatBg({ type: 'color', value: chatBackgroundColor });
      if (username) setNewUsername(username);
    }).catch(e => { console.warn('[Pulse] Fout:', e.message); });
  }, [user.uid]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function dataURLtoBlob(dataURL) {
    const [header, data] = dataURL.split(',');
    const mime  = (header.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const bstr  = atob(data);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new Blob([u8arr], { type: mime });
  }

  function resizeBgImage(file, maxWidth = 1920) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale  = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function resizeImageToBase64(file, size = 200) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx  = (img.width  - min) / 2;
        const sy  = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = URL.createObjectURL(file);
    setPhotoPreview(blobUrlRef.current);
    e.target.value = '';
  }

  // ── Profiel opslaan ───────────────────────────────────────────────────────
  async function saveProfile(e) {
    e?.preventDefault();
    if (!newName.trim()) return;
    setProfileLoading(true); setProfileMsg('');
    const hadPhoto = !!photoFile;
    try {
      let photoURL = localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL || null;
      if (photoFile) {
        try { await deleteObject(storageRef(storage, `users/${user.uid}/profilePhoto`)); } catch (e) { console.warn('[Pulse] Fout:', e.message); }
        const ref    = storageRef(storage, `users/${user.uid}/profilePhoto`);
        const resized = await resizeImageToBase64(photoFile, 200);
        const blob   = dataURLtoBlob(resized);
        await uploadBytes(ref, blob, { contentType: 'image/jpeg' });
        photoURL = await getDownloadURL(ref);
        localStorage.setItem(`pulse_photo_${user.uid}`, photoURL);
      }
      await fbUpdateProfile(auth.currentUser, { displayName: newName.trim(), photoURL: photoURL || null });
      if (photoFile) {
        await updateDoc(doc(db, 'users', user.uid), { photoURL: photoURL || null, avatarOptions: null });
      }
      authFetch(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, displayName: newName.trim(), email: user.email, photoURL: photoURL || '' }),
      }).catch(e => { console.warn('[Pulse] Fout:', e.message); });
      socket?.emit('user:updated', { uid: user.uid, displayName: newName.trim(), photoURL: photoURL || '' });
      setPhotoFile(null);
      setPhotoPreview(photoURL);
      setProfileMsg(hadPhoto ? 'Profielfoto opgeslagen!' : 'Opgeslagen!');
    } catch (err) { setProfileMsg('Fout bij opslaan: ' + (err.message || err.code)); }
    finally { setProfileLoading(false); }
  }

  // ── Gebruikersnaam opslaan ────────────────────────────────────────────────
  async function saveUsername() {
    const clean = newUsername.trim().toLowerCase();
    if (!clean) { setUsernameMsg('Fout: Gebruikersnaam mag niet leeg zijn.'); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) { setUsernameMsg('Fout: 3–20 tekens, alleen letters, cijfers en _.'); return; }
    setUsernameLoading(true); setUsernameMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/lookup-username?username=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.email !== user.email) { setUsernameMsg('Fout: Gebruikersnaam is al in gebruik.'); return; }
      }
      await updateDoc(doc(db, 'users', user.uid), { username: clean });
      setUsernameMsg('Gebruikersnaam opgeslagen!');
    } catch (err) { setUsernameMsg('Fout: ' + err.message); }
    finally { setUsernameLoading(false); }
  }

  // ── Wachtwoord wijzigen ───────────────────────────────────────────────────
  async function changePassword() {
    if (newPassword.length < 6)          { setPasswordMsg('Fout: Minimaal 6 tekens.'); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg('Fout: Wachtwoorden komen niet overeen.'); return; }
    setPasswordLoading(true); setPasswordMsg('');
    try {
      await updatePassword(auth.currentUser, newPassword);
      setNewPassword(''); setConfirmPassword('');
      setPasswordMsg('Wachtwoord gewijzigd!');
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') setPasswordMsg('Fout: Log opnieuw in om je wachtwoord te wijzigen.');
      else setPasswordMsg('Fout: ' + err.message);
    } finally { setPasswordLoading(false); }
  }

  // ── Chat achtergrond ──────────────────────────────────────────────────────
  async function uploadChatBgPhoto(file) {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) { setChatBgMsg('Fout: alleen JPG, PNG of WEBP toegestaan.'); return; }
    if (file.size > 5 * 1024 * 1024)  { setChatBgMsg('Fout: bestand te groot (max 5 MB).'); return; }
    setChatBgLoading(true); setChatBgMsg('');
    try {
      await deleteObject(storageRef(storage, `users/${user.uid}/chatBackground`)).catch(e => { console.warn('[Pulse] Fout:', e.message); });
      const ref = storageRef(storage, `users/${user.uid}/chatBackground`);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      await updateDoc(doc(db, 'users', user.uid), { chatBackgroundURL: url, chatBackgroundColor: null });
      setChatBg({ type: 'photo', url });
      setChatBgMsg('Achtergrond opgeslagen!');
    } catch (err) { setChatBgMsg('Fout bij uploaden: ' + err.message); }
    finally { setChatBgLoading(false); }
  }

  async function saveChatBgColor(color) {
    setChatBgLoading(true); setChatBgMsg('');
    try {
      await deleteObject(storageRef(storage, `users/${user.uid}/chatBackground`)).catch(e => { console.warn('[Pulse] Fout:', e.message); });
      await updateDoc(doc(db, 'users', user.uid), { chatBackgroundURL: null, chatBackgroundColor: color });
      setChatBg({ type: 'color', value: color });
    } catch (err) { setChatBgMsg('Fout bij opslaan: ' + err.message); }
    finally { setChatBgLoading(false); }
  }

  async function removeChatBg() {
    setChatBgLoading(true); setChatBgMsg('');
    try {
      await deleteObject(storageRef(storage, `users/${user.uid}/chatBackground`)).catch(e => { console.warn('[Pulse] Fout:', e.message); });
      await updateDoc(doc(db, 'users', user.uid), { chatBackgroundURL: null, chatBackgroundColor: null });
      setChatBg(null);
    } catch (err) { setChatBgMsg('Fout bij verwijderen: ' + err.message); }
    finally { setChatBgLoading(false); }
  }

  // ── Groepsfoto uploaden ───────────────────────────────────────────────────
  async function uploadGroupPhoto(file) {
    if (!file || !activeConv?.id) return;
    setGroupPhotoLoading(true);
    try {
      const ref = storageRef(storage, `groups/${activeConv.id}/photo`);
      await uploadBytes(ref, file, { contentType: file.type });
      const url = await getDownloadURL(ref);
      await updateDoc(doc(db, 'conversations', activeConv.id), { photoURL: url });
      setActiveConv(prev => ({ ...prev, photoURL: url }));
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, photoURL: url } : c));
    } catch { showErrToast('Foto uploaden mislukt'); }
    finally { setGroupPhotoLoading(false); }
  }

  // ── Account verwijderen ───────────────────────────────────────────────────
  function handleDeleteAccount() {
    setConfirmDialog({
      message: 'Weet je zeker dat je je account wilt verwijderen? Al je chats en gegevens worden permanent verwijderd.',
      onConfirm: async () => {
        try {
          await authFetch(`${BACKEND_URL}/api/account/${user.uid}`, { method: 'DELETE' });
          localStorage.removeItem(`pulse_photo_${user.uid}`);
          localStorage.removeItem(`pulse_calls_${user.uid}`);
          await signOut(auth);
        } catch (err) { showErrToast('Verwijderen mislukt: ' + err.message); }
      },
    });
  }

  function openProfile() {
    setProfileMsg('');
    setNewName(user.displayName || '');
    setPhotoPreview(localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL || null);
    setPhotoFile(null);
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (!snap.exists()) return;
      const { photoURL, avatarOptions } = snap.data();
      if (avatarOptions) setAvatarOptions(avatarOptions);
      if (photoURL) {
        setPhotoPreview(photoURL);
        localStorage.setItem(`pulse_photo_${user.uid}`, photoURL);
      } else {
        setPhotoPreview(null);
        localStorage.removeItem(`pulse_photo_${user.uid}`);
      }
    }).catch(e => { console.warn('[Pulse] Fout:', e.message); });
  }

  return {
    // state
    profileTab, setProfileTab,
    newName, setNewName,
    photoPreview, setPhotoPreview,
    profileLoading, profileMsg, setProfileMsg,
    newUsername, setNewUsername,
    usernameLoading, usernameMsg,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    showNewPassword, setShowNewPassword,
    passwordLoading, passwordMsg,
    chatBg, chatBgLoading, chatBgTab, setChatBgTab, chatBgMsg,
    showAvatarBuilder, setShowAvatarBuilder,
    avatarOptions, setAvatarOptions,
    groupPhotoLoading,
    // refs
    photoInputRef, bgInputRef,
    // functions
    openProfile,
    handlePhotoChange, saveProfile, saveUsername, changePassword,
    uploadChatBgPhoto, saveChatBgColor, removeChatBg,
    uploadGroupPhoto, handleDeleteAccount,
  };
}
