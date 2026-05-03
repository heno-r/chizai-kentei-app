SELECT
  id,
  name,
  reply_email,
  status,
  source_page,
  created_at,
  updated_at
FROM contact_messages
ORDER BY created_at DESC
LIMIT 20;

