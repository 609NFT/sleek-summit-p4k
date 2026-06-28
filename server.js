const express = require('express');
const path = require('path');
const Stripe = require('stripe');

const app = express();
const port = Number(process.env.PORT) || 4074;
const shirtPriceCents = 2999;
const validSizes = new Set(['S', 'M', 'L', 'XL']);

async function sendOrderNotification(eventType, order) {
  const webhookUrl = process.env.ORDER_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const authToken = process.env.ORDER_WEBHOOK_BEARER;
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify({
      eventType,
      app: 'sleek-summit-p4k',
      timestamp: new Date().toISOString(),
      order
    })
  });

  if (!response.ok) {
    throw new Error(`Notification failed: ${response.status}`);
  }

  return true;
}

app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !stripeWebhookSecret) {
    return res.status(400).send('Stripe webhook is not configured.');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).send('Missing Stripe signature.');
  }

  try {
    const stripe = Stripe(stripeSecret);
    const event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const size = String(session.metadata?.size || 'M').toUpperCase();
      const qty = Number(session.metadata?.qty || 1);
      const totalCents = Number(session.amount_total || shirtPriceCents * qty);

      await sendOrderNotification('stripe.checkout.session.completed', {
        checkoutSessionId: session.id,
        customerEmail: session.customer_details?.email || null,
        amountTotal: (totalCents / 100).toFixed(2),
        currency: session.currency || 'usd',
        size,
        qty
      });
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error?.message || error);
    return res.status(400).send('Webhook error.');
  }
});

app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/checkout', (_req, res) => {
  res.sendFile(path.join(__dirname, 'checkout.html'));
});

app.get('/checkout-success', (_req, res) => {
  res.sendFile(path.join(__dirname, 'checkout-success.html'));
});

app.get('/checkout-cancel', (_req, res) => {
  res.sendFile(path.join(__dirname, 'checkout-cancel.html'));
});

app.post('/api/checkout', async (req, res) => {
  const qty = Number(req.body?.qty);
  const size = String(req.body?.size || 'M').toUpperCase();

  if (!Number.isInteger(qty) || qty < 1 || qty > 10 || !validSizes.has(size)) {
    return res.status(400).json({ error: 'Invalid checkout payload.' });
  }

  const fallbackUrl = `/checkout?size=${encodeURIComponent(size)}&qty=${encodeURIComponent(String(qty))}`;
  const paymentLink = process.env.STRIPE_PAYMENT_LINK;
  if (paymentLink) {
    return res.json({ url: paymentLink });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return res.json({ fallbackUrl });
  }

  try {
    const stripe = Stripe(stripeSecret);
    const host = req.get('host');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const origin = `${proto}://${host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${origin}/checkout-success`,
      cancel_url: `${origin}/checkout-cancel`,
      line_items: [
        {
          quantity: qty,
          price_data: {
            currency: 'usd',
            unit_amount: shirtPriceCents,
            product_data: {
              name: `Summit Tee (${size})`
            }
          }
        }
      ],
      metadata: {
        size,
        qty: String(qty)
      },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA']
      }
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error?.message || error);
    return res.json({ fallbackUrl });
  }
});

app.post('/api/manual-order', async (req, res) => {
  const qty = Number(req.body?.qty);
  const size = String(req.body?.size || 'M').toUpperCase();
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const address = String(req.body?.address || '').trim();

  if (
    !Number.isInteger(qty) ||
    qty < 1 ||
    qty > 10 ||
    !validSizes.has(size) ||
    !name ||
    !email ||
    !address
  ) {
    return res.status(400).json({ error: 'Invalid order payload.' });
  }

  const totalCents = qty * shirtPriceCents;

  try {
    await sendOrderNotification('manual.order.created', {
      source: 'manual_checkout',
      customerName: name,
      customerEmail: email,
      shippingAddress: address,
      size,
      qty,
      amountTotal: (totalCents / 100).toFixed(2),
      currency: 'usd'
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Manual order notification error:', error?.message || error);
    return res.status(500).json({ error: 'Could not submit order right now.' });
  }
});

app.listen(port, () => {
  console.log(`Store running on port ${port}`);
});
