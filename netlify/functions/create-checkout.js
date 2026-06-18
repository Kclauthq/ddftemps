const https = require('https');

const templates = {
  'birthday':      { name: 'Birthday Card Experience', price: 1200 },
  'proposal':      { name: 'Ask Them Out Experience', price: 1200 },
  'anniversary':   { name: 'Anniversary Card Experience', price: 1400 },
  'valentines':    { name: "Valentines Day Card Experience", price: 1200 },
  'mothers-day':   { name: "Mothers Day Card Experience", price: 1000 },
  'fathers-day':   { name: "Fathers Day Card Experience", price: 1000 },
  'bestfriend':    { name: 'Best Friend Card Experience', price: 1000 },
  'graduation':    { name: 'Graduation Card Experience', price: 1200 },
  'baby':          { name: 'Baby Announcement Experience', price: 1200 },
  'apology':       { name: 'Apology Card Experience', price: 1000 },
  'long-distance': { name: 'Long Distance Card Experience', price: 1200 },
  'wedding':       { name: 'Wedding Congrats Experience', price: 1200 },
  'keep-forever':  { name: 'Keep Card Forever', price: 500 }
};

function stripeRequest(body, stripeKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stripe.com',
      path: '/v1/checkout/sessions',
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(stripeKey + ':').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data }); }
      });
    });

    req.on('error', (err) => { reject(err); });
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
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
    console.log('Checkout request for template:', template);

    const tmpl = templates[template];
    if (!tmpl) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown template' }) };
    }

    const siteUrl = process.env.URL || 'https://eclectic-kangaroo-adac15.netlify.app';
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      console.error('Missing STRIPE_SECRET_KEY');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error' }) };
    }

    let successUrl;
    if (template === 'keep-forever' && cardId) {
      successUrl = siteUrl + '/?card=' + cardId + '&extend={CHECKOUT_SESSION_ID}';
    } else {
      successUrl = siteUrl + '/?create=' + template + '&session={CHECKOUT_SESSION_ID}';
    }
    const cancelUrl = siteUrl + '/#templates';

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

    const result = await stripeRequest(params.toString(), stripeKey);
    console.log('Stripe response status:', result.status);

    if (result.status >= 400) {
      console.error('Stripe error:', JSON.stringify(result.data));
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Checkout creation failed' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: result.data.url })
    };

  } catch (err) {
    console.error('Checkout error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
