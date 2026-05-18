import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`Function "create-pagseguro-payment" [SECURE BACKEND SPLIT] up!`);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const PAGSEGURO_TOKEN = Deno.env.get('PAGSEGURO_SANDBOX_TOKEN');
    const PAGSEGURO_API_URL = 'https://sandbox.api.pagseguro.com/orders';
    const PLATFORM_RECIPIENT_ID = Deno.env.get('PAGSEGURO_PLATFORM_RECIPIENT_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!PAGSEGURO_TOKEN) throw new Error('PAGSEGURO_SANDBOX_TOKEN não configurado');
    if (!PLATFORM_RECIPIENT_ID) throw new Error('PAGSEGURO_PLATFORM_RECIPIENT_ID não configurado');

    // Cliente Supabase com chave de serviço (acesso total ao banco — NUNCA exposta no frontend)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { restaurantId, couponCode, paymentType, items, customer, card, saveCard } = await req.json();

    // ═══════════════════════════════════════════════════════════════
    // 1. BUSCAR RESTAURANTE NO BANCO — não confiar em dados do frontend
    // ═══════════════════════════════════════════════════════════════
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, pagseguro_recipient_id, owner_id, delivery_fee, menu')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurante não encontrado');
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. RECALCULAR PREÇOS NO BACKEND — validar contra o banco de dados
    // Um cliente malicioso pode tentar enviar preços alterados no frontend
    // Aqui buscamos os preços reais do banco e ignoramos os do frontend
    // ═══════════════════════════════════════════════════════════════
    let cartSubtotal = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      // Busca o produto real no menu do restaurante
      const realProduct = restaurant.menu?.find((p: any) => p.id === item.productId);
      if (!realProduct) {
        throw new Error(`Produto "${item.name}" não encontrado no cardápio`);
      }
      const realPrice = Math.round(realProduct.price * 100); // em centavos
      cartSubtotal += realPrice * item.quantity;
      validatedItems.push({
        name: realProduct.name,
        quantity: item.quantity,
        unit_amount: realPrice,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. APLICAR CUPOM — validar no banco, não confiar no frontend
    // ═══════════════════════════════════════════════════════════════
    let discount = 0;
    if (couponCode) {
      const now = Date.now();
      const { data: coupon } = await supabase
        .from('promotions')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .lte('valid_from', now)
        .gte('valid_until', now)
        .single();

      if (coupon) {
        if (coupon.discount_type === 'PERCENT') {
          discount = Math.round(cartSubtotal * (coupon.discount_value / 100));
        } else if (coupon.discount_type === 'FIXED') {
          discount = Math.round(coupon.discount_value * 100);
        } else if (coupon.type === 'FREE_DELIVERY') {
          discount = 0; // tratado separado
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. CALCULAR FRETE — usando taxa configurada no banco
    // ═══════════════════════════════════════════════════════════════
    const deliveryFeeCents = Math.round((restaurant.delivery_fee ?? 4.00) * 100);

    // ═══════════════════════════════════════════════════════════════
    // 5. CALCULAR SPLIT — buscar taxas do lojista no banco
    // Este cálculo NUNCA é enviado pelo frontend
    // ═══════════════════════════════════════════════════════════════
    const { data: platformSettings } = await supabase
      .from('platform_settings')
      .select('restaurant_fee_pct')
      .limit(1)
      .single();

    let restaurantFeePct = platformSettings?.restaurant_fee_pct ?? 0.08;

    // Verifica se o lojista tem taxa personalizada
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('custom_fee_pct')
      .eq('id', restaurant.owner_id)
      .single();

    if (ownerProfile?.custom_fee_pct !== null && ownerProfile?.custom_fee_pct !== undefined) {
      restaurantFeePct = ownerProfile.custom_fee_pct / 100;
    }

    const finalProductTotal = Math.max(0, cartSubtotal - discount);
    const totalChargeCents = finalProductTotal + deliveryFeeCents;
    const restaurantNetCents = Math.round(finalProductTotal * (1 - restaurantFeePct));
    const platformCutCents = totalChargeCents - restaurantNetCents;

    console.log(`Split calculado no backend:
      Subtotal: R$${cartSubtotal / 100}
      Desconto: R$${discount / 100}
      Entrega:  R$${deliveryFeeCents / 100}
      Total:    R$${totalChargeCents / 100}
      Lojista:  R$${restaurantNetCents / 100} (taxa: ${(restaurantFeePct * 100).toFixed(1)}%)
      Plataforma: R$${platformCutCents / 100}
    `);

    // ═══════════════════════════════════════════════════════════════
    // 6. MONTAR PAYLOAD FINAL PARA O PAGSEGURO
    // ═══════════════════════════════════════════════════════════════
    const orderPayload = {
      customer,
      items: validatedItems,
      charges: [{
        reference_id: `order_${Date.now()}`,
        amount: { value: totalChargeCents, currency: 'BRL' },
        payment_method: {
          type: paymentType,
          installments: 1,
          capture: true,
          card: card.savedTokenId
            ? { id: card.savedTokenId, security_code: card.security_code }
            : { encrypted: card.encrypted, store: saveCard ?? false },
        },
        // Split calculado com segurança no backend
        split: {
          rules: [
            {
              recipient: restaurant.pagseguro_recipient_id,
              liable: true,
              charge_processing_fee: true,
              amount: { value: restaurantNetCents },
            },
            {
              recipient: PLATFORM_RECIPIENT_ID,
              liable: false,
              charge_processing_fee: false,
              amount: { value: platformCutCents },
            },
          ],
        },
      }],
      notification_urls: [],
    };

    // ═══════════════════════════════════════════════════════════════
    // 7. ENVIAR PARA O PAGSEGURO
    // ═══════════════════════════════════════════════════════════════
    const response = await fetch(PAGSEGURO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAGSEGURO_TOKEN}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro PagSeguro:', JSON.stringify(data));
      return new Response(JSON.stringify({
        error: data?.error_messages?.[0]?.description || 'Erro no processamento do pagamento',
        details: data,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    // Retorna apenas o necessário para o frontend
    return new Response(JSON.stringify({
      id: data.id,
      status: data.charges?.[0]?.status,
      charges: data.charges,
      // Inclui valores calculados para o app registrar o pedido corretamente
      _meta: {
        cartSubtotalCents: cartSubtotal,
        discountCents: discount,
        deliveryFeeCents,
        totalCents: totalChargeCents,
        restaurantNetCents,
        platformCutCents,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
