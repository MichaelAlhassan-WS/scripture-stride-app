CREATE OR REPLACE FUNCTION public.manage_group_member(
  _action TEXT,
  _group_id UUID,
  _user_id UUID,
  _target_group_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin BOOLEAN := public.has_role(auth.uid(), 'admin');
  _is_source_leader BOOLEAN := public.leads_group(auth.uid(), _group_id);
  _was_leader BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR (NOT _is_admin AND NOT _is_source_leader) THEN
    RAISE EXCEPTION 'Only an administrator or leader of this group can manage its members'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'That user is not a member of this group';
  END IF;

  SELECT is_leader INTO _was_leader
  FROM public.group_members
  WHERE group_id = _group_id AND user_id = _user_id;

  IF _action IN ('promote', 'demote') THEN
    UPDATE public.group_members
    SET is_leader = (_action = 'promote')
    WHERE group_id = _group_id AND user_id = _user_id;
  ELSIF _action = 'remove' THEN
    DELETE FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id;
  ELSIF _action = 'move' THEN
    IF _target_group_id IS NULL OR _target_group_id = _group_id THEN
      RAISE EXCEPTION 'Choose a different destination group';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.groups WHERE id = _target_group_id) THEN
      RAISE EXCEPTION 'Destination group does not exist';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = _target_group_id AND user_id = _user_id
    ) THEN
      RAISE EXCEPTION 'That user already belongs to the destination group'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.group_members (group_id, user_id, is_leader)
    SELECT _target_group_id, _user_id, _was_leader;
    DELETE FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id;
  ELSE
    RAISE EXCEPTION 'Unsupported group member action';
  END IF;

  -- Keep the existing Leader Dashboard access role in sync with per-group leadership.
  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE user_id = _user_id AND is_leader
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'leader')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id AND role = 'leader';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can delete users' USING ERRCODE = '42501';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own administrator account';
  END IF;

  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.highlights WHERE user_id = _user_id;
  DELETE FROM public.bookmarks WHERE user_id = _user_id;
  DELETE FROM public.reading_sessions WHERE user_id = _user_id;
  DELETE FROM public.study_logs WHERE user_id = _user_id;
  DELETE FROM public.group_members WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User account not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.manage_group_member(TEXT, UUID, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_group_member(TEXT, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;