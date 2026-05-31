-- 1. Criar o bucket 'avatars'
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- 2. Política de leitura pública (todos podem ver as fotos)
CREATE POLICY "Avatar público para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 3. Política de upload (apenas usuários autenticados podem enviar)
CREATE POLICY "Usuários autenticados podem fazer upload de avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 4. Política de update (apenas dono pode alterar)
CREATE POLICY "Dono pode atualizar seu avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Adicionar coluna avatar_url na tabela profiles (se não existir)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
