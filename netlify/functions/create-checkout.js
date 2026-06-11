const templates = {
  'birthday':      { name: 'Birthday Card Experience', price: 1200 },
  'proposal':      { name: 'Proposal Card Experience', price: 1500 },
  'anniversary':   { name: 'Anniversary Card Experience', price: 1400 },
  'valentines':    { name: "Valentine's Day Card Experience", price: 1200 },
  'mothers-day':   { name: "Mother's Day Card Experience", price: 1000 },
  'fathers-day':   { name: "Father's Day Card Experience", price: 1000 },
  'bestfriend':    { name: 'Best Friend Card Experience', price: 1000 },
  'graduation':    { name: 'Graduation Card Experience', price: 1200 },
  'baby':          { name: 'Baby Announcement Experience', price: 1200 },
  'apology':       { name: 'Apology Card Experience', price: 1000 },
  'long-distance': { name: 'Long Distance Card Experience', price: 1200 },
  'wedding':       { name: 'Wedding Congrats Experience', price: 1200 },
  'keep-forever':  { name: 'Keep Card Forever (Extend)', price: 500 }
};

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  try {
    const { template, cardId } = JSON.parse(event.body);

    // Look up template
    const tmpl = templates[template];
    if (!tmpl) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown template' }) };
    }

    // Build success URL
    const siteUrl = process.env.URL || 'https://eclectic-kangaroo-adac15.netlify.app';
    let successUrl;

    if (template === 'keep-forever' && cardId) {
      successUrl = `${siteUrl}/?card=${cardId}&extend={CHECKOUT_SESSION_ID}`;
    } else {
      successUrl = `${siteUrl}/?create=${template}&session={CHECKOUT_SESSION_ID}`;
    }

    const cancelUrl = `${siteUrl}/#templates`;

    // Create Stripe Checkout Session via REST API
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', tmpl.name);
    params.append('line_items[0][price_data][unit_amount]', tmpl.price.toString());
    params.append('line_items[0][quantity]', '1');
    params.append('metadata[template]', template);
    if (cardId) {
      params.append('metadata[card_id]', cardId);
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const session = await response.json();

    if (!response.ok) {
      console.error('Stripe error:', session);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create checkout' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error('Checkout error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
