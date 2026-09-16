/**
 * Vyapari — Realistic Catalog & Mock Data
 * High-res imagery, realistic INR prices, product variants, and reviews.
 */

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  categoryId: string;
  price: number;
  originalPrice: number;
  discountPercentage: number;
  stockQty: number;
  rating: number;
  reviewCount: number;
  primaryImageUrl: string;
  images: string[];
  description: string;
  features: string[];
  specs: Record<string, string>;
  sellerName: string;
  sellerId: string;
  sellerRating: number;
  isBestseller?: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  variants?: {
    type: string; // e.g. "Color" | "Size" | "Storage"
    options: { label: string; value: string; priceDelta?: number; stock?: number }[];
  }[];
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  itemCount: number;
  imageUrl: string;
}

export const CATEGORIES_DATA: CategoryItem[] = [
  {
    id: "cat-electronics",
    name: "Consumer Electronics",
    slug: "electronics",
    itemCount: 4280,
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat-fashion",
    name: "Apparel & Fashion",
    slug: "fashion",
    itemCount: 12450,
    imageUrl: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat-home",
    name: "Home & Living",
    slug: "home-living",
    itemCount: 3820,
    imageUrl: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat-audio",
    name: "Audio & Wearables",
    slug: "audio-wearables",
    itemCount: 1940,
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat-kitchen",
    name: "Kitchen & Dining",
    slug: "kitchen-dining",
    itemCount: 2650,
    imageUrl: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat-wellness",
    name: "Beauty & Wellness",
    slug: "beauty-wellness",
    itemCount: 5120,
    imageUrl: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&auto=format&fit=crop&q=80",
  },
];

export const PRODUCTS_DATA: ProductItem[] = [
  {
    id: "prod-101",
    name: "AcousticPro ANC Wireless Headphones",
    slug: "acousticpro-anc-wireless-headphones",
    brand: "SonicWave",
    category: "Audio & Wearables",
    categoryId: "cat-audio",
    price: 4999,
    originalPrice: 8999,
    discountPercentage: 44,
    stockQty: 42,
    rating: 4.8,
    reviewCount: 342,
    isBestseller: true,
    isFeatured: true,
    primaryImageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80",
    ],
    description:
      "Engineered with 40mm titanium dynamic drivers and hybrid active noise cancellation, the AcousticPro delivers studio-grade acoustics, 45-hour battery life, and crystal-clear call quality with quad ENC beamforming microphones.",
    features: [
      "Active Noise Cancellation with Transparency Mode",
      "Up to 45 Hours Playtime on a single charge",
      "Multipoint Bluetooth 5.3 connection",
      "Custom EQ tuning via mobile app",
    ],
    specs: {
      Driver: "40mm Titanium Dynamic",
      Battery: "800mAh (45 hours)",
      Connectivity: "Bluetooth 5.3 / 3.5mm Aux",
      Weight: "250g",
      Warranty: "1 Year Brand Warranty",
    },
    sellerName: "Aura Sound Labs",
    sellerId: "seller-aura-01",
    sellerRating: 4.9,
    variants: [
      {
        type: "Color",
        options: [
          { label: "Matte Midnight", value: "midnight", priceDelta: 0 },
          { label: "Platinum Silver", value: "silver", priceDelta: 0 },
          { label: "Desert Sand", value: "sand", priceDelta: 300 },
        ],
      },
    ],
  },
  {
    id: "prod-102",
    name: "Chronos Heritage Automatic Mechanical Watch",
    slug: "chronos-heritage-automatic-mechanical-watch",
    brand: "Chronos",
    category: "Apparel & Fashion",
    categoryId: "cat-fashion",
    price: 12499,
    originalPrice: 18999,
    discountPercentage: 34,
    stockQty: 18,
    rating: 4.9,
    reviewCount: 128,
    isBestseller: true,
    primaryImageUrl: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
    ],
    description:
      "Handcrafted with Japanese 24-jewel automatic movement, scratch-resistant sapphire crystal, and genuine Italian full-grain leather strap. Self-winding with a 42-hour power reserve.",
    features: [
      "Japanese Automatic 24-Jewel Movement",
      "Sapphire Crystal Glass with anti-reflective coating",
      "5 ATM Water Resistance (50 meters)",
      "Genuine Italian Full-Grain Leather Strap",
    ],
    specs: {
      CaseDiameter: "41mm",
      CaseMaterial: "316L Surgical Grade Stainless Steel",
      WaterResistance: "5 ATM (50m)",
      StrapWidth: "20mm",
      Warranty: "2 Years International Warranty",
    },
    sellerName: "Timecraft Horology",
    sellerId: "seller-timecraft-02",
    sellerRating: 4.8,
    variants: [
      {
        type: "Dial Color",
        options: [
          { label: "Obsidian Black", value: "black", priceDelta: 0 },
          { label: "Deep Navy Sunburst", value: "navy", priceDelta: 500 },
          { label: "Emerald Green", value: "emerald", priceDelta: 500 },
        ],
      },
    ],
  },
  {
    id: "prod-103",
    name: "Nordic Minimalist Oak Wood Coffee Table",
    slug: "nordic-minimalist-oak-wood-coffee-table",
    brand: "Form & Function",
    category: "Home & Living",
    categoryId: "cat-home",
    price: 8799,
    originalPrice: 13500,
    discountPercentage: 35,
    stockQty: 9,
    rating: 4.7,
    reviewCount: 94,
    isFeatured: true,
    primaryImageUrl: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop&q=80",
    ],
    description:
      "Crafted from sustainably sourced solid European oak wood, finished with natural non-toxic matte wax. Rounded edges and tapered legs bring Scandinavian warmth to modern living spaces.",
    features: [
      "100% Solid European White Oak",
      "Non-toxic natural matte protective finish",
      "Tool-free 5-minute easy assembly",
      "Sustainably harvested FSC certified timber",
    ],
    specs: {
      Dimensions: "100cm (L) x 55cm (W) x 45cm (H)",
      Material: "Solid White Oak",
      Weight: "14.2 kg",
      Finish: "Natural Matte Clear Polywax",
    },
    sellerName: "Nordic Studio India",
    sellerId: "seller-nordic-03",
    sellerRating: 4.9,
  },
  {
    id: "prod-104",
    name: "UltraAir Pro True HEPA Room Purifier",
    slug: "ultraair-pro-true-hepa-room-purifier",
    brand: "AeroPure",
    category: "Consumer Electronics",
    categoryId: "cat-electronics",
    price: 7499,
    originalPrice: 11999,
    discountPercentage: 37,
    stockQty: 31,
    rating: 4.8,
    reviewCount: 215,
    isBestseller: true,
    primaryImageUrl: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&auto=format&fit=crop&q=80",
    ],
    description:
      "3-stage H13 True HEPA filtration capturing 99.97% of airborne PM2.5 pollutants, allergens, smoke, and odors. Covers up to 450 sq ft with whisper-quiet 22dB sleep mode and real-time AQI LED indicator.",
    features: [
      "Medical Grade H13 True HEPA Filter",
      "Real-time Laser PM2.5 AQI Display",
      "Covers up to 450 sq ft in 12 minutes",
      "Quiet 22dB Sleep Mode & Smart App Control",
    ],
    specs: {
      CADR: "380 m³/h",
      Coverage: "450 sq ft",
      PowerConsumption: "38W Max",
      NoiseLevel: "22dB – 52dB",
      Warranty: "2 Years Comprehensive",
    },
    sellerName: "PureTech Systems",
    sellerId: "seller-puretech-04",
    sellerRating: 4.7,
  },
  {
    id: "prod-105",
    name: "Artisan Stoneware Ceramic Dinner Set (16 Pcs)",
    slug: "artisan-stoneware-ceramic-dinner-set",
    brand: "Clay & Craft",
    category: "Kitchen & Dining",
    categoryId: "cat-kitchen",
    price: 3499,
    originalPrice: 5999,
    discountPercentage: 42,
    stockQty: 24,
    rating: 4.9,
    reviewCount: 88,
    primaryImageUrl: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&auto=format&fit=crop&q=80",
    ],
    description:
      "High-fired reactive glaze stoneware dinner set including 4 dinner plates, 4 quarter plates, 4 cereal bowls, and 4 mugs. Microwave, oven, and dishwasher safe with lead-free glazes.",
    features: [
      "16-Piece complete service for 4",
      "Hand-dipped reactive matte ceramic glaze",
      "100% Microwave, Oven & Dishwasher Safe",
      "Lead-free, cadmium-free food-safe stoneware",
    ],
    specs: {
      Includes: "4x Dinner (10.5\"), 4x Side (8\"), 4x Bowl (6\"), 4x Mug (350ml)",
      Material: "High-Fired Dense Stoneware",
      Care: "Dishwasher & Microwave Safe",
    },
    sellerName: "Khurja Pottery Works",
    sellerId: "seller-khurja-05",
    sellerRating: 4.9,
  },
  {
    id: "prod-106",
    name: "Botanical Restorative Facial Serum (30ml)",
    slug: "botanical-restorative-facial-serum",
    brand: "Verdant Alchemy",
    category: "Beauty & Wellness",
    categoryId: "cat-wellness",
    price: 1850,
    originalPrice: 2400,
    discountPercentage: 23,
    stockQty: 55,
    rating: 4.8,
    reviewCount: 412,
    isNewArrival: true,
    primaryImageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80",
    ],
    description:
      "Formulated with 10% pure Niacinamide, multi-molecular Hyaluronic Acid, and cold-pressed Rosehip oil. Deeply hydrates, balances sebum, and repairs the skin barrier.",
    features: [
      "10% Niacinamide + Zinc 1% + Multi-Hyaluronic",
      "Cold-pressed organic botanical oils",
      "Cruelty-free, paraben-free, silicone-free",
      "Dermatologically tested for all skin types",
    ],
    specs: {
      Volume: "30 ml / 1.0 fl oz",
      KeyIngredients: "Niacinamide, Hyaluronic Acid, Rosehip, Bakuchiol",
      ShelfLife: "24 Months",
    },
    sellerName: "Verdant Organics India",
    sellerId: "seller-verdant-06",
    sellerRating: 4.9,
  },
];

export interface CartItemStore {
  productId: string;
  variantId?: string;
  variantLabel?: string;
  qty: number;
  product: ProductItem;
}

export interface OrderItemRecord {
  id: string;
  orderNumber: string;
  date: string;
  totalAmount: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: string;
  items: {
    product: ProductItem;
    qty: number;
    unitPrice: number;
    variantLabel?: string;
  }[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  payment: {
    method: string;
    transactionId: string;
    status: string;
  };
}

export const SAMPLE_ORDERS: OrderItemRecord[] = [
  {
    id: "ord-8831",
    orderNumber: "VYP-2026-8831",
    date: "2026-08-25T14:32:00Z",
    totalAmount: 4999,
    status: "shipped",
    trackingNumber: "DLH-992817441",
    carrier: "Delhivery Express",
    estimatedDelivery: "28 Aug 2026",
    items: [
      {
        product: PRODUCTS_DATA[0],
        qty: 1,
        unitPrice: 4999,
        variantLabel: "Color: Matte Midnight",
      },
    ],
    shippingAddress: {
      fullName: "Aditya Sharma",
      phone: "+91 98765 43210",
      line1: "Flat 402, Skyline Towers, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
    },
    payment: {
      method: "Razorpay (UPI)",
      transactionId: "pay_rzp_9921783421",
      status: "Captured",
    },
  },
  {
    id: "ord-8710",
    orderNumber: "VYP-2026-8710",
    date: "2026-08-20T10:15:00Z",
    totalAmount: 1850,
    status: "delivered",
    trackingNumber: "BD-88371900",
    carrier: "BlueDart Air",
    estimatedDelivery: "23 Aug 2026",
    items: [
      {
        product: PRODUCTS_DATA[5],
        qty: 1,
        unitPrice: 1850,
      },
    ],
    shippingAddress: {
      fullName: "Aditya Sharma",
      phone: "+91 98765 43210",
      line1: "Flat 402, Skyline Towers, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
    },
    payment: {
      method: "Razorpay (Credit Card)",
      transactionId: "pay_rzp_887190223",
      status: "Captured",
    },
  },
];
