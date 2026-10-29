// Very rough nutrition table used ONLY for the "approximate calories" estimate when no AI
// estimate is available. kcal per 100 g, plus grams per piece for count-based ingredients.
// This is a teaching approximation, not a nutrition database - the UI labels it "approx.".

const KCAL_PER_100G = {
  rice: 130, 'cooked rice': 130, noodles: 140, pasta: 160, spaghetti: 160, udon: 130, ramen: 140,
  flour: 360, bread: 265, panko: 360, oats: 380, potato: 77, 'sweet potato': 86, tofu: 76,
  egg: 143, eggs: 143, chicken: 190, 'chicken thigh': 210, 'chicken breast': 165, beef: 250,
  pork: 240, 'pork belly': 520, bacon: 540, salmon: 208, tuna: 130, shrimp: 99, prawn: 99,
  milk: 60, butter: 717, cheese: 400, cream: 340, yogurt: 60, 'coconut milk': 190,
  oil: 884, 'olive oil': 884, 'sesame oil': 884, 'vegetable oil': 884, sugar: 387, honey: 304,
  'soy sauce': 60, 'fish sauce': 35, gochujang: 200, miso: 200, mirin: 240, vinegar: 20,
  onion: 40, garlic: 149, ginger: 80, carrot: 41, cabbage: 25, kimchi: 15, tomato: 18,
  spinach: 23, mushroom: 22, cucumber: 15, lettuce: 15, pepper: 31, broccoli: 34, corn: 86,
  zucchini: 17, eggplant: 25, 'spring onion': 32, scallion: 32, 'bean sprouts': 30, seaweed: 45,
  nori: 35, avocado: 160, banana: 89, apple: 52, lemon: 29, chocolate: 546, 'red bean': 330,
  peanuts: 567, 'peanut butter': 588, sesame: 573, beans: 120, chickpeas: 164, lentils: 116,
  'matcha powder': 330, 'rice cake': 230, tteok: 230, 'rice flour': 360, 'corn starch': 381,
  water: 0, broth: 10, stock: 10, dashi: 5, salt: 0, 'black pepper': 0, 'shaved ice': 0, ice: 0,
  'maple syrup': 260, 'condensed milk': 321, 'soy milk': 45, 'curry roux': 480,
};

const GRAMS_PER_PIECE = {
  egg: 50, eggs: 50, onion: 110, garlic: 5, carrot: 70, tomato: 120, potato: 170, 'sweet potato': 200,
  lemon: 60, banana: 120, apple: 180, avocado: 150, cucumber: 200, zucchini: 200, eggplant: 250,
  'spring onion': 15, scallion: 15, pepper: 120, mushroom: 20, 'rice cake': 30, tteok: 30,
  'nori sheet': 3, nori: 3, 'chicken thigh': 120, 'chicken breast': 180, bacon: 10, bread: 30,
  'fried tofu': 30, strawberry: 15, pork: 150, umeboshi: 8,
};

// Grams per millilitre for ingredients that are much lighter than water (cup measures of dry goods).
const DENSITY_G_PER_ML = {
  flour: 0.52, 'rice flour': 0.6, 'glutinous rice flour': 0.6, oats: 0.37, panko: 0.25, sugar: 0.85,
  'brown sugar': 0.9, cabbage: 0.3, spinach: 0.15, kimchi: 0.6, 'bean sprouts': 0.35, 'shaved ice': 0.3,
  walnuts: 0.45, 'red bean': 0.8, 'corn starch': 0.55, 'cooked rice': 0.65, 'matcha powder': 0.4,
};

const DEFAULT_KCAL_PER_100G = 110;
const DEFAULT_GRAMS_PER_PIECE = 60;

module.exports = {
  KCAL_PER_100G, GRAMS_PER_PIECE, DENSITY_G_PER_ML, DEFAULT_KCAL_PER_100G, DEFAULT_GRAMS_PER_PIECE,
};
