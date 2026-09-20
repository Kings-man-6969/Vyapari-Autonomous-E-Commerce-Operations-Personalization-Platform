const fs = require('fs');
const path = require('path');

function genVec(seed) {
  const v = [];
  for (let i = 0; i < 384; i++) {
    v.push(Math.sin(seed * (i + 1)) * 0.5 + Math.cos((seed + 3) * (i + 2)) * 0.3);
  }
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  return '[' + v.map(x => (x / norm).toFixed(5)).join(',') + ']';
}

const PASSWORD_HASH = '$2a$10$jINy93zJV.IRfYRB.BqJGebHyr5rY5cIgXEMDDXY.QRWGF7GX9mdq'; // Password@123

// Fixed deterministic UUIDs for consistency in seed scripts
const IDS = {
  admin: '00000000-0000-0000-0000-000000000001',
  seller1: '00000000-0000-0000-0000-000000000011',
  seller2: '00000000-0000-0000-0000-000000000012',
  seller3: '00000000-0000-0000-0000-000000000013',
  customer1: '00000000-0000-0000-0000-000000000021',
  customer2: '00000000-0000-0000-0000-000000000022',
  customer3: '00000000-0000-0000-0000-000000000023',
  
  // Categories
  catElectronics: '10000000-0000-0000-0000-000000000001',
  catAudio: '10000000-0000-0000-0000-000000000002',
  catWearables: '10000000-0000-0000-0000-000000000003',
  catFashion: '10000000-0000-0000-0000-000000000010',
  catFootwear: '10000000-0000-0000-0000-000000000011',
  catStreetwear: '10000000-0000-0000-0000-000000000012',
  catHome: '10000000-0000-0000-0000-000000000020',
  catDecor: '10000000-0000-0000-0000-000000000021',
  catKitchen: '10000000-0000-0000-0000-000000000022',

  // Address
  addrCustomer1: '20000000-0000-0000-0000-000000000001',
  addrCustomer2: '20000000-0000-0000-0000-000000000002',

  // Orders
  order1: '30000000-0000-0000-0000-000000000001',
  order2: '30000000-0000-0000-0000-000000000002',
  order3: '30000000-0000-0000-0000-000000000003'
};

const products = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    seller_id: IDS.seller2,
    category_id: IDS.catAudio,
    title: 'Aura Pro Active Noise Cancelling Wireless Headphones',
    slug: 'aura-pro-anc-wireless-headphones',
    description: 'Immersive sound with 40mm custom acoustic drivers, hybrid active noise cancellation, transparency mode, and up to 45 hours battery life.',
    price: 6499.00,
    compare_at_price: 8999.00,
    stock_qty: 24,
    status: 'active',
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80'
    ]),
    attributes: JSON.stringify({ color: 'Matte Black', connectivity: 'Bluetooth 5.3', battery_hours: 45, warranty: '1 Year' }),
    seed: 101
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    seller_id: IDS.seller2,
    category_id: IDS.catAudio,
    title: 'EchoPods Spatial Studio Earbuds with Wireless Case',
    slug: 'echopods-spatial-studio-earbuds',
    description: 'Studio-tuned true wireless earbuds featuring 3D spatial audio, dynamic head tracking, IPX5 water resistance, and fast Qi charging.',
    price: 3299.00,
    compare_at_price: 4999.00,
    stock_qty: 40,
    status: 'active',
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80',
      'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&q=80'
    ]),
    attributes: JSON.stringify({ color: 'Arctic White', rating: 'IPX5', noise_isolation: 'Passive' }),
    seed: 102
  },
  {
    id: '40000000-0000-0000-0000-000000000003',
    seller_id: IDS.seller2,
    category_id: IDS.catWearables,
    title: 'PulseTrack AMOLED Smart Fitness Watch',
    slug: 'pulsetrack-amoled-smart-fitness-watch',
    description: '1.43-inch Always-on AMOLED display with continuous SpO2, HRV tracking, GPS navigation, and 12-day battery life.',
    price: 4499.00,
    compare_at_price: 5999.00,
    stock_qty: 15,
    status: 'active',
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&q=80'
    ]),
    attributes: JSON.stringify({ display: '1.43 AMOLED', water_resistance: '5ATM', strap: 'Silicone' }),
    seed: 103
  },
  {
    id: '40000000-0000-0000-0000-000000000004',
    seller_id: IDS.seller2,
    category_id: IDS.catWearables,
    title: 'Titanium Smart Ring - Sleep & Vitals Tracker',
    slug: 'titanium-smart-ring-sleep-tracker',
    description: 'Ultra-lightweight aerospace-grade titanium ring monitoring sleep stages, skin temperature, and daily readiness score.',
    price: 8999.00,
    compare_at_price: 11999.00,
    stock_qty: 3, // Low stock advisory candidate
    status: 'active',
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80'
    ]),
    attributes: JSON.stringify({ material: 'Grade 5 Titanium', battery: '7 Days', size: 'US 10' }),
    seed: 104
  },
  {
    id: '40000000-0000-0000-0000-000000000005',
    seller_id: IDS.seller1,
    category_id: IDS.catFootwear,
    title: 'Apex Glide Carbon Cushion Running Sneakers',
    slug: 'apex-glide-carbon-running-sneakers',
    description: 'Responsive supercritical nitrogen-infused foam paired with full-length carbon fiber propulsion plate for marathon performance.',
    price: 5999.00,
    compare_at_price: 7999.00,
    stock_qty: 18,
    status: 'active',
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
      'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&q=80'
    ]),
    attributes: JSON.stringify({ size: 'UK 9', color: 'Volt Orange / Black', type: 'Road Running' }),
    seed: 201
  },
  {
    id: '40000000-0000-0000-0000-000000000006',
    seller_id: IDS.seller1,
    category_id: IDS.catFootwear,
    title: 'Retro Classic Suede Court Sneakers',
    slug: 'retro-classic-suede-court-sneakers',
    description: 'Timeless low-top vintage silhouette crafted with premium calfskin suede, vulcanized rubber sole, and ortholite memory footbed.',
    price: 3499.00,
    compare_at_price: 4499.00,
    stock_qty: 0, // Out of stock sample
    status: 'out_of_stock',
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800&q=80'
    ]),
    attributes: JSON.stringify({ size: 'UK 8', color: 'Vintage Beige / Forest Green' }),
    seed: 202
  },
  {
    id: '40000000-0000-0000-0000-000000000007',
    seller_id: IDS.seller1,
    category_id: IDS.catStreetwear,
    title: 'Heavyweight 450GSM Oversized French Terry Hoodie',
    slug: 'heavyweight-450gsm-oversized-hoodie',
    description: 'Luxuriously dense 100% organic combed cotton hoodie with dropped shoulders, double-layered hood, and hidden kangaroo pouch.',
    price: 2799.00,
    compare_at_price: 3499.00,
    stock_qty: 35,
    status: 'active',
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80'
    ]),
    attributes: JSON.stringify({ size: 'L', color: 'Charcoal Wash', gsm: 450 }),
    seed: 203
  },
  {
    id: '40000000-0000-0000-0000-000000000008',
    seller_id: IDS.seller1,
    category_id: IDS.catStreetwear,
    title: 'Relaxed Fit Pleated Tailored Chino Trousers',
    slug: 'relaxed-fit-pleated-tailored-chinos',
    description: 'Modern relaxed silhouette with double front pleats, elasticated back waistband, and premium cotton twill drape.',
    price: 2199.00,
    compare_at_price: 2799.00,
    stock_qty: 28,
    status: 'active',
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'
    ]),
    attributes: JSON.stringify({ waist: '32 inch', color: 'Oatmeal Khaki' }),
    seed: 204
  },
  {
    id: '40000000-0000-0000-0000-000000000009',
    seller_id: IDS.seller3,
    category_id: IDS.catDecor,
    title: 'Handcrafted Minimalist Ceramic Ripple Vase',
    slug: 'handcrafted-minimalist-ceramic-ripple-vase',
    description: 'Stoneware sculptural vase thrown by master potters with a matte textured chalk finish. Ideal for dried pampas grass or floral arrangements.',
    price: 1599.00,
    compare_at_price: 2199.00,
    stock_qty: 12,
    status: 'active',
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=800&q=80'
    ]),
    attributes: JSON.stringify({ height: '26 cm', finish: 'Matte Chalk Ceramic', color: 'Off-White' }),
    seed: 301
  },
  {
    id: '40000000-0000-0000-0000-000000000010',
    seller_id: IDS.seller3,
    category_id: IDS.catKitchen,
    title: 'Artisan Solid Walnut Pour-Over Coffee Station',
    slug: 'artisan-solid-walnut-pour-over-coffee-station',
    description: 'Hand-carved FSC-certified American walnut stand paired with borosilicate glass dripper and precision brass height adjuster.',
    price: 3499.00,
    compare_at_price: 4299.00,
    stock_qty: 9,
    status: 'active',
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80'
    ]),
    attributes: JSON.stringify({ wood: 'American Walnut', metal: 'Solid Brass', capacity: '600 ml' }),
    seed: 302
  }
];

let sql = `-- ============================================================================
-- VYAPARI PLATFORM DEMO SEED DATA
-- Default password for all seed accounts: Password@123
-- ============================================================================

-- Clean existing seed data
TRUNCATE TABLE 
  agent_approval_queue,
  support_draft_replies,
  inventory_advisories,
  product_drafts,
  agent_chat_messages,
  agent_action_logs,
  agent_tasks,
  policy_chunks,
  policy_documents,
  recommendation_cache,
  product_stats_daily,
  user_preference_embeddings,
  product_embeddings,
  user_interactions,
  notifications,
  reviews,
  payments,
  order_status_history,
  order_items,
  orders,
  wishlist_items,
  wishlists,
  cart_items,
  carts,
  products,
  categories,
  addresses,
  seller_profiles,
  users 
CASCADE;

-- 1. USERS
INSERT INTO users (id, name, email, password_hash, role, phone, is_active) VALUES
('${IDS.admin}', 'Vyapari Admin', 'admin@vyapari.com', '${PASSWORD_HASH}', 'admin', '+91 9876543200', true),
('${IDS.seller1}', 'Vikram Malhotra', 'seller1@vyapari.com', '${PASSWORD_HASH}', 'seller', '+91 9876543211', true),
('${IDS.seller2}', 'Ananya Singhania', 'seller2@vyapari.com', '${PASSWORD_HASH}', 'seller', '+91 9876543212', true),
('${IDS.seller3}', 'Kabir Sen', 'seller3@vyapari.com', '${PASSWORD_HASH}', 'seller', '+91 9876543213', true),
('${IDS.customer1}', 'Aarav Sharma', 'customer1@vyapari.com', '${PASSWORD_HASH}', 'customer', '+91 9876543221', true),
('${IDS.customer2}', 'Priya Patel', 'customer2@vyapari.com', '${PASSWORD_HASH}', 'customer', '+91 9876543222', true),
('${IDS.customer3}', 'Rohan Mehta', 'customer3@vyapari.com', '${PASSWORD_HASH}', 'customer', '+91 9876543223', true);

-- 2. SELLER PROFILES
INSERT INTO seller_profiles (user_id, store_name, description, rating_avg, is_verified, business_info) VALUES
('${IDS.seller1}', 'Urban Kicks & Threads', 'Curated streetwear, premium running shoes, and luxury heavyweight apparel.', 4.85, true, '{"gstin":"07AAAAA0000A1Z5", "pan":"AAAAA0000A", "city":"New Delhi"}'),
('${IDS.seller2}', 'Volt Tech Studio', 'Next-generation personal audio, wearables, and cutting-edge digital accessories.', 4.92, true, '{"gstin":"29BBBBB1111B1Z2", "pan":"BBBBB1111B", "city":"Bengaluru"}'),
('${IDS.seller3}', 'Earth & Clay Artisans', 'Bespoke stoneware, artisanal kitchenware, and sustainable handcrafted living essentials.', 4.78, true, '{"gstin":"27CCCCC2222C1Z8", "pan":"CCCCC2222C", "city":"Mumbai"}');

-- 3. ADDRESSES
INSERT INTO addresses (id, user_id, full_name, phone, line1, city, state, pincode, is_default) VALUES
('${IDS.addrCustomer1}', '${IDS.customer1}', 'Aarav Sharma', '+91 9876543221', 'Flat 402, Lotus Orchid, Indiranagar', 'Bengaluru', 'Karnataka', '560038', true),
('${IDS.addrCustomer2}', '${IDS.customer2}', 'Priya Patel', '+91 9876543222', 'B-12 Woodland Heights, Koregaon Park', 'Pune', 'Maharashtra', '411001', true);

-- 4. CATEGORIES
INSERT INTO categories (id, name, slug, parent_id, icon_url) VALUES
('${IDS.catElectronics}', 'Electronics & Gadgets', 'electronics', NULL, 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=200'),
('${IDS.catFashion}', 'Fashion & Apparel', 'fashion-apparel', NULL, 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=200'),
('${IDS.catHome}', 'Home & Living', 'home-living', NULL, 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=200');

INSERT INTO categories (id, name, slug, parent_id) VALUES
('${IDS.catAudio}', 'Audio & Headphones', 'audio-headphones', '${IDS.catElectronics}'),
('${IDS.catWearables}', 'Wearables & Smart Watches', 'smart-wearables', '${IDS.catElectronics}'),
('${IDS.catFootwear}', 'Footwear & Sneakers', 'footwear', '${IDS.catFashion}'),
('${IDS.catStreetwear}', 'Urban Streetwear', 'streetwear', '${IDS.catFashion}'),
('${IDS.catDecor}', 'Home Decor & Vases', 'home-decor', '${IDS.catHome}'),
('${IDS.catKitchen}', 'Coffee & Kitchenware', 'kitchen-dining', '${IDS.catHome}');

-- 5. PRODUCTS
`;

for (const p of products) {
  sql += `INSERT INTO products (id, seller_id, category_id, title, slug, description, price, compare_at_price, stock_qty, status, images, attributes) VALUES
('${p.id}', '${p.seller_id}', '${p.category_id}', '${p.title.replace(/'/g, "''")}', '${p.slug}', '${p.description.replace(/'/g, "''")}', ${p.price}, ${p.compare_at_price}, ${p.stock_qty}, '${p.status}', '${p.images}', '${p.attributes}');\n`;
}

sql += `\n-- 6. PRODUCT EMBEDDINGS (pgvector 384-dim all-MiniLM-L6-v2)\n`;
for (const p of products) {
  if (p.status !== 'archived') {
    const vec = genVec(p.seed);
    sql += `INSERT INTO product_embeddings (product_id, embedding, model_version) VALUES ('${p.id}', '${vec}', 'all-MiniLM-L6-v2');\n`;
  }
}

sql += `\n-- 7. ORDERS, ITEMS & STATUS TIMELINE\n`;
sql += `
-- Order 1: Delivered
INSERT INTO orders (id, user_id, total_amount, status, shipping_address, created_at) VALUES
('${IDS.order1}', '${IDS.customer1}', 6499.00, 'delivered', '{"full_name":"Aarav Sharma","phone":"+91 9876543221","line1":"Flat 402, Lotus Orchid, Indiranagar","city":"Bengaluru","state":"Karnataka","pincode":"560038"}', NOW() - INTERVAL '5 days');

INSERT INTO order_items (order_id, product_id, seller_id, quantity, price_at_purchase) VALUES
('${IDS.order1}', '${products[0].id}', '${IDS.seller2}', 1, 6499.00);

INSERT INTO order_status_history (order_id, status, note, changed_at) VALUES
('${IDS.order1}', 'pending', 'Order placed by customer', NOW() - INTERVAL '5 days'),
('${IDS.order1}', 'paid', 'Payment verified via Razorpay', NOW() - INTERVAL '5 days' + INTERVAL '2 minutes'),
('${IDS.order1}', 'processing', 'Packed and labeled by Volt Tech Studio', NOW() - INTERVAL '4 days'),
('${IDS.order1}', 'shipped', 'Picked up by Blue Dart courier #BD892011', NOW() - INTERVAL '3 days'),
('${IDS.order1}', 'delivered', 'Delivered to recipient with OTP verification', NOW() - INTERVAL '1 day');

INSERT INTO payments (order_id, amount, status, payment_gateway, provider_ref) VALUES
('${IDS.order1}', 6499.00, 'success', 'razorpay', 'pay_mock_order1_rzp_9901');

-- Order 2: Shipped
INSERT INTO orders (id, user_id, total_amount, status, shipping_address, created_at) VALUES
('${IDS.order2}', '${IDS.customer2}', 5999.00, 'shipped', '{"full_name":"Priya Patel","phone":"+91 9876543222","line1":"B-12 Woodland Heights, Koregaon Park","city":"Pune","state":"Maharashtra","pincode":"411001"}', NOW() - INTERVAL '2 days');

INSERT INTO order_items (order_id, product_id, seller_id, quantity, price_at_purchase) VALUES
('${IDS.order2}', '${products[4].id}', '${IDS.seller1}', 1, 5999.00);

INSERT INTO order_status_history (order_id, status, note, changed_at) VALUES
('${IDS.order2}', 'pending', 'Order placed by customer', NOW() - INTERVAL '2 days'),
('${IDS.order2}', 'paid', 'Payment confirmed', NOW() - INTERVAL '2 days' + INTERVAL '1 minute'),
('${IDS.order2}', 'shipped', 'Dispatched via Delhivery Express #DEL9921', NOW() - INTERVAL '1 day');

INSERT INTO payments (order_id, amount, status, payment_gateway, provider_ref) VALUES
('${IDS.order2}', 5999.00, 'success', 'razorpay', 'pay_mock_order2_rzp_8812');

-- 8. REVIEWS (Enforced purchase gate on Order 1)
INSERT INTO reviews (product_id, order_id, user_id, rating, title, comment, sentiment_score, is_verified_purchase) VALUES
('${products[0].id}', '${IDS.order1}', '${IDS.customer1}', 5, 'Best ANC headphones in this price tier', 'The battery life is incredible. Noise cancellation easily blocks out AC and chatter. Build quality feels very premium.', 0.94, true);

-- 9. NOTIFICATIONS
INSERT INTO notifications (user_id, type, title, body, link, is_read) VALUES
('${IDS.customer1}', 'order_delivered', 'Your order has been delivered!', 'Your Aura Pro ANC Wireless Headphones were successfully delivered.', '/orders/${IDS.order1}', true),
('${IDS.seller2}', 'new_order', 'New Order Received', 'Aarav Sharma placed an order for Aura Pro ANC Headphones.', '/seller/orders', true),
('${IDS.seller2}', 'ai_approval_required', 'Agent Approval Required: Restock Alert', 'AI Inventory Advisor suggests reordering Titanium Smart Rings due to high velocity.', '/seller/approvals', false);

-- 10. USER INTERACTIONS (Recommendation Signal)
INSERT INTO user_interactions (user_id, product_id, event_type) VALUES
('${IDS.customer1}', '${products[0].id}', 'view'),
('${IDS.customer1}', '${products[0].id}', 'add_to_cart'),
('${IDS.customer1}', '${products[0].id}', 'purchase'),
('${IDS.customer1}', '${products[1].id}', 'view'),
('${IDS.customer2}', '${products[4].id}', 'view'),
('${IDS.customer2}', '${products[4].id}', 'add_to_cart'),
('${IDS.customer2}', '${products[4].id}', 'purchase'),
('${IDS.customer3}', '${products[2].id}', 'view'),
('${IDS.customer3}', '${products[2].id}', 'wishlist');

-- 11. AGENT TASKS & APPROVAL QUEUE (Team B Demo State)
-- Inventory Advisory
INSERT INTO agent_tasks (id, seller_id, task_type, status, input_payload, output_payload) VALUES
('50000000-0000-0000-0000-000000000001', '${IDS.seller2}', 'inventory_advisory', 'done', 
 '{"product_id":"${products[3].id}","current_stock":3,"velocity_7d":5}', 
 '{"days_left":4.2,"trend":"rising","recommended_reorder":25,"reason":"Sales surged 40% this week while stock is down to 3 units."}');

INSERT INTO inventory_advisories (id, seller_id, product_id, days_of_stock_left, demand_trend, recommended_reorder_qty, reasoning, created_by_task) VALUES
('60000000-0000-0000-0000-000000000001', '${IDS.seller2}', '${products[3].id}', 4.2, 'rising', 25, 'High demand detected in wearable category; stock exhaustion projected in ~4 days.', '50000000-0000-0000-0000-000000000001');

INSERT INTO agent_approval_queue (seller_id, task_id, item_type, reference_id, risk_level, payload, status) VALUES
('${IDS.seller2}', '50000000-0000-0000-0000-000000000001', 'inventory_advisory', '60000000-0000-0000-0000-000000000001', 'medium', 
 '{"product_title":"Titanium Smart Ring","current_stock":3,"recommended_reorder":25,"urgency":"High"}', 'pending');

-- Listing Generator Draft
INSERT INTO agent_tasks (id, seller_id, task_type, status, input_payload, output_payload) VALUES
('50000000-0000-0000-0000-000000000002', '${IDS.seller1}', 'listing_generation', 'done',
 '{"user_prompt":"Create a listing for our new Japanese Selvedge Raw Denim Jeans, 14oz rope dyed indigo."}',
 '{"suggested_title":"Heritage 14oz Japanese Selvedge Raw Denim Jeans","category":"streetwear","suggested_price":4999}');

INSERT INTO product_drafts (id, seller_id, title, description, tags, category_id, confidence, status, created_by_task) VALUES
('70000000-0000-0000-0000-000000000001', '${IDS.seller1}', 'Heritage 14oz Japanese Selvedge Raw Denim Jeans', 
 'Woven on vintage shuttle looms in Okayama using 100% long-staple Zimbabwe cotton. Featuring classic red line selvedge ID, copper rivets, and a mid-rise straight leg cut.',
 '["selvedge","denim","raw-denim","japanese-cotton"]', '${IDS.catStreetwear}', 0.92, 'draft', '50000000-0000-0000-0000-000000000002');

INSERT INTO agent_approval_queue (seller_id, task_id, item_type, reference_id, risk_level, payload, status) VALUES
('${IDS.seller1}', '50000000-0000-0000-0000-000000000002', 'listing_draft', '70000000-0000-0000-0000-000000000001', 'low',
 '{"draft_title":"Heritage 14oz Japanese Selvedge Raw Denim Jeans","price":4999,"category":"Urban Streetwear"}', 'pending');

-- Support reply draft with HIGH risk level (refund inquiry)
INSERT INTO agent_tasks (id, seller_id, task_type, status, input_payload, output_payload) VALUES
('50000000-0000-0000-0000-000000000003', '${IDS.seller2}', 'support_reply', 'done',
 '{"query":"Customer asks: Can I get an immediate refund if the product box seal was broken on delivery?","order_id":"${IDS.order1}"}',
 '{"draft":"Hello Aarav, we are so sorry about that! If the seal was tampered with, we can dispatch a replacement immediately or issue a full refund once returned."}');

INSERT INTO support_draft_replies (id, seller_id, source_type, source_id, intent, draft_response, risk_level, auto_sent, created_by_task) VALUES
('80000000-0000-0000-0000-000000000001', '${IDS.seller2}', 'order_query', '${IDS.order1}', 'return_refund', 
 'Hello Aarav, we are so sorry to hear about the damaged seal! Per our 7-day hassle-free guarantee, we can approve a priority return and full refund as soon as you upload a quick photo of the outer box.', 'high', false, '50000000-0000-0000-0000-000000000003');

INSERT INTO agent_approval_queue (seller_id, task_id, item_type, reference_id, risk_level, payload, status) VALUES
('${IDS.seller2}', '50000000-0000-0000-0000-000000000003', 'support_reply', '80000000-0000-0000-0000-000000000001', 'high',
 '{"intent":"return_refund","risk_reason":"Authorizes refund procedure. Requires seller sign-off.","draft_preview":"Per our 7-day hassle-free guarantee, we can approve a priority return..."}', 'pending');

-- 12. STORE POLICY DOCUMENTS & CHUNKS (Support Agent RAG)
INSERT INTO policy_documents (id, seller_id, title, content) VALUES
('90000000-0000-0000-0000-000000000001', '${IDS.seller2}', 'Volt Tech Return & Warranty Policy', 
 'Volt Tech Studio offers a 7-day return policy on all audio gear in original packaging. 1-year limited warranty covers manufacturing defects.');

INSERT INTO policy_chunks (document_id, chunk_text, embedding, chunk_index) VALUES
('90000000-0000-0000-0000-000000000001', 'Volt Tech Studio offers a 7-day return policy on all audio gear in original packaging.', '${genVec(501)}', 0),
('90000000-0000-0000-0000-000000000001', '1-year limited warranty covers manufacturing defects; physical or water damage is excluded.', '${genVec(502)}', 1);
`;

const outputPath = path.join(__dirname, '..', 'db', 'seed.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log('Successfully generated db/seed.sql with ' + sql.length + ' bytes.');
