-- GLOSSARY.md: a conversation with a voter is a "contact" on every channel,
-- matching the call outcome "contacted".
UPDATE "CanvassLog" SET "outcome" = 'contacted' WHERE "outcome" = 'canvassed';

-- "Lead" describes the kind of work a volunteer does, not their status.
-- Leads become active; a general-role lead becomes a coordinator, and any
-- other role is kept.
UPDATE "Volunteer" SET "role" = 'coordinator' WHERE "status" = 'lead' AND "role" = 'general';
UPDATE "Volunteer" SET "status" = 'active' WHERE "status" = 'lead';
