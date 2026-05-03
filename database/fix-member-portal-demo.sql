-- Repair demo member portal: link users.email = member@clci.org to the Fatima sample member.
-- Run with: psql $DATABASE_URL -f database/fix-member-portal-demo.sql
-- Safe to run multiple times (idempotent if already linked).

UPDATE members m
SET user_id = u.id
FROM users u
WHERE lower(u.email) = 'member@clci.org'
  AND u.church_id = m.church_id
  AND lower(trim(coalesce(m.email, ''))) = 'fatima@email.com'
  AND (m.user_id IS DISTINCT FROM u.id);
