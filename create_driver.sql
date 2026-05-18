DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- Verifica se o usuário já existe para não duplicar
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'entregador@teste.com') THEN
    UPDATE public.profiles 
    SET role = 'DRIVER', status = 'APPROVED' 
    WHERE email = 'entregador@teste.com';
    RETURN;
  END IF;

  -- 1. Cria o usuário no Supabase Auth com senha '123456' e email confirmado
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', 
    'entregador@teste.com', crypt('123456', gen_salt('bf')), now(), 
    '{"provider":"email","providers":["email"]}', '{"name":"João Entregador"}', now(), now()
  );

  -- 2. Atualiza o perfil criado automaticamente pela trigger para Entregador Aprovado
  UPDATE public.profiles 
  SET 
    role = 'DRIVER', 
    status = 'APPROVED', 
    cpf = '11122233344', 
    phone_number = '66999999999',
    vehicle_type = 'MOTO',
    license_plate = 'ABC1234',
    name = 'João Entregador'
  WHERE id = new_user_id;

END;
$$;
