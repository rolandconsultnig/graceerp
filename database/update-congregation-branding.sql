-- Run once against your DB if you already seeded with the old demo church name:
--   psql -U postgres -d graceerp -f database/update-congregation-branding.sql

-- Remove legacy demo congregation name if still present (fixes header / login subtitle).
UPDATE churches
SET name = 'Christ Apostolic Church (All Saints) DCC'
WHERE name ILIKE '%Covenant Life Church International%';

UPDATE churches
SET
  name = 'Christ Apostolic Church (All Saints) DCC',
  tagline = 'Located in Citec Estate, Abuja',
  address = 'Citec Estate',
  city = 'Abuja',
  state = 'FCT',
  country = 'Nigeria';

UPDATE branches
SET
  name = 'Main sanctuary · Citec Estate',
  code = 'CAC-CITEC',
  address = 'Citec Estate',
  city = 'Abuja',
  state = 'FCT'
WHERE is_headquarters = TRUE;
