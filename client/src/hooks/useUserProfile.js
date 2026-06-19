import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { showToast } from '../components/Toast.jsx';

export function useUserProfile(me, setMe, options = {}) {
  const [photoUploading, setPhotoUploading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    username: '',
    age: '',
    gender: 'female',
    bio: '',
    avatar: '',
    showLastSeen: true,
    readReceipts: true,
    blockedWords: ''
  });

  useEffect(() => {
    if (me) {
      setForm({
        name: me.name || '',
        username: me.isGuest ? '' : (me.username || ''),
        age: me.age || '',
        gender: me.gender || 'female',
        bio: me.bio || '',
        avatar: me.avatar || '',
        showLastSeen: me.privacy?.showLastSeen !== false,
        readReceipts: me.privacy?.readReceipts !== false,
        blockedWords: me.safety?.blockedWords?.join(', ') || ''
      });
    }
  }, [me]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const uploadProfilePhoto = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast('Choose an image from your gallery', 'error');
      return;
    }
    setPhotoUploading(true);
    showToast('Uploading profile photo...', 'info');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { media } = await api('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      const { user: updated } = await api('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ avatar: media.url })
      });
      setField('avatar', media.url);
      setMe?.(updated);
      showToast('Profile photo updated', 'success');
      return updated;
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    } finally {
      setPhotoUploading(false);
    }
  };

  const saveProfile = async (event, includePrivacyAndSafety = false) => {
    if (event) event.preventDefault();
    if (form.username.trim() !== '' && form.username.trim().length < 3) {
      showToast('Username must be at least 3 characters long', 'error');
      return;
    }
    try {
      const payload = {
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        bio: form.bio,
        avatar: form.avatar
      };
      if (includePrivacyAndSafety) {
        payload.privacy = {
          showLastSeen: form.showLastSeen,
          readReceipts: form.readReceipts
        };
        payload.safety = {
          blockedWords: form.blockedWords.split(',').map((word) => word.trim().toLowerCase()).filter(Boolean)
        };
      }
      if (form.username.trim() !== '') {
        payload.username = form.username;
      }
      const { user: updated } = await api('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setMe?.(updated);
      showToast('Profile saved successfully', 'success');
      options.onSuccess?.(updated);
      return updated;
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  return {
    form,
    photoUploading,
    setField,
    uploadProfilePhoto,
    saveProfile
  };
}
