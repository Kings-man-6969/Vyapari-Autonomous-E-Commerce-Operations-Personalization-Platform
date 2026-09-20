-- ============================================================================
-- Migration V4: Performance and Relational Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_seller_status ON products(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_seller_status ON agent_approval_queue(seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_product ON user_interactions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, created_at DESC);
