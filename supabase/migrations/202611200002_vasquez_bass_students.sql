-- Three Band-interest clients had no production person. Payer evidence from the
-- 2026-11-19 subscription export: Nichole Vasquez pays for Santi and Catalina;
-- Kay Bass pays for Shaun. No phone numbers or contact details are copied.
BEGIN;

DO $$
DECLARE t uuid := '00000000-0000-0000-0000-000000000001';
        kay uuid := '0f354f3b-19ef-424e-b2ca-5f9ce6b45a60';
        vasquez uuid;
        p uuid;
BEGIN
  SELECT id INTO vasquez FROM public.accounts
    WHERE tenant_id = t AND lower(trim(name)) = 'nichole vasquez' LIMIT 1;
  IF vasquez IS NULL THEN
    INSERT INTO public.accounts (tenant_id, name, email)
      VALUES (t, 'Nichole Vasquez', 'nicholemvasquez@gmail.com')
      RETURNING id INTO vasquez;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.people WHERE tenant_id=t AND custom_fields->>'external_id'='d5cef8af-bdc0-4ba7-b842-79799f7dca12') THEN
    INSERT INTO public.people (tenant_id, first_name, last_name, custom_fields)
      VALUES (t, 'Santi', 'Vasquez', jsonb_build_object('external_id','d5cef8af-bdc0-4ba7-b842-79799f7dca12')) RETURNING id INTO p;
    INSERT INTO public.students (tenant_id, person_id, account_id, client_status) VALUES (t, p, vasquez, 'member');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.people WHERE tenant_id=t AND custom_fields->>'external_id'='413e9807-57f5-4fc6-9638-a3abae92569d') THEN
    INSERT INTO public.people (tenant_id, first_name, last_name, custom_fields)
      VALUES (t, 'Catalina', 'Vasquez', jsonb_build_object('external_id','413e9807-57f5-4fc6-9638-a3abae92569d')) RETURNING id INTO p;
    INSERT INTO public.students (tenant_id, person_id, account_id, client_status) VALUES (t, p, vasquez, 'member');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.people WHERE tenant_id=t AND custom_fields->>'external_id'='ca742bd4-40fa-4980-a49d-333ee07f9202') THEN
    INSERT INTO public.people (tenant_id, first_name, last_name, custom_fields)
      VALUES (t, 'Shaun', 'Bass', jsonb_build_object('external_id','ca742bd4-40fa-4980-a49d-333ee07f9202')) RETURNING id INTO p;
    INSERT INTO public.students (tenant_id, person_id, account_id, client_status) VALUES (t, p, kay, 'member');
  END IF;

  IF (SELECT count(*) FROM public.people p2 JOIN public.students s ON s.person_id=p2.id AND s.tenant_id=p2.tenant_id
      WHERE p2.tenant_id=t AND p2.custom_fields->>'external_id' IN
        ('d5cef8af-bdc0-4ba7-b842-79799f7dca12','413e9807-57f5-4fc6-9638-a3abae92569d','ca742bd4-40fa-4980-a49d-333ee07f9202')) <> 3 THEN
    RAISE EXCEPTION 'Expected three linked students';
  END IF;
END $$;

COMMIT;
