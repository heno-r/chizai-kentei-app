PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS question_sets (
  set_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  audience_tag TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL,
  visibility TEXT NOT NULL,
  required_plan TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_dataset_key TEXT NOT NULL,
  published_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS published_questions (
  question_id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL,
  answer_index INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  option_explanations_json TEXT NOT NULL,
  memory_tip TEXT NOT NULL,
  is_free INTEGER NOT NULL DEFAULT 0,
  required_plan TEXT NOT NULL,
  status TEXT NOT NULL,
  source_snapshot_json TEXT,
  editorial_source_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  approved_by TEXT,
  approved_on TEXT,
  published_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_set_items (
  set_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (set_id, question_id),
  FOREIGN KEY (set_id) REFERENCES question_sets(set_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES published_questions(question_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS publish_batches (
  publish_id TEXT PRIMARY KEY,
  dataset_key TEXT NOT NULL,
  set_id TEXT NOT NULL,
  published_by TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  published_at TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_question_sets_visibility_active
  ON question_sets(visibility, is_active);

CREATE INDEX IF NOT EXISTS idx_question_set_items_sort
  ON question_set_items(set_id, sort_order);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL,
  auth_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  price_jpy INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'JPY',
  payment_provider TEXT NOT NULL,
  provider_checkout_id TEXT,
  provider_payment_id TEXT,
  order_status TEXT NOT NULL,
  purchased_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  product_code TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  expires_at TEXT,
  source_order_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id
  ON users(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_status
  ON orders(user_id, order_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entitlements_user_status
  ON entitlements(user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS billing_catalog (
  product_code TEXT PRIMARY KEY,
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  amount_jpy INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'JPY',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_catalog_price
  ON billing_catalog(stripe_price_id);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  reply_email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  source_page TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created
  ON contact_messages(status, created_at DESC);
