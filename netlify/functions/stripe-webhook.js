exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const payload = JSON.parse(event.body);

    // Only process completed checkout sessions
    if (payload.type !== 'checkout.session.completed') {
      return { statusCode: 200, body: 'Ignored' };
    }

    const session = payload.data.object;
    const sessionId = session.id;
    const customerEmail = session.customer_details?.email || null;
    const amount = session.amount_total || 0;
    const template = session.metadata?.template || 'birthday';
    const cardId = session.metadata?.card_id || null;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    // If this is a "keep forever" payment, extend the card expiry
    if (template === 'keep-forever' && cardId) {
      // Extend expiry to 10 years
      const extendResponse = await fetch(`${supabaseUrl}/rest/v1/cards?id=eq.${cardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          expires_at: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
        })
      });

      if (!extendResponse.ok) {
        console.error('Failed to extend card:', await extendResponse.text());
      }
    }

    // Record the payment
    const response = await fetch(`${supabaseUrl}/rest/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        stripe_session_id: sessionId,
        template_type: template,
        customer_email: customerEmail,
        amount: amount,
        status: 'completed',
        used: false
      })
    });

    if (!response.ok) {
      console.error('Supabase error:', await response.text());
      return { statusCode: 500, body: 'Failed to save payment' };
    }

    return { statusCode: 200, body: 'Payment recorded' };

  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 400, body: 'Failed' };
  }
};
