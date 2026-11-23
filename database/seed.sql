-- ============================================================
-- Sample data for the demo
-- ============================================================
-- "npm run setup-db" adds this data only when the categories table is empty,
-- so it never creates duplicates.

INSERT INTO categories (name, description) VALUES
  ('Starters',    'Light snacks and appetizers served before the main meal'),
  ('Main Course', 'Rice dishes, curries and other filling meals'),
  ('Breads',      'Freshly made Indian breads from the tandoor'),
  ('Desserts',    'Sweet dishes to finish the meal'),
  ('Beverages',   'Hot and cold drinks');

-- The sub-queries find the category id by its name,
-- so we do not have to remember which id belongs to which category.
INSERT INTO food_items (name, description, category_id, price, is_available) VALUES
  ('Paneer Tikka',     'Cottage cheese cubes marinated in spices and grilled',  (SELECT id FROM categories WHERE name = 'Starters'),    220.00, TRUE),
  ('Veg Spring Rolls', 'Crispy rolls stuffed with mixed vegetables',            (SELECT id FROM categories WHERE name = 'Starters'),    160.00, TRUE),
  ('Chicken 65',       'Spicy deep-fried chicken bites',                        (SELECT id FROM categories WHERE name = 'Starters'),    240.00, FALSE),
  ('Butter Chicken',   'Chicken cooked in a creamy tomato and butter gravy',    (SELECT id FROM categories WHERE name = 'Main Course'), 320.00, TRUE),
  ('Veg Biryani',      'Basmati rice cooked with vegetables and whole spices',  (SELECT id FROM categories WHERE name = 'Main Course'), 260.00, TRUE),
  ('Dal Makhani',      'Black lentils slow-cooked with butter and cream',       (SELECT id FROM categories WHERE name = 'Main Course'), 210.00, TRUE),
  ('Butter Naan',      'Soft tandoori bread brushed with butter',               (SELECT id FROM categories WHERE name = 'Breads'),       50.00, TRUE),
  ('Garlic Naan',      'Naan topped with chopped garlic and coriander',         (SELECT id FROM categories WHERE name = 'Breads'),       60.00, FALSE),
  ('Gulab Jamun',      'Soft milk dumplings soaked in sugar syrup (2 pcs)',     (SELECT id FROM categories WHERE name = 'Desserts'),     90.00, TRUE),
  ('Masala Chai',      'Indian tea brewed with milk and spices',                (SELECT id FROM categories WHERE name = 'Beverages'),    40.00, TRUE),
  ('Mango Lassi',      'Chilled yogurt drink blended with mango pulp',          (SELECT id FROM categories WHERE name = 'Beverages'),   110.00, TRUE);
