const express = require('express');
const path = require('path');
const Stripe = require('stripe');

const app = express();
const port = Number(process.env.PORT) || 4074;
const shirtPriceCents = 2999;
const validSizes = new Set(['S', 'M', 'L', 'XL']);

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
        size
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

app.listen(port, () => {
  console.log(`Store running on port ${port}`);
});
