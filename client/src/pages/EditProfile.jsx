import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Save, UserRound } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { showToast } from '../components/Toast.jsx';
import { useUserProfile } from '../hooks/useUserProfile.js';

export default function EditProfile() {
  const navigate = useNavigate();
  const { me, setMe } = useOutletContext() || {};
  const [user, setUser] = useState(me);
  const [loading, setLoading] = useState(!me);
  const photoInputRef = useRef(null);

  const {
    form,
    photoUploading,
    setField,
    uploadProfilePhoto,
    saveProfile
  } = useUserProfile(me, setMe, {
    onSuccess: () => navigate('/app/profile')
  });

  useEffect(() => {
    if (me) {
      setUser(me);
      setLoading(false);
    }
  }, [me]);

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto bg-bg animate-pulse p-6 mt-12 space-y-6">
        <div className="h-10 w-24 bg-surface rounded skeleton" />
        <div className="h-24 rounded-2xl bg-surface skeleton" />
        <div className="h-48 rounded-2xl bg-surface skeleton" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg md:max-w-xl py-6 px-4 bg-bg text-text-primary pb-24">
      {/* Header */}
      <header className="flex items-center gap-3.5 mb-6">
        <button 
          onClick={() => navigate('/app/profile')} 
          className="btn-icon h-10 w-10 flex items-center justify-center rounded-full hover:bg-surface-hover transition active:scale-95" 
          aria-label="Back to profile"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Profile details</h2>
          <p className="text-xs text-text-muted">Update your public display information</p>
        </div>
      </header>

      <form onSubmit={saveProfile} className="space-y-5">
        <div className="surface-card flex items-center gap-4 rounded-[22px] border border-border-default bg-surface p-4 shadow-card">
          {form.avatar ? (
            <img src={form.avatar} alt="" className="h-16 w-16 rounded-full bg-bg object-cover shadow-card" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-accent/10 text-accent">
              <UserRound size={24} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-text-primary">Profile photo</p>
            <p className="text-[10px] text-text-muted mt-0.5">Select a new avatar image</p>
            <button 
              type="button" 
              onClick={() => photoInputRef.current?.click()} 
              disabled={photoUploading} 
              className="btn-secondary mt-2.5 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <Camera size={14} />
              {photoUploading ? 'Uploading...' : 'Choose Photo'}
            </button>
            <input 
              ref={photoInputRef} 
              type="file" 
              accept="image/*" 
              className="hidden" 
              disabled={photoUploading} 
              onChange={(event) => uploadProfilePhoto(event.target.files?.[0])} 
            />
          </div>
        </div>

        <div className="surface-card rounded-[22px] border border-border-default bg-surface p-5 shadow-card space-y-4">
          <label className="block">
            <span className="text-xs font-bold text-text-muted">Display name</span>
            <input 
              value={form.name} 
              onChange={(e) => setField('name', e.target.value)} 
              placeholder="e.g. Daniel Ahmadi" 
              className="mt-2 w-full rounded-xl border border-border-default bg-bg px-4 py-3 text-xs text-text-primary outline-none focus:border-accent transition-colors font-semibold"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-text-muted">Username</span>
            <div className="mt-2 flex items-center rounded-xl border border-border-default bg-bg px-4 py-3 text-xs font-semibold text-text-primary focus-within:border-accent transition-colors">
              <span className="text-text-faint mr-0.5">@</span>
              <input 
                value={form.username} 
                onChange={(e) => setField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                placeholder="username" 
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-text-muted">Age</span>
              <input 
                type="number"
                value={form.age} 
                onChange={(e) => setField('age', e.target.value)} 
                placeholder="Age" 
                className="mt-2 w-full rounded-xl border border-border-default bg-bg px-4 py-3 text-xs text-text-primary outline-none focus:border-accent transition-colors font-semibold"
              />
            </label>

            <div>
              <span className="text-xs font-bold text-text-muted">Gender</span>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-border-default bg-bg p-1 text-xs">
                {['female', 'male'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setField('gender', value)}
                    className={`rounded-lg py-2 font-bold capitalize transition-all duration-200 active:scale-[0.96] ${form.gender === value ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-text-muted">Bio</span>
            <textarea 
              value={form.bio} 
              onChange={(e) => setField('bio', e.target.value)} 
              className="mt-2 min-h-20 w-full resize-none rounded-xl border border-border-default bg-bg px-4 py-3 text-xs outline-none text-text-primary placeholder:text-text-faint focus:border-accent transition-colors font-semibold" 
              placeholder="Tell people about you" 
              maxLength={160} 
            />
          </label>
        </div>

        <button 
          type="submit" 
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold shadow-accent-sm hover:opacity-95 transition-all duration-200"
        >
          <Save size={16} />
          Save Changes
        </button>
      </form>
    </div>
  );
}
