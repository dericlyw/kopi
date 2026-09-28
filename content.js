/* =========================================================================
   THE DAILY BREW — content.js
   All editable business & product content lives here. Update product
   names, descriptions, prices, or image paths in this file — script.js
   and index.html read everything from CONTENT and never hardcode it.
   ========================================================================= */

const CONTENT = {

  business: {
    name: "The Daily Brew",
    tagline: "Your neighbourhood coffee stop",
    logoIcon: "☕",
    address: "12 Jalan Kopi, Petaling Jaya",
    phone: "+60 12-345 6789",
    hours: "Mon – Sun, 8:00am – 8:00pm",
  },

  // Shown in the checkout form.
  orderTypes: ["Dine-in", "Takeaway", "Delivery"],
  paymentMethods: ["Cash", "Card", "E-Wallet"],

  // The four stages every order moves through. Order matters — code
  // elsewhere assumes this exact sequence.
  orderStatuses: ["NEW", "PREPARING", "READY", "COMPLETED"],

  // Brew Streak loyalty. Built on habit design, not spend: customers earn
  // one stamp per DAY they order (any amount), so the thing we reward is
  // showing up. Every value here is safe to tune.
  loyalty: {
    programName: "Brew Streak",
    stampsForReward: 8,                         // order-days per free drink
    rewardMaxValue: 10.50,                      // free drink covers up to this price
    drinkCategories: ["coffee", "tea", "cold"], // what the reward / pass can cover
    restDayWindow: 7,                           // one missed day forgiven per this many days
  },

  // Prepaid pass: one drink a day covered for `days` days. Sold as a
  // normal cart item (see product "pass01" below); activated on the
  // customer's phone number when the order is placed.
  pass: {
    productId: "pass01",
    name: "Daily Brew Pass",
    days: 30,
    maxValue: 10.50, // covers one drink per day up to this price
  },

  categories: [
    { id: "coffee", name: "Coffee" },
    { id: "tea", name: "Tea & Non-Coffee" },
    { id: "pastries", name: "Pastries & Bakes" },
    { id: "snacks", name: "Snacks" },
    { id: "cold", name: "Cold Drinks" },
  ],

  // Each product: id (unique), category (matches a category id above),
  // name, desc, price (number, local currency), image (file path —
  // replace the file to change the photo, no code changes needed).
  products: [
    // ---- Coffee ----
    { id: "esp01", category: "coffee", name: "Espresso", desc: "A tight, syrupy double shot — the house standard.", price: 6.50, image: "images/coffee.jpg" },
    { id: "amc01", category: "coffee", name: "Americano", desc: "Espresso lengthened with hot water, still full-bodied.", price: 7.50, image: "images/coffee.jpg" },
    { id: "lat01", category: "coffee", name: "Cafe Latte", desc: "Espresso with steamed milk and a thin layer of foam.", price: 9.00, image: "images/coffee.jpg" },
    { id: "cap01", category: "coffee", name: "Cappuccino", desc: "Equal parts espresso, steamed milk, and airy foam.", price: 9.00, image: "images/coffee.jpg" },
    { id: "moc01", category: "coffee", name: "Mocha", desc: "Espresso, steamed milk, and Belgian dark chocolate.", price: 10.50, image: "images/coffee.jpg" },

    // ---- Tea & Non-Coffee ----
    { id: "eng01", category: "tea", name: "English Breakfast Tea", desc: "A robust black tea blend, served with milk on the side.", price: 7.00, image: "images/tea.jpg" },
    { id: "cml01", category: "tea", name: "Chamomile Tea", desc: "Caffeine-free and floral — a gentle way to end the day.", price: 7.00, image: "images/tea.jpg" },
    { id: "mtl01", category: "tea", name: "Matcha Latte", desc: "Stone-ground Japanese matcha whisked with steamed milk.", price: 10.00, image: "images/tea.jpg" },
    { id: "hcc01", category: "tea", name: "Hot Chocolate", desc: "Steamed milk with melted dark chocolate, no coffee at all.", price: 9.50, image: "images/tea.jpg" },

    // ---- Pastries & Bakes ----
    { id: "crs01", category: "pastries", name: "Butter Croissant", desc: "Laminated and baked fresh every morning.", price: 6.00, image: "images/pastries.jpg" },
    { id: "pcr01", category: "pastries", name: "Pain au Chocolat", desc: "Buttery pastry wrapped around two batons of dark chocolate.", price: 7.00, image: "images/pastries.jpg" },
    { id: "bnf01", category: "pastries", name: "Banana Walnut Muffin", desc: "Moist banana muffin studded with toasted walnuts.", price: 6.50, image: "images/pastries.jpg" },
    { id: "chc01", category: "pastries", name: "Chocolate Chip Cookie", desc: "Crisp edges, gooey centre, loaded with chocolate chunks.", price: 5.00, image: "images/pastries.jpg" },

    // ---- Snacks ----
    { id: "clb01", category: "snacks", name: "Club Sandwich", desc: "Grilled chicken, egg, lettuce and tomato on toasted bread.", price: 14.00, image: "images/snacks.jpg" },
    { id: "avt01", category: "snacks", name: "Avocado Toast", desc: "Smashed avocado, chilli flakes, and a squeeze of lime.", price: 13.00, image: "images/snacks.jpg" },
    { id: "sld01", category: "snacks", name: "Caesar Salad", desc: "Romaine, parmesan, croutons, grilled chicken, caesar dressing.", price: 15.00, image: "images/snacks.jpg" },

    // ---- Cold Drinks ----
    { id: "icl01", category: "cold", name: "Iced Latte", desc: "Espresso and cold milk over ice — simple and clean.", price: 9.50, image: "images/cold.jpg" },
    { id: "ictl01", category: "cold", name: "Iced Tea", desc: "House-brewed black tea, lightly sweetened, served cold.", price: 6.50, image: "images/cold.jpg" },
    { id: "smt01", category: "cold", name: "Mixed Berry Smoothie", desc: "Blended strawberries, blueberries, banana and yoghurt.", price: 12.00, image: "images/cold.jpg" },
    { id: "lmd01", category: "cold", name: "Fresh Lemonade", desc: "Fresh-squeezed lemon, mint, and soda water over ice.", price: 8.00, image: "images/cold.jpg" },

    // ---- Pass (sold from the Rewards screen; "pass" has no menu tab) ----
    { id: "pass01", category: "pass", name: "Daily Brew Pass — 30 days", desc: "One drink a day on us for 30 days. Just order as usual; we take it off at checkout.", price: 99.00, image: "images/pass.jpg" },
  ],
};
