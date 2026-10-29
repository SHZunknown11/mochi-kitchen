// Word lists used by the diet classifier, the NLP layer and the grocery aisle sorter.
// Matching is done on whole words / phrases (see services/diet.js), never on substrings.

const MEAT = [
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'bacon', 'ham', 'sausage', 'sausages',
  'mince', 'minced beef', 'steak', 'brisket', 'ribs', 'veal', 'venison', 'meat', 'chorizo',
  'pancetta', 'prosciutto', 'salami', 'lard', 'gelatin', 'gelatine', 'spam', 'meatballs',
  'bulgogi', 'oxtail', 'liver', 'goat',
];

const FISH = [
  'fish', 'salmon', 'tuna', 'cod', 'haddock', 'shrimp', 'prawn', 'prawns', 'crab', 'squid',
  'anchovy', 'anchovies', 'sardine', 'sardines', 'mackerel', 'trout', 'clam', 'clams', 'mussel',
  'mussels', 'oyster', 'oysters', 'scallop', 'scallops', 'lobster', 'eel', 'octopus', 'bonito',
  'katsuobushi', 'dashi', 'fish sauce', 'fish cake', 'fishcake', 'surimi', 'kamaboko',
  'oyster sauce', 'seafood', 'caviar', 'roe', 'tilapia', 'sea bass', 'snapper',
];
const FISH_EXCEPTIONS = ['oyster mushroom', 'oyster mushrooms', 'vegetarian oyster sauce', 'vegan fish sauce'];

const DAIRY = [
  'milk', 'butter', 'cheese', 'cream', 'yogurt', 'yoghurt', 'ghee', 'parmesan', 'mozzarella',
  'cheddar', 'feta', 'mascarpone', 'ricotta', 'whey', 'custard', 'paneer', 'buttermilk',
  'condensed milk', 'evaporated milk', 'ice cream', 'gruyere', 'halloumi', 'cream cheese',
];
const DAIRY_EXCEPTIONS = [
  'peanut butter', 'almond butter', 'cashew butter', 'cocoa butter', 'shea butter', 'coconut milk',
  'coconut cream', 'soy milk', 'soya milk', 'almond milk', 'oat milk', 'rice milk', 'cream of tartar',
  'butternut', 'butter bean', 'butter beans', 'vegan butter', 'vegan cheese', 'dairy-free',
  'sesame butter', 'sunflower butter',
];

const EGG = ['egg', 'eggs', 'mayonnaise', 'mayo', 'meringue', 'egg yolk', 'egg white', 'yolk'];
const EGG_EXCEPTIONS = ['eggplant', 'eggplants', 'vegan mayo', 'vegan mayonnaise'];

const HONEY = ['honey'];

const GLUTEN = [
  'wheat', 'flour', 'bread', 'breadcrumbs', 'panko', 'pasta', 'spaghetti', 'penne', 'noodles',
  'noodle', 'ramen', 'udon', 'soba', 'soy sauce', 'couscous', 'barley', 'tortilla', 'pita',
  'bulgur', 'semolina', 'beer', 'seitan', 'biscuits', 'cake', 'gochujang', 'lasagne', 'lasagna',
  'macaroni', 'baguette', 'bun', 'buns', 'croissant', 'rye', 'spelt', 'farro', 'wonton wrappers',
  'dumpling wrappers', 'gyoza wrappers', 'puff pastry', 'pastry', 'shortcrust',
];
const GLUTEN_EXCEPTIONS = [
  'rice noodles', 'rice noodle', 'glass noodles', 'glass noodle', 'rice flour', 'corn flour',
  'cornflour', 'corn starch', 'cornstarch', 'tamari', 'gluten-free', 'gluten free', 'buckwheat',
  'sweet potato noodles', 'potato flour', 'chickpea flour', 'almond flour', 'coconut flour',
  'rice paper', 'glutinous rice flour', 'shirataki noodles', 'konjac noodles', 'dangmyeon',
  'tapioca flour', 'tapioca starch',
];

// Aisles for the grocery list. First match wins; anything else becomes "pantry".
const AISLES = [
  ['produce', ['onion', 'garlic', 'ginger', 'carrot', 'cabbage', 'kimchi', 'tomato', 'potato', 'spinach',
    'lettuce', 'cucumber', 'mushroom', 'pepper', 'chilli', 'chili', 'scallion', 'spring onion', 'leek',
    'zucchini', 'courgette', 'eggplant', 'broccoli', 'radish', 'daikon', 'bean sprout', 'sprouts',
    'lemon', 'lime', 'apple', 'banana', 'avocado', 'coriander', 'cilantro', 'parsley', 'basil', 'mint',
    'pumpkin', 'squash', 'corn', 'peas', 'celery', 'shallot', 'bok choy', 'pak choi', 'sweet potato',
    'strawberry', 'mango', 'perilla', 'seaweed', 'nori', 'kale', 'beetroot', 'asparagus']],
  ['meat & seafood', MEAT.concat(FISH)],
  ['dairy & eggs', DAIRY.concat(['egg', 'eggs', 'tofu'])],
  ['grains & noodles', ['rice', 'noodle', 'noodles', 'pasta', 'spaghetti', 'ramen', 'udon', 'soba', 'bread',
    'flour', 'oats', 'panko', 'breadcrumbs', 'tortilla', 'couscous', 'quinoa', 'dumpling wrappers',
    'rice cake', 'tteok']],
];

// Words that are known ingredients (used by the NLP layer to separate "ingredients" from other keywords).
const KNOWN_INGREDIENTS = Array.from(new Set([
  ...MEAT, ...FISH, ...DAIRY, 'egg', 'eggs', 'honey', 'rice', 'noodles', 'pasta', 'tofu', 'kimchi',
  'garlic', 'ginger', 'onion', 'carrot', 'cabbage', 'tomato', 'potato', 'spinach', 'mushroom', 'mushrooms',
  'cucumber', 'lettuce', 'pepper', 'chilli', 'scallion', 'broccoli', 'avocado', 'lemon', 'lime',
  'sesame', 'miso', 'seaweed', 'nori', 'sweet potato', 'pumpkin', 'zucchini', 'eggplant', 'corn',
  'beans', 'chickpeas', 'lentils', 'peas', 'bean sprouts', 'radish', 'daikon', 'bread', 'flour',
  'coconut', 'peanut', 'peanuts', 'almond', 'matcha', 'red bean', 'apple', 'banana', 'strawberry',
  'mango', 'chocolate', 'oats', 'quinoa', 'spring onion', 'soy sauce', 'gochujang', 'tteok', 'udon',
  'ramen', 'soba', 'bok choy', 'basil', 'coriander', 'parsley', 'mint', 'cheese', 'yogurt',
]));

module.exports = {
  MEAT, FISH, FISH_EXCEPTIONS, DAIRY, DAIRY_EXCEPTIONS, EGG, EGG_EXCEPTIONS, HONEY,
  GLUTEN, GLUTEN_EXCEPTIONS, AISLES, KNOWN_INGREDIENTS,
};
