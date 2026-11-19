-- ==============================================================================
-- FUNGIES SEED DATA (Datos de prueba para hongos y adaptógenos)
-- ==============================================================================

-- 1. Categorías
INSERT INTO product_categories (id, name, slug, description)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Extractos Líquidos', 'extractos-liquidos', 'Tinturas madre y extractos dobles concentrados.'),
  ('22222222-2222-2222-2222-222222222222', 'Cápsulas y Polvos', 'capsulas-polvos', 'Hongos funcionales deshidratados y molidos para consumo diario.'),
  ('33333333-3333-3333-3333-333333333333', 'Kits de Autocultivo', 'kits-autocultivo', 'Kits listos para fructificar tus propios hongos gourmet en casa.')
ON CONFLICT (slug) DO NOTHING;

-- 2. Productos
INSERT INTO products (id, category_id, name, slug, description, short_description, price, stock, sku, images, is_active)
VALUES 
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'Extracto Doble Melena de León (Hericium erinaceus)',
    'extracto-melena-de-leon',
    'Extracto concentrado 100% puro para enfoque mental, memoria y neurogénesis.',
    'Potencia tu enfoque y claridad cognitiva.',
    85000.00,
    50,
    'FNG-MEL-01',
    '["https://images.unsplash.com/photo-1546069901-ba9599a7e63c"]'::jsonb,
    true
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    'Extracto Reishi (Ganoderma lucidum)',
    'extracto-reishi',
    'Conocido como el hongo de la inmortalidad. Favorece la relajación, el sueño reparador y el sistema inmune.',
    'Equilibrio, calma y refuerzo inmunológico.',
    82000.00,
    40,
    'FNG-REI-01',
    '["https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9"]'::jsonb,
    true
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    'Extracto Cordyceps (Cordyceps militaris)',
    'extracto-cordyceps',
    'Impulso natural de energía, resistencia física y oxigenación celular sin cafeína.',
    'Energía celular y vitalidad deportiva.',
    89000.00,
    30,
    'FNG-COR-01',
    '["https://images.unsplash.com/photo-1518531933037-91b2f5f229cc"]'::jsonb,
    true
  )
ON CONFLICT (slug) DO NOTHING;
