// Illustrative SGD game benchmarks, not verified retailer prices.
// Images are category illustrations rather than exact SKU photographs.
const entries = [
  ['Tech', 'Pocket Bluetooth speaker', 49, 'One palm-sized portable speaker, USB-C charging and splash resistance.'],
  ['Tech', '10,000mAh power bank', 29.9, 'One portable battery with two USB outputs; charging cable included.'],
  ['Tech', '1080p USB webcam', 69, 'One desktop webcam with built-in microphone and privacy cover.'],
  ['Fashion', 'Canvas everyday tote', 18, 'One unbranded cotton canvas tote with an internal pocket.'],
  ['Fashion', 'Classic cotton T-shirt', 24.9, 'One unbranded adult crew-neck T-shirt, 100% cotton.'],
  ['Fashion', 'Packable rain jacket', 59, 'One lightweight adult rain jacket with hood and storage pouch.'],
  ['Fashion', 'Polarised sunglasses', 39, 'One unbranded pair with UV protection and a soft case.'],
  ['Home', 'Ceramic mug, 350ml', 12.9, 'One glazed ceramic mug, dishwasher-safe; no gift packaging.'],
  ['Home', 'Electric kettle, 1.7L', 39.9, 'One cordless kettle with automatic shut-off and a stainless-steel interior.'],
  ['Home', 'Non-stick frying pan, 24cm', 34.9, 'One aluminium frying pan suitable for gas and electric stovetops.'],
  ['Home', 'Cotton bath towel, 70 × 140cm', 19.9, 'One full-size cotton bath towel, approximately 500gsm.'],
  ['Home', 'Dimmable LED desk lamp', 45, 'One mains-powered desk lamp with three brightness settings.'],
  ['Beauty', 'Daily sunscreen, SPF50, 50ml', 22.9, 'One unbranded facial sunscreen tube, 50ml; fragrance-free.'],
  ['Beauty', 'Gentle facial cleanser, 150ml', 16.9, 'One unbranded everyday facial cleanser, 150ml pump bottle.'],
  ['Beauty', 'Hydrating sheet masks, pack of 5', 12.5, 'Five individually wrapped unbranded facial sheet masks.'],
  ['Beauty', 'Lip balm duo, 2 × 4g', 9.9, 'Two unbranded moisturising lip balm sticks, 4g each.'],
  ['Food & Drink', 'Iced oat latte, 350ml', 6.8, 'One takeaway espresso drink with oat milk at an independent café.'],
  ['Food & Drink', 'Chicken rice set', 5.5, 'One hawker-style portion of chicken rice with soup; no drink included.'],
  ['Food & Drink', 'Sourdough loaf, 500g', 8.9, 'One plain bakery sourdough loaf, approximately 500g.'],
  ['Food & Drink', 'Roasted coffee beans, 250g', 18, 'One bag of whole-bean medium-roast coffee; no subscription.'],
  ['Food & Drink', 'Dark chocolate bar, 100g', 5.9, 'One unbranded 70% cocoa chocolate bar, 100g.'],
  ['Food & Drink', 'Sparkling water, 6 × 330ml', 7.2, 'Six cans of plain sparkling water, 330ml each.'],
  ['Sports', 'Yoga mat, 6mm', 29.9, 'One unbranded exercise mat, 183 × 61cm, with carrying strap.'],
  ['Sports', 'Resistance bands, set of 5', 19.9, 'Five loop exercise bands with different resistance levels.'],
  ['Sports', 'Insulated water bottle, 750ml', 32, 'One stainless-steel vacuum-insulated bottle with screw cap.'],
  ['Sports', 'Adjustable skipping rope', 12.9, 'One adult fitness skipping rope with adjustable cable.'],
  ['Sports', 'Badminton starter set', 39.9, 'Two recreational rackets, three shuttlecocks and one carry bag.'],
  ['Sports', 'Foam roller, 33cm', 24.9, 'One medium-firm textured exercise roller, 33cm long.'],
  ['Hobbies', '1,000-piece jigsaw puzzle', 24.9, 'One boxed landscape puzzle with 1,000 pieces.'],
  ['Hobbies', 'Watercolour starter kit', 29.9, 'Twelve paint colours, two brushes and a small paper pad.'],
  ['Hobbies', 'Hardback notebook, A5', 14.9, 'One unbranded A5 notebook with 160 ruled pages.'],
  ['Hobbies', 'Strategy board game', 49.9, 'One unbranded boxed game for 2–4 players, approximately 45 minutes per game.'],
  ['Hobbies', 'Beginner ukulele', 69, 'One soprano ukulele with nylon strings and a soft carry bag.'],
  ['Hobbies', 'Indoor succulent gift set', 22, 'Three small live succulents in individual nursery pots.'],
  ['Everyday', 'Compact folding umbrella', 15.9, 'One manual folding umbrella with a storage sleeve.'],
  ['Everyday', 'Lunch box, 1L', 14.9, 'One reusable compartment lunch box with lid; utensils not included.'],
  ['Everyday', 'USB rechargeable reading light', 12.9, 'One clip-on book light with three brightness settings.'],
  ['Everyday', 'Packing cubes, set of 4', 24.9, 'Four lightweight zipped travel organisers in assorted sizes.'],
  ['Everyday', 'Desk organiser tray', 16.9, 'One unbranded divided plastic tray for stationery and small accessories.'],
  ['Everyday', 'Reusable shopping bags, set of 3', 9.9, 'Three foldable polyester grocery bags with storage pouches.'],
];

// One emoji per item, in entry order. These replace the shared per-category photos, which showed the wrong thing.
const EMOJI = ['🔊', '🔋', '📹', '👜', '👕', '🧥', '🕶️', '☕', '🫖', '🍳', '🛁', '💡', '🧴', '🧼', '🎭', '💄',
  '🥤', '🍗', '🍞', '🫘', '🍫', '🫧', '🧘', '🪢', '🍶', '🪢', '🏸', '🧽', '🧩', '🎨', '📓', '♟️', '🪕', '🌵', '☂️', '🍱', '🔦', '🧳', '🗂️', '🛍️'];

export const EXPANDED_PRODUCTS = entries.map(([category, title, price, description], index) => ({
  id: `item_${String(index + 9).padStart(3, '0')}`, category, title, price, description, emoji: EMOJI[index], imageUrl: null,
}));
