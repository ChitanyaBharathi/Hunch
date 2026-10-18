import { EXPANDED_PRODUCTS } from './catalogExpansion.js';
import { MORE_PRODUCTS } from './catalogMore.js';
import { imageFor } from './productImages.js';

const ORIGINAL_EMOJI = { prod_1: '🎧', prod_2: '🩱', prod_3: '💨', prod_4: '🧼', prod_5: '💻', prod_6: '⌨️', prod_7: '☕', prod_8: '👟' };

const ORIGINAL_PRODUCTS = [
  {
    id: 'prod_1',
    title: 'Sony WH-1000XM5 Wireless Headphones',
    category: 'Tech',
    price: 499.00,
    description: 'Industry-leading noise canceling headphones with two processors and 8 microphones.',
    imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
    cohortInsights: {
      'Value Hunters': 420,
      'Premium Trendsetters': 549,
      'Balanced Realists': 490
    }
  },
  {
    id: 'prod_2',
    title: 'Lululemon Align™ High-Rise Pant 25"',
    category: 'Fashion',
    price: 158.00,
    description: 'Buttery-soft Nulu™ fabric designed for yoga and daily comfort.',
    imageUrl: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=800&q=80',
    cohortInsights: {
      'Value Hunters': 120,
      'Premium Trendsetters': 180,
      'Balanced Realists': 155
    }
  },
  {
    id: 'prod_3',
    title: 'Dyson Supersonic™ Hair Dryer',
    category: 'Beauty',
    price: 649.00,
    description: 'Fast drying with no extreme heat. Engineered for different hair types.',
    imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
    cohortInsights: {
      'Value Hunters': 520,
      'Premium Trendsetters': 699,
      'Balanced Realists': 640
    }
  },
  {
    id: 'prod_4',
    title: 'Aesop Resurrection Aromatique Hand Wash (500ml)',
    category: 'Beauty',
    price: 57.00,
    description: 'Gentle cleansing gel with Mandarin Rind, Rosemary Leaf, and Cedar Atlas.',
    imageUrl: 'https://images.unsplash.com/photo-1608248597359-59703668383a?auto=format&fit=crop&w=800&q=80',
    cohortInsights: {
      'Value Hunters': 40,
      'Premium Trendsetters': 65,
      'Balanced Realists': 55
    }
  },
  {
    id: 'prod_5',
    title: 'Apple iPad Air 11-inch (M2, 128GB)',
    category: 'Tech',
    price: 899.00,
    description: 'Powered by the incredible Apple M2 chip with Liquid Retina display.',
    imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80',
    cohortInsights: {
      'Value Hunters': 799,
      'Premium Trendsetters': 949,
      'Balanced Realists': 890
    }
  },
  {
    id: 'prod_6',
    title: 'Keychron Q1 Pro Wireless Mechanical Keyboard',
    category: 'Tech',
    price: 279.00,
    description: 'Full aluminum 75% layout custom mechanical keyboard with hot-swappable switches.',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
    cohortInsights: {
      'Value Hunters': 220,
      'Premium Trendsetters': 310,
      'Balanced Realists': 275
    }
  },
  {
    id: 'prod_7',
    title: 'Nespresso Vertuo Pop Coffee Machine',
    category: 'Home',
    price: 249.00,
    description: 'Compact capsule coffee machine brewing 4 distinct cup sizes with Centrifusion™.',
    imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=800&q=80',
    cohortInsights: {
      'Value Hunters': 189,
      'Premium Trendsetters': 289,
      'Balanced Realists': 240
    }
  },
  {
    id: 'prod_8',
    title: 'On Cloud 5 Running Shoes',
    category: 'Fashion',
    price: 229.00,
    description: 'Lightweight all-day comfort shoes with CloudTec® zero-gravity foam.',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    cohortInsights: {
      'Value Hunters': 190,
      'Premium Trendsetters': 250,
      'Balanced Realists': 225
    }
  }
];

export const PRODUCTS = [...ORIGINAL_PRODUCTS.map(p => ({ ...p, emoji: ORIGINAL_EMOJI[p.id] })), ...EXPANDED_PRODUCTS, ...MORE_PRODUCTS].map(({ cohortInsights: _unused, ...product }) => ({
  ...product,
  imageUrl: imageFor(product.id),
  currency: 'SGD',
  benchmarkStatus: 'demo',
  benchmarkSource: null,
  benchmarkCheckedAt: null,
  imageKind: 'illustrative',
}));
