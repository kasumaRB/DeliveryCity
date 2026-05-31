/**
 * Edge Function: send-push-notification
 *
 * Envia notificação push via FCM v1 para um usuário ou token específico.
 * Chamada pelo store.tsx após cada mudança de status importante.
 *
 * Body aceito:
 *   { userId: string, title: string, body: string, data?: Record<string, string> }
 *   { token:  string, title: string, body: string, data?: Record<string, string> }
 *
 * Autenticação: requer Authorization header com JWT do Supabase (usuário logado).
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendFCMNotification, sendPushToUser, sendPushToAllDrivers } from '../_shared/pushNotification.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { userId, token, notifyDrivers, title, body, data } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title e body são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (token) {
      // Token FCM direto
      await sendFCMNotification(token, { title, body, data });
    } else if (userId) {
      // Busca o token pelo userId
      await sendPushToUser(supabase, userId, { title, body, data });
    } else if (notifyDrivers) {
      // Notifica todos os entregadores aprovados
      await sendPushToAllDrivers(supabase, { title, body, data });
    } else {
      return new Response(JSON.stringify({ error: 'Informe userId, token ou notifyDrivers:true' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[send-push-notification]', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
