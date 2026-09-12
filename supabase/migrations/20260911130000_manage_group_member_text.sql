DROP FUNCTION IF EXISTS public.manage_group_member(text, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.manage_group_member(
    _action text,
    _group_id uuid,
    _user_id uuid,
    _target_group_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _is_admin boolean := public.has_role(auth.uid(), 'admin');
    _is_source_leader boolean := public.leads_group(auth.uid(), _group_id);
BEGIN
    IF auth.uid() IS NULL
       OR (NOT _is_admin AND NOT _is_source_leader) THEN
        RAISE EXCEPTION
            'Only an administrator or leader of this group can manage its members'
            USING ERRCODE = '42501';
    END IF;

    IF _action = 'remove' THEN
        DELETE FROM public.group_members
        WHERE group_id = _group_id
          AND user_id = _user_id;
        RETURN 'success_remove';
    ELSIF _action = 'move' THEN
        UPDATE public.group_members
        SET group_id = _target_group_id
        WHERE group_id = _group_id
          AND user_id = _user_id;
        RETURN 'success_move';
    ELSE
        RETURN 'error_unknown_action';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.manage_group_member(text, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_group_member(text, uuid, uuid, uuid) TO authenticated;