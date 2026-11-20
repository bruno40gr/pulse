-- Band interest spreadsheet (24 students) -> one canonical Band service opportunity each.
-- Person/student identities were resolved read-only from production external IDs;
-- names are copied from the reviewed spreadsheet corrections.
BEGIN;

DO $$
DECLARE result jsonb;
BEGIN
  result := public.create_contact_band_opportunities(
    '00000000-0000-0000-0000-000000000001',
    jsonb_build_array(
    {"person_id": "456afd31-05f5-4d8d-a2a0-c9eaf1474664", "name": "Isaac Ashby"},
    {"person_id": "07ff8449-aee5-4563-be77-d1e36702b109", "name": "Leif Bryant"},
    {"person_id": "6bd3a4b0-ac32-4cee-8cae-710e1a5319f4", "name": "Aiden Cavanna"},
    {"person_id": "2559407a-7991-47a4-a1e5-f4211256bed2", "name": "Daniel Delgado"},
    {"person_id": "be557f17-5cdd-4d43-b9e2-31a2c2f03d39", "name": "Ignacio Delgado"},
    {"person_id": "1fd297d5-8730-4015-b3af-6111b92dde0f", "name": "Luke DeVault"},
    {"person_id": "9ce6dad7-1a96-4d84-ac46-03c2faeaaef6", "name": "Jerrylee Estep"},
    {"person_id": "fb3f19ab-0277-4b92-92b0-5ad34e206f52", "name": "Samme Foss"},
    {"person_id": "9196393e-ccc7-461b-9052-fee538474ec2", "name": "Tanya Kumar"},
    {"person_id": "b5af8e11-bc2b-4192-ab63-250016bf5a94", "name": "Alek Kurdin"},
    {"person_id": "f92b0551-e0d2-4023-a431-91e1f56a4262", "name": "Mantas Metivier"},
    {"person_id": "f4fe29f8-d399-4785-abcb-1555f56da899", "name": "Londyn Morris"},
    {"person_id": "cc2f7281-13da-45f4-8a20-53186b14b583", "name": "Bailey Noel"},
    {"person_id": "070b389e-0b50-4dff-9506-be8630c0e0f7", "name": "AJ Parrera"},
    {"person_id": "10569d2e-3fea-4f10-9afa-afde8dca2857", "name": "Brianna Reese"},
    {"person_id": "57ab82eb-c901-4d6a-af15-a47e468c9815", "name": "Elijah Shifrin"},
    {"person_id": "3061dd7c-1805-4244-ad99-101b3c75a371", "name": "Bella Simmons"},
    {"person_id": "ef13947b-5aff-4946-b718-97b7ea1d54a3", "name": "Anastasia Smeja"},
    {"person_id": "95383295-ef18-4809-bf31-699764c86037", "name": "Lincoln Solis"},
    {"person_id": "5f06a53d-850e-4a76-93dd-24d311d1e941", "name": "Grayson Tallman"},
    {"person_id": "125a79e6-2b25-4c0f-9d05-30f832c96750", "name": "Taylor Tallman"},
    {"person_id": "899ee997-6467-4a54-8289-2a4cd48c9e24", "name": "Madeline Vaughn"},
    {"person_id": "9db51f04-e318-4efd-9783-c9db1f32e758", "name": "Aubrielle Vu"},
    {"person_id": "821becd9-a790-420f-99df-2552c11f8302", "name": "Ralph Walton"}
    )
  );
  IF jsonb_array_length(result) <> 24 THEN
    RAISE EXCEPTION 'Expected 24 results, got %', jsonb_array_length(result);
  END IF;
  IF (SELECT count(*) FROM public.contact_band_opportunity_links WHERE tenant_id='00000000-0000-0000-0000-000000000001') <> 24 THEN
    RAISE EXCEPTION 'Expected 24 canonical links';
  END IF;
END $$;

COMMIT;
