import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Shield, Gavel, Mail, Slash, HelpCircle, ArrowLeft, Send, Info } from 'lucide-react';
import { api } from '../lib/api.js';
import { showToast } from '../components/Toast.jsx';

export default function ReportUser() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const location = useLocation();
  
  // Try to retrieve user details from Router state
  const reportedUser = location.state?.user || {
    _id: userId,
    name: 'Blippr User',
    username: 'user',
    avatar: ''
  };

  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = [
    { id: 'harassment', label: 'Harassment', icon: Shield },
    { id: 'hate', label: 'Hate Speech', icon: Gavel },
    { id: 'spam', label: 'Spam', icon: Mail },
    { id: 'content', label: 'Inappropriate Content', icon: Slash },
    { id: 'other', label: 'Other', icon: HelpCircle }
  ];

  const handleSubmit = async () => {
    if (!selectedReason) {
      showToast('Please select a reason for reporting', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/safety/report', {
        method: 'POST',
        body: JSON.stringify({
          userId: reportedUser._id,
          reason: selectedReason,
          notes: details
        })
      });
      
      // Navigate to success confirmation screen
      navigate('/app/report-received');
    } catch (err) {
      showToast(err.message || 'Failed to submit report', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl min-h-[calc(100vh-6rem)] flex flex-col justify-between px-4 pb-20 relative overflow-hidden text-on-surface">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-[#0b1326]/70 backdrop-blur-xl border-b border-outline-variant/20 shadow-xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-white/5 text-primary transition-all active:scale-95 duration-200 flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-headline-md text-headline-md font-bold text-primary">Report User</h1>
        </div>
      </header>

      <main className="pt-24 pb-12 space-y-8 flex-1">
        {/* Profile Summary Card */}
        <section className="glass-panel p-6 rounded-xl flex items-center gap-4 border border-outline-variant/20 shadow-lg">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-primary-container/30 shrink-0">
            {reportedUser.avatar ? (
              <img className="w-full h-full object-cover" src={reportedUser.avatar} alt={reportedUser.name} />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-[#131b2e] to-[#171f33] flex items-center justify-center font-bold text-[#d2bbff] text-2xl">
                {reportedUser.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-headline-md text-headline-md text-on-surface truncate">{reportedUser.name}</h2>
            <p className="font-label-md text-label-md text-on-surface-variant truncate">@{reportedUser.username}</p>
            {reportedUser.isOnline && (
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.5)]"></span>
                <span className="font-label-sm text-label-sm text-secondary">Active Now</span>
              </div>
            )}
          </div>
        </section>

        {/* Report Reasons */}
        <section className="space-y-4">
          <h3 className="font-label-md text-label-md text-on-surface-variant px-1">Why are you reporting this user?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reasons.map((reason) => {
              const IconComp = reason.icon;
              const isSelected = selectedReason === reason.label;
              return (
                <div 
                  key={reason.id}
                  onClick={() => setSelectedReason(reason.label)}
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border ${
                    isSelected 
                      ? 'bg-primary-container/20 border-primary text-[#d2bbff] shadow-[0_0_15px_rgba(124,58,237,0.15)]' 
                      : 'glass-panel border-outline-variant/10 text-on-surface hover:bg-white/5'
                  }`}
                >
                  <IconComp size={20} className="text-primary" />
                  <span className="font-body-md text-body-md font-medium">{reason.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Additional Details */}
        <section className="space-y-4">
          <h3 className="font-label-md text-label-md text-on-surface-variant px-1">Additional Details</h3>
          <div className="glass-panel p-4 rounded-xl border border-outline-variant/20 shadow-md">
            <textarea 
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full min-h-[160px] p-4 rounded-lg bg-black/20 border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface font-body-md placeholder-on-surface-variant/50 resize-none outline-none transition-all" 
              placeholder="Tell us more about the issue..."
            />
            <p className="mt-3 font-label-sm text-label-sm text-on-surface-variant/60 flex items-center gap-2">
              <Info size={14} className="text-primary shrink-0" />
              Your report is anonymous and helps keep the community safe.
            </p>
          </div>
        </section>

        {/* Submit Button */}
        <div className="pt-4">
          <button 
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-primary-container text-white font-headline-md text-headline-md py-4 rounded-xl shadow-[0_8px_32px_rgba(124,58,237,0.3)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{submitting ? 'Submitting Report...' : 'Submit Report'}</span>
            <Send size={18} />
          </button>
        </div>
      </main>
    </div>
  );
}
