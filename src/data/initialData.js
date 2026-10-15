export const INITIAL_ITEMS = [
  {
    id: 'item-1',
    title: 'Sony WH-1000XM5 Wireless Headphones',
    description: 'Industry-leading noise canceling with 8 microphones, Auto NC Optimizer, and 30-hour battery life.',
    category: 'Tech',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    truePrice: 499,
    currency: 'SGD',
    sourceUrl: 'https://store.sony.com.sg',
    brand: 'Sony',
    status: 'active'
  },
  {
    id: 'item-2',
    title: 'Aesop Resurrection Aromatique Hand Balm',
    description: 'Nourishing botanical blend of Mandarin Rind, Rosemary Leaf, and Cedar Atlas with rich hydration.',
    category: 'Beauty',
    imageUrl: 'https://images.unsplash.com/photo-1608248597358-1e428cfddf1f?auto=format&fit=crop&w=800&q=80',
    truePrice: 43,
    currency: 'SGD',
    sourceUrl: 'https://aesop.com',
    brand: 'Aesop',
    status: 'active'
  },
  {
    id: 'item-3',
    title: 'Lululemon Everywhere Belt Bag 1L',
    description: 'Water-repellent nylon waist pack with exterior zippered pocket and easy interior organization.',
    category: 'Fashion',
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
    truePrice: 58,
    currency: 'SGD',
    sourceUrl: 'https://lululemon.com',
    brand: 'Lululemon',
    status: 'active'
  },
  {
    id: 'item-4',
    title: 'Specialty Cold Brew Flight (4 Bottles)',
    description: 'Single-origin Ethiopian Yirgacheffe & Colombian Geisha steep-brewed for 24 hours in small batches.',
    category: 'F&B',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80',
    truePrice: 32,
    currency: 'SGD',
    sourceUrl: 'https://craftcoffee.sg',
    brand: 'Artisan Roast',
    status: 'active'
  },
  {
    id: 'item-5',
    title: 'Dyson Supersonic™ Hair Dryer (Ceramic Pink)',
    description: 'Fast drying with intelligent heat control powered by the Dyson digital motor V9.',
    category: 'Beauty',
    imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
    truePrice: 659,
    currency: 'SGD',
    sourceUrl: 'https://dyson.com.sg',
    brand: 'Dyson',
    status: 'active'
  },
  {
    id: 'item-6',
    title: 'Muji Ultrasonic Aroma Diffuser Large',
    description: 'Uses ultrasonic waves to vaporize water and essential oils, producing a cool, fragrant mist.',
    category: 'Home',
    imageUrl: 'https://images.unsplash.com/photo-1602928321679-560bb453f190?auto=format&fit=crop&w=800&q=80',
    truePrice: 89,
    currency: 'SGD',
    sourceUrl: 'https://muji.com.sg',
    brand: 'Muji',
    status: 'active'
  },
  {
    id: 'item-7',
    title: 'Apple Watch Ultra 2 GPS + Cellular',
    description: '49mm titanium case, precision dual-frequency GPS, and up to 36 hours of normal battery life.',
    category: 'Tech',
    imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80',
    truePrice: 1199,
    currency: 'SGD',
    sourceUrl: 'https://apple.com/sg',
    brand: 'Apple',
    status: 'active'
  }
];

export const SYNC_CLUSTERS = [
  {
    id: 'cluster-1',
    name: 'Value Hunters',
    tagline: 'Spot-on with everyday essentials, highly sensitive to price inflation.',
    description: 'You tend to accurately estimate FMCG & lifestyle staples but expect tech gadgets to cost slightly less than MSRP.',
    color: '#06b6d4',
    bgGlow: 'rgba(6, 182, 212, 0.15)',
    avatar: '🎯',
    memberCount: 1420,
    traits: ['Accurate on F&B', 'Skeptical of Luxury Markups', 'Deal Sensitive'],
    centroid: { Tech: -12, Beauty: -5, Fashion: -8, 'F&B': 2, Home: -4 }
  },
  {
    id: 'cluster-2',
    name: 'Tech Optimists',
    tagline: 'Deep tech fluency, willing to over-index on hardware innovation.',
    description: 'You intuitively calibrate audio, computing, and wearable gear with laser precision, frequently over-valuing novel specs.',
    color: '#6366f1',
    bgGlow: 'rgba(99, 102, 241, 0.15)',
    avatar: '⚡',
    memberCount: 2180,
    traits: ['Tech Savvy', 'Overvalues Features', 'Early Adopter'],
    centroid: { Tech: 4, Beauty: 15, Fashion: 12, 'F&B': 8, Home: 6 }
  },
  {
    id: 'cluster-3',
    name: 'Luxury Realists',
    tagline: 'Understands high-tier branding and premium craftsmanship markups.',
    description: 'You rarely get sticker shock from designer apparel, prestige skincare, or boutique dining.',
    color: '#a855f7',
    bgGlow: 'rgba(168, 85, 247, 0.15)',
    avatar: '💎',
    memberCount: 980,
    traits: ['Brand Conscious', 'Tolerates High Price', 'Aesthetic Focus'],
    centroid: { Tech: 8, Beauty: 2, Fashion: 3, 'F&B': 14, Home: 10 }
  },
  {
    id: 'cluster-4',
    name: 'Market Mavens',
    tagline: 'Omni-category balance with lowest overall variance.',
    description: 'You have a well-rounded barometer for cross-market consumer goods and consistently rank in the top percentile for accuracy.',
    color: '#10b981',
    bgGlow: 'rgba(16, 185, 129, 0.15)',
    avatar: '🧭',
    memberCount: 3100,
    traits: ['Balanced Judgment', 'Low Variance', 'High Overall Accuracy'],
    centroid: { Tech: 0, Beauty: -1, Fashion: 1, 'F&B': -1, Home: 0 }
  },
  {
    id: 'cluster-5',
    name: 'Bargain Seekers',
    tagline: 'Expects discounts everywhere; conservative price anchor.',
    description: 'Your intuition regularly assumes promotional pricing, sale rates, and e-commerce flash deals across categories.',
    color: '#f59e0b',
    bgGlow: 'rgba(245, 158, 11, 0.15)',
    avatar: '🏷️',
    memberCount: 1750,
    traits: ['Sale-Minded', 'Lower Anchor', 'Frugal Mindset'],
    centroid: { Tech: -22, Beauty: -18, Fashion: -25, 'F&B': -15, Home: -20 }
  }
];

export const INITIAL_LEADERBOARD = [
  { rank: 1, username: 'PriceNinja_SG', group: 'Market Mavens', points: 3840, accuracy: 96.2, streak: 14, avatar: '🥷' },
  { rank: 2, username: 'ValuationQueen', group: 'Luxury Realists', points: 3620, accuracy: 94.8, streak: 9, avatar: '👑' },
  { rank: 3, username: 'ByteBuyer', group: 'Tech Optimists', points: 3410, accuracy: 92.5, streak: 8, avatar: '🤖' },
  { rank: 4, username: 'BargainHunter99', group: 'Value Hunters', points: 3290, accuracy: 91.1, streak: 6, avatar: '🏹' },
  { rank: 5, username: 'Chloe_SG', group: 'Market Mavens', points: 3150, accuracy: 89.8, streak: 5, avatar: '🌸' },
  { rank: 6, username: 'DaveKicks', group: 'Tech Optimists', points: 2980, accuracy: 88.0, streak: 4, avatar: '👟' },
  { rank: 7, username: 'You', group: 'Value Hunters', points: 1450, accuracy: 84.5, streak: 3, avatar: '🚀', isCurrentUser: true },
  { rank: 8, username: 'SamEatsLocal', group: 'Value Hunters', points: 1390, accuracy: 83.2, streak: 2, avatar: '🍜' }
];

export const BADGES_LIST = [
  { id: 'first_guess', name: 'Price Novice', icon: '🎯', desc: 'Submitted your first price guess', unlocked: true },
  { id: 'bullseye', name: 'Bullseye Master', icon: '✨', desc: 'Guess within 5% of true price', unlocked: true },
  { id: 'streak_3', name: 'Sync Flow', icon: '🔥', desc: 'Achieved a 3-round bonus streak', unlocked: true },
  { id: 'tech_expert', name: 'Silicon Sage', icon: '⚡', desc: 'Guessed 5 Tech items with >90% accuracy', unlocked: false },
  { id: 'data_contributor', name: 'Insight Pioneer', icon: '📊', desc: 'Opted in to power brand pricing intelligence', unlocked: true }
];
