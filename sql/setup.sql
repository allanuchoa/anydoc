-- ============================================================================
-- Onboarding da ferramenta `anydoc` — Registry Supabase (idempotente)
-- ============================================================================
-- ONDE RODAR
--   Supabase SQL Editor (Dashboard). Roda como `service_role`, que bypassa RLS.
--   Pode reexecutar à vontade: `ON CONFLICT` evita duplicatas e erros.
--
-- ANTES DE RODAR
--   1. Descubra o UUID do usuário que terá acesso:
--        SELECT id, email FROM auth.users WHERE email = 'seu@email.com';
--   2. Substitua <uuid-do-usuario> abaixo (repita a linha para mais usuários).
--
-- CONTRATO RLS DO REGISTRY
--   Este script APENAS faz INSERT em `applications` e `user_applications`.
--   Nunca crie ou recrie policies nessas tabelas: policies que referenciam as
--   próprias tabelas do registry causam recursão infinita (erro 42P17) e
--   quebram o portal.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Bloco 1: registro da ferramenta (cobre todas as colunas NOT NULL)
-- ---------------------------------------------------------------------------
INSERT INTO public.applications (slug, name, url, icon, category, is_active, status)
VALUES (
  'anydoc',
  'Conversor de Documentos',
  'https://allanuchoa.github.io/anydoc/',
  'file-text',
  'Utilidades',
  true,
  'active'
)
ON CONFLICT (slug) DO UPDATE SET
  name      = EXCLUDED.name,
  url       = EXCLUDED.url,
  icon      = EXCLUDED.icon,
  category  = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  status    = EXCLUDED.status;

-- ---------------------------------------------------------------------------
-- Bloco 2: acesso dos usuários (repita a linha para cada usuário)
-- ---------------------------------------------------------------------------
INSERT INTO public.user_applications (user_id, application_id)
VALUES
  ('<uuid-do-usuario>', (SELECT id FROM public.applications WHERE slug = 'anydoc'))
ON CONFLICT (user_id, application_id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO (opcional — descomente para conferir)
-- ---------------------------------------------------------------------------
-- SELECT slug, name, url, icon, category, is_active, status
-- FROM   public.applications
-- WHERE  slug = 'anydoc';

-- SELECT ua.user_id, p.email, app.slug
-- FROM   public.user_applications ua
-- JOIN   public.applications app ON app.id = ua.application_id
-- JOIN   public.profiles        p   ON p.id   = ua.user_id
-- WHERE  app.slug = 'anydoc';
