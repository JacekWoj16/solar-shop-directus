/** Editorial content for /about, /contact and /terms. */

export const pages = [
  {
    slug: 'about',
    title: 'About us',
    status: 'published',
    content: `
<p>Solaris Components is a wholesale supplier of photovoltaic equipment for
installers, resellers and businesses across Poland. We stock modules, inverters,
mounting systems, cabling and energy storage from manufacturers whose warranty
terms we are willing to stand behind.</p>

<h2>How we work</h2>
<p>We sell to trade only. Prices are quoted net, volume brackets are published
openly on every product, and there is no negotiation ritual — the price you see
at your quantity is the price you pay.</p>

<p>Orders are settled by bank transfer against a proforma invoice. We do not run
a card gateway: our customers order in pallets, and their accounting departments
prefer a transfer with a reference number.</p>

<h2>Logistics</h2>
<p>Stock is held in two warehouses. Pallet shipments of modules leave within two
to three working days of payment clearing; smaller consignments ship next day.
Collection in person can be arranged for any order.</p>

<p><em>This is a portfolio project. The company is fictional and no goods are
actually for sale.</em></p>
`.trim(),
  },
  {
    slug: 'contact',
    title: 'Contact',
    status: 'published',
    content: `
<p>Technical questions about sizing, compatibility or certification are welcome
before you order — it is cheaper for everyone than a return.</p>

<h2>Sales</h2>
<p>
  Email: <a href="mailto:orders@example.com">orders@example.com</a><br>
  Phone: +48 22 000 00 00<br>
  Monday to Friday, 08:00–16:00
</p>

<h2>Registered address</h2>
<p>
  Solaris Components Sp. z o.o.<br>
  ul. Przykładowa 12<br>
  00-001 Warszawa<br>
  NIP: 525-244-57-67
</p>

<h2>Payments</h2>
<p>All orders are settled by transfer to the account printed on the proforma
invoice. Please use the order number as the payment reference — it is what we
match incoming transfers against.</p>

<p><em>Placeholder contact details for a portfolio project.</em></p>
`.trim(),
  },
  {
    slug: 'terms',
    title: 'Terms and conditions',
    status: 'published',
    content: `
<h2>1. Scope</h2>
<p>These terms govern sales between Solaris Components Sp. z o.o. and business
customers. We do not sell to consumers, and the consumer-protection provisions
of Polish law do not apply to these transactions.</p>

<h2>2. Prices</h2>
<p>All prices are net and expressed in Polish złoty. VAT of 23% is added at
checkout. Volume brackets are published on each product; the applicable unit
price follows from the quantity ordered and is fixed at the moment the order is
placed.</p>

<h2>3. Minimum quantities</h2>
<p>Some categories carry a minimum order quantity and a quantity step —
photovoltaic modules ship on pallets and are sold in multiples accordingly. The
applicable minimum is shown on every product.</p>

<h2>4. Payment</h2>
<p>Orders are payable by bank transfer against a proforma invoice, due within
seven days of issue. Goods are reserved on receipt of the order and released for
dispatch once payment has cleared. A VAT invoice is issued after payment.</p>

<h2>5. Delivery</h2>
<p>Shipping costs depend on weight and pallet count and are confirmed on the
proforma. Risk passes to the buyer on collection by the carrier. Damage in
transit must be recorded on the carrier's delivery note.</p>

<h2>6. Warranty</h2>
<p>Manufacturer warranties apply as published by each manufacturer. We pass
warranty claims through and do not extend or shorten the terms.</p>

<p><em>Placeholder text for a portfolio project. Not legal advice and not a real
contract.</em></p>
`.trim(),
  },
];
