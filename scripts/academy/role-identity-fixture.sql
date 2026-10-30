-- Fictional relationship experiment only. NOT an application migration or
-- representation of the hosted schema. No auth or baseline/scenario model.
CREATE SCHEMA fictional_roles;
CREATE TABLE fictional_roles.people (
  tenant_id text NOT NULL, id text NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE TABLE fictional_roles.staff (
  tenant_id text NOT NULL, id text NOT NULL, person_id text NOT NULL,
  PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, person_id),
  UNIQUE (tenant_id, id, person_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES fictional_roles.people(tenant_id, id)
);
CREATE TABLE fictional_roles.students (
  tenant_id text NOT NULL, id text NOT NULL, person_id text NOT NULL,
  PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, person_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES fictional_roles.people(tenant_id, id)
);
CREATE TABLE fictional_roles.enrollments (
  tenant_id text NOT NULL, id text NOT NULL, student_id text NOT NULL,
  instructor_person_id text, instructor_id text,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, student_id) REFERENCES fictional_roles.students(tenant_id, id),
  FOREIGN KEY (tenant_id, instructor_person_id) REFERENCES fictional_roles.people(tenant_id, id),
  -- Explicit all-or-neither check prevents nullable compatibility IDs bypassing
  -- the composite FK. This experiment rejects partial pairs, not live records.
  CHECK ((instructor_person_id IS NULL) = (instructor_id IS NULL)),
  FOREIGN KEY (tenant_id, instructor_id, instructor_person_id)
    REFERENCES fictional_roles.staff(tenant_id, id, person_id)
);
INSERT INTO fictional_roles.people VALUES ('school-a','alex'),('school-a','jordan'),('school-b','remote');
INSERT INTO fictional_roles.staff VALUES ('school-a','staff-alex','alex'),('school-a','staff-jordan','jordan'),('school-b','staff-remote','remote');
INSERT INTO fictional_roles.students VALUES ('school-a','student-alex','alex'),('school-a','student-jordan','jordan');
INSERT INTO fictional_roles.enrollments VALUES
  ('school-a','alex-learns-voice','student-alex','jordan','staff-jordan'),
  ('school-a','jordan-learns-piano','student-jordan','alex','staff-alex'),
  ('school-a','alex-unassigned','student-alex',NULL,NULL);