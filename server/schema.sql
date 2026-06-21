-- Blippr Production Database Schema & Row Level Security DDL
-- Designed exactly matching all project models (User, Chat, Message, Call, FriendRequest, Notification, Subscription, Report, AuditLog, Analytics)
-- Database: PostgreSQL (Supabase)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. DROP CONSTRAINTS & TABLES IF THEY EXIST (FOR CLEAN RECREATION)
-- =========================================================================
ALTER TABLE IF EXISTS public.chats DROP CONSTRAINT IF EXISTS fk_chats_last_message;
ALTER TABLE IF EXISTS public.chats DROP CONSTRAINT IF EXISTS fk_chats_last_call;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_chats_updated_at ON public.chats;
DROP TRIGGER IF EXISTS trg_messages_updated_at ON public.messages;
DROP TRIGGER IF EXISTS trg_calls_updated_at ON public.calls;
DROP TRIGGER IF EXISTS trg_friend_requests_updated_at ON public.friend_requests;
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
DROP TRIGGER IF EXISTS trg_notification_subscriptions_updated_at ON public.notification_subscriptions;
DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Use CASCADE to automatically drop dependent constraints cleanly
DROP TABLE IF EXISTS public.analytics_buckets CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.notification_subscriptions CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.friend_requests CASCADE;
DROP TABLE IF EXISTS public.calls CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- =========================================================================
-- 2. CREATE TABLES
-- =========================================================================

-- A. public.profiles (Matches User.js / userMapper.js)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    age INTEGER,
    dob TIMESTAMP WITH TIME ZONE,
    gender TEXT,
    avatar TEXT,
    bio TEXT,
    contact TEXT DEFAULT '',
    location_lat NUMERIC,
    location_lng NUMERIC,
    location_updated_at TIMESTAMP WITH TIME ZONE,
    interests TEXT[] DEFAULT '{}',
    show_last_seen BOOLEAN DEFAULT true,
    read_receipts BOOLEAN DEFAULT true,
    vault_password TEXT,
    blocked_words TEXT[] DEFAULT '{}',
    blocked_users UUID[] DEFAULT '{}',
    push_tokens TEXT[] DEFAULT '{}',
    is_online BOOLEAN DEFAULT false,
    is_guest BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    safety_violation_count INTEGER DEFAULT 0,
    banned_until TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_ip TEXT,
    ip_history JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- B. public.chats (Matches Chat.js)
CREATE TABLE public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT CHECK (type IN ('direct', 'stranger')),
    members UUID[] NOT NULL,
    temporary BOOLEAN DEFAULT false,
    interests TEXT[] DEFAULT '{}',
    last_message_id UUID, -- circular constraint added later
    last_call_id UUID,    -- circular constraint added later
    unread_counts JSONB DEFAULT '{}'::jsonb,
    nicknames JSONB DEFAULT '{}'::jsonb,
    hidden_for TEXT[] DEFAULT '{}',
    archived_for TEXT[] DEFAULT '{}',
    pinned_for UUID[] DEFAULT '{}',
    starred_for UUID[] DEFAULT '{}',
    muted_for UUID[] DEFAULT '{}',
    disappearing_messages JSONB DEFAULT '{}'::jsonb,
    wallpapers JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- C. public.messages (Matches Message.js)
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    text TEXT,
    media JSONB DEFAULT '{}'::jsonb,     -- schema: { url: TEXT, type: TEXT, mimeType: TEXT, size: INT }
    location JSONB DEFAULT '{}'::jsonb,  -- schema: { lat: NUMERIC, lng: NUMERIC, accuracy: NUMERIC }
    reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    mentions TEXT[] DEFAULT '{}',
    reactions JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'seen')),
    seen_by UUID[] DEFAULT '{}',
    deleted_for UUID[] DEFAULT '{}',
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- D. public.calls (Matches Call.js)
CREATE TABLE public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('audio', 'video')),
    status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'accepted', 'rejected', 'ended', 'missed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- E. public.friend_requests (Matches FriendRequest.js)
CREATE TABLE public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    to_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- F. public.notifications (Matches Notification.js)
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'system',
    title TEXT,
    body TEXT DEFAULT '',
    url TEXT,
    request_id UUID REFERENCES public.friend_requests(id) ON DELETE SET NULL,
    chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- G. public.notification_subscriptions (Matches NotificationSubscription.js)
CREATE TABLE public.notification_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    keys JSONB NOT NULL,
    user_agent TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- H. public.reports (Matches Report.js)
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    notes TEXT DEFAULT '',
    category TEXT DEFAULT 'other',
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
    screenshots TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- I. public.audit_logs (Matches AuditLog.js)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- J. public.analytics_buckets (Matches AnalyticsBucket.js)
CREATE TABLE public.analytics_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    interval TEXT DEFAULT 'hour',
    request_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    response_time_sum DOUBLE PRECISION DEFAULT 0.0,
    status_2xx INTEGER DEFAULT 0,
    status_3xx INTEGER DEFAULT 0,
    status_4xx INTEGER DEFAULT 0,
    status_5xx INTEGER DEFAULT 0,
    endpoints JSONB DEFAULT '{}'::jsonb
);

-- =========================================================================
-- 3. RESOLVE CIRCULAR FOREIGN KEY DEPENDENCIES ON CHATS
-- =========================================================================
ALTER TABLE public.chats 
    ADD CONSTRAINT fk_chats_last_message FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.chats 
    ADD CONSTRAINT fk_chats_last_call FOREIGN KEY (last_call_id) REFERENCES public.calls(id) ON DELETE SET NULL;

-- =========================================================================
-- 4. DATABASE INDEXES FOR QUERY OPTIMIZATION
-- =========================================================================
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_chats_members ON public.chats USING GIN(members);
CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_calls_caller_id ON public.calls(caller_id);
CREATE INDEX idx_calls_receiver_id ON public.calls(receiver_id);
CREATE INDEX idx_friend_requests_from_to ON public.friend_requests(from_id, to_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_reports_reported_id ON public.reports(reported_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- =========================================================================
-- 5. AUTOMATED TRIGGERS & FUNCTIONS
-- =========================================================================

-- A. Trigger for updating the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_chats_updated_at BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_calls_updated_at BEFORE UPDATE ON public.calls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_friend_requests_updated_at BEFORE UPDATE ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_notification_subscriptions_updated_at BEFORE UPDATE ON public.notification_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B. Trigger to automatically synchronize public.profiles with auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, email, avatar, role, is_guest)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8)),
    COALESCE(NEW.raw_user_meta_data->>'name', 'Blippr User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || NEW.id::TEXT),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE((NEW.raw_user_meta_data->>'is_guest')::BOOLEAN, FALSE)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all public tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_buckets ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- PROFILES POLICIES
-- -------------------------------------------------------------------------
CREATE POLICY "Profiles are viewable by authenticated users" 
ON public.profiles FOR SELECT TO authenticated USING (banned_until IS NULL OR banned_until < NOW());

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- -------------------------------------------------------------------------
-- CHATS POLICIES
-- -------------------------------------------------------------------------
CREATE POLICY "Chats are viewable by members" 
ON public.chats FOR SELECT TO authenticated USING (auth.uid() = ANY(members));

CREATE POLICY "Chats are insertable by members" 
ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = ANY(members));

CREATE POLICY "Chats are updatable by members" 
ON public.chats FOR UPDATE TO authenticated USING (auth.uid() = ANY(members)) WITH CHECK (auth.uid() = ANY(members));

-- -------------------------------------------------------------------------
-- MESSAGES POLICIES
-- -------------------------------------------------------------------------
CREATE POLICY "Messages are viewable by chat members" 
ON public.messages FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.chats 
        WHERE chats.id = messages.chat_id AND auth.uid() = ANY(chats.members)
    )
);

CREATE POLICY "Messages are insertable by chat members" 
ON public.messages FOR INSERT TO authenticated 
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.chats 
        WHERE chats.id = messages.chat_id AND auth.uid() = ANY(chats.members)
    )
);

CREATE POLICY "Messages can be deleted/updated by sender" 
ON public.messages FOR ALL TO authenticated 
USING (auth.uid() = sender_id);

-- -------------------------------------------------------------------------
-- CALLS POLICIES
-- -------------------------------------------------------------------------
CREATE POLICY "Calls viewable by participants" 
ON public.calls FOR SELECT TO authenticated 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Calls insertable by caller" 
ON public.calls FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Calls updatable by participants" 
ON public.calls FOR UPDATE TO authenticated 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- -------------------------------------------------------------------------
-- FRIEND REQUESTS POLICIES
-- -------------------------------------------------------------------------
CREATE POLICY "Friend requests viewable by sender or receiver" 
ON public.friend_requests FOR SELECT TO authenticated 
USING (auth.uid() = from_id OR auth.uid() = to_id);

CREATE POLICY "Friend requests insertable by sender" 
ON public.friend_requests FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = from_id);

CREATE POLICY "Friend requests updatable by sender or receiver" 
ON public.friend_requests FOR UPDATE TO authenticated 
USING (auth.uid() = from_id OR auth.uid() = to_id);

-- -------------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- -------------------------------------------------------------------------
CREATE POLICY "Notifications are viewable by recipient" 
ON public.notifications FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Notifications are deletable by recipient" 
ON public.notifications FOR DELETE TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Notifications are updatable by recipient" 
ON public.notifications FOR UPDATE TO authenticated 
USING (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- SUBSCRIPTIONS POLICIES
-- -------------------------------------------------------------------------
CREATE POLICY "Subscriptions are viewable by owner" 
ON public.notification_subscriptions FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Subscriptions are manageable by owner" 
ON public.notification_subscriptions FOR ALL TO authenticated 
USING (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- REPORTS POLICIES
-- -------------------------------------------------------------------------
CREATE POLICY "Reports insertable by authenticated users" 
ON public.reports FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reports viewable by reporter or admins" 
ON public.reports FOR SELECT TO authenticated 
USING (
    auth.uid() = reporter_id OR 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- -------------------------------------------------------------------------
-- AUDIT LOGS & ANALYTICS POLICIES (Admins only)
-- -------------------------------------------------------------------------
CREATE POLICY "Audit logs only viewable by admins" 
ON public.audit_logs FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Analytics buckets only viewable by admins" 
ON public.analytics_buckets FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- =========================================================================
-- 7. REFRESH API SCHEMA CACHE
-- =========================================================================
NOTIFY pgrst, 'reload schema';
