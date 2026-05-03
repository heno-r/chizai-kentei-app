SELECT
  id,
  auth_user_id,
  email,
  display_name,
  status,
  created_at,
  updated_at,
  last_login_at
FROM users
ORDER BY updated_at DESC
LIMIT 20;

