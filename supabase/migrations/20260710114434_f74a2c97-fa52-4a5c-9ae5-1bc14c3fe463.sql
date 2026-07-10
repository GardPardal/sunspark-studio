UPDATE auth.users
SET encrypted_password = crypt('Lz7@2026Reset!', gen_salt('bf')),
    updated_at = now()
WHERE email = 'alisonlz7@icloud.com';