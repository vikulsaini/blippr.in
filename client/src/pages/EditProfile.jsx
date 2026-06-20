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
        <div className="h-10 w-24 bg-surface rounded-3xl skeleton" />
        <div className="h-24 rounded-3xl bg-surface skeleton" />
        <div className="h-48 rounded-3xl bg-surface skeleton" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg py-6 px-4 bg-bg text-text-primary pb-24 scrollbar-none">
      
      {/* Header */}
      <header className="flex items-center gap-3.5 mb-8">
        <button 
          onClick={() => navigate('/app/profile')} 
          className="text-primary hover:opacity-80 p-2 -ml-2 rounded-full transition active:scale-95" 
          aria-label="Back to profile"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h2 className="text-xl font-black text-text-primary tracking-tight">Edit Profile</h2>
          <p className="text-xs text-text-muted">Update your public display information</p>
        </div>
      </header>

      <form onSubmit={saveProfile} className="space-y-6">
        
        {/* Avatar Section */}
        <section className="flex flex-col items-center justify-center gap-2 py-4">
          <div 
            onClick={() => photoInputRef.current?.click()}
            className="relative group cursor-pointer"
          >
            {/* Gradient edit avatar ring */}
             <div className="w-32 h-32 rounded-full border-2 border-border p-1 bg-gradient-to-tr from-primary via-success to-amber-500 shadow-lg group-hover:scale-105 transition-all">
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-white bg-zinc-100 flex items-center justify-center">
                {form.avatar ? (
                  <img src={form.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound size={48} className="text-text-muted/40" />
                )}
              </div>
            </div>
            {/* Photo Edit Button Badge */}
            <div className="absolute bottom-0 right-0 bg-accent text-white p-2.5 rounded-full shadow-[0_4px_12px_rgba(124,58,237,0.3)] border-2 border-white flex items-center justify-center hover:scale-110 transition-transform">
              <Camera size={16} />
            </div>
          </div>
          <p className="font-bold text-[10px] text-text-muted uppercase tracking-widest mt-2">
            {photoUploading ? 'Uploading...' : 'Change Photo'}
          </p>
          <input 
            ref={photoInputRef} 
            type="file" 
            accept="image/*" 
            className="hidden" 
            disabled={photoUploading} 
            onChange={(event) => uploadProfilePhoto(event.target.files?.[0])} 
          />
        </section>

        {/* Input Fields */}
        <section className="space-y-5">
          
          {/* Display Name */}
          <div className="flex flex-col gap-2">
            <label className="font-bold text-xs text-secondary ml-1 uppercase tracking-wider">Display Name</label>
            <div className="glass-card rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/45 transition-all">
              <input 
                type="text"
                value={form.name} 
                onChange={(e) => setField('name', e.target.value)} 
                placeholder="Your name" 
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder:text-text-muted text-text-primary outline-none"
              />
            </div>
          </div>

          {/* Username */}
          <div className="flex flex-col gap-2">
            <label className="font-bold text-xs text-secondary ml-1 uppercase tracking-wider">Username</label>
            <div className="glass-card rounded-2xl p-0.5 flex items-center focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/45 transition-all">
              <span className="pl-4 text-text-muted font-bold text-sm select-none">@</span>
              <input 
                type="text"
                value={form.username} 
                onChange={(e) => setField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                placeholder="username" 
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold px-1 py-3 placeholder:text-text-muted text-text-primary outline-none"
              />
            </div>
          </div>

          {/* Age & Gender Grid */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Age */}
            <div className="flex flex-col gap-2">
              <label className="font-bold text-xs text-secondary ml-1 uppercase tracking-wider">Age</label>
              <div className="glass-card rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/45 transition-all">
                <input 
                  type="number"
                  value={form.age} 
                  onChange={(e) => setField('age', e.target.value)} 
                  placeholder="Age" 
                  className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder:text-text-muted text-text-primary outline-none"
                />
              </div>
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-2">
              <span className="font-bold text-xs text-secondary ml-1 uppercase tracking-wider">Gender</span>
              <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-white/60 p-1 text-xs">
                {['female', 'male'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setField('gender', value)}
                    className={`rounded-xl py-3 font-bold capitalize transition-all duration-200 active:scale-[0.96] ${form.gender === value ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Bio */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center ml-1">
              <label className="font-bold text-xs text-secondary uppercase tracking-wider">Bio</label>
              <span className="text-[10px] text-text-muted font-bold tracking-tight">{form.bio?.length || 0} / 160</span>
            </div>
             <div className="glass-card rounded-2xl p-0.5 focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/45 transition-all">
              <textarea 
                value={form.bio} 
                onChange={(e) => setField('bio', e.target.value)} 
                className="w-full min-h-24 bg-transparent border-none focus:ring-0 text-sm font-semibold px-4 py-3 placeholder:text-text-muted text-text-primary outline-none resize-none scrollbar-none" 
                placeholder="Tell the world about yourself..." 
                maxLength={160} 
              />
            </div>
          </div>

        </section>

        {/* Action Button */}
         <button 
          type="submit" 
          className="w-full bg-accent hover:bg-accent-hover text-white font-bold text-sm py-4 rounded-full shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 mt-6"
        >
          <Save size={16} />
          Save Changes
        </button>

      </form>
    </div>
  );
}
