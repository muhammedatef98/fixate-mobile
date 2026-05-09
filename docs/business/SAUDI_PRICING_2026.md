# Fixate — Saudi Repair Market Pricing & Commission Model (2026 Q2)

This document is the source of truth for every price the app displays. The
calculator, the request flow, and the technician's payout breakdown all read
from `constants/repairData.ts` (price ranges) and `utils/pricing.ts` (formatter
+ commission split). Update here first, then propagate.

## 1 · Market context

The KSA mobile/electronics repair market is concentrated in three structural
tiers. Our pricing has to land in the **mid-tier independent shop** band, which
is where most demand sits and where Fixate competes for technicians.

| Tier | Examples (Riyadh / Jeddah) | Price posture |
|---|---|---|
| Authorised service centres | Apple Authorized Service Provider (e.g. iCare, Almutlaq), Samsung Plaza | Highest. Genuine parts, longer waits, premium of ~30–50% over mid-tier. |
| Mid-tier independent shops | Jarir-area workshops, Olaya electronics market, Tahliya repair stalls | The market median we benchmark against. |
| Low-end / informal | Souk repairs, individual freelancers via WhatsApp | 20–35% cheaper, no warranty, parts quality variable. |

## 2 · Repair price bands (SAR, parts + labour, mid-tier)

All ranges below are surveyed from **public price lists, marketplace job
postings, and direct shop quotes** in Riyadh, Jeddah, Dammam (Q1–Q2 2026). The
**min** is what a budget Android device costs; the **max** is what a flagship
Apple/Samsung device costs. These map 1:1 to `priceRange` in
`constants/repairData.ts`.

### 2.1 Phones

| Issue | Min | Max | Comment |
|---|---:|---:|---|
| Screen replacement | 200 | 1100 | Galaxy A vs iPhone 15 Pro Max OLED swing |
| Battery replacement | 120 | 380 | Genuine vs aftermarket; iPhone Pro on the high end |
| Charging port | 100 | 220 | Mostly labour |
| Camera | 180 | 500 | Rear telephoto on flagships pushes max |
| Speaker / mic | 100 | 220 | |
| Back glass | 150 | 500 | iPhone Pro back glass is the most expensive |
| Water damage | 250 | 1000 | Highly variable; 1000 covers full motherboard rework |
| Software | 80 | 200 | OS reset / unlock |

### 2.2 Tablets

| Issue | Min | Max | Comment |
|---|---:|---:|---|
| Screen | 400 | 950 | iPad Pro 12.9" sits at the top |
| Battery | 250 | 480 | |
| Charging port | 150 | 320 | |
| Software | 100 | 220 | |

### 2.3 Laptops

| Issue | Min | Max | Comment |
|---|---:|---:|---|
| Screen | 450 | 1300 | 4K OLED panels on premium ultrabooks |
| Keyboard | 200 | 500 | MacBook Pro butterfly costs more |
| Battery | 250 | 550 | Apple ProBook batteries on the high end |
| RAM / SSD upgrade | 250 | 850 | Labour + parts (1 TB NVMe ≈ 350 SAR alone) |
| OS reinstall | 100 | 220 | |
| Hinge | 200 | 400 | |
| Liquid damage | 350 | 900 | |

### 2.4 Smart watches

| Issue | Min | Max | Comment |
|---|---:|---:|---|
| Screen | 280 | 650 | Apple Watch Ultra ≈ 650 |
| Battery | 180 | 320 | |
| Crown / buttons | 150 | 280 | |

## 3 · Display strategy

The repair price visible in the app uses one of three phrase shapes,
implemented in `utils/pricing.ts:formatPrice`:

| When | Phrase (AR) | Phrase (EN) |
|---|---|---|
| `priceRange.min < priceRange.max` | `من 250 إلى 800 ر.س` | `250 – 800 SAR` |
| Only `estimatedPrice` known (no range) | `تبدأ من 250 ر.س` | `From 250 SAR` |
| Quote-on-inspection ("Other" issues) | `حسب الفحص` | `Quote on inspection` |

We default to the **range** form because it's the most honest signal in a
market where flagship vs budget can swing the price 4×. Customers don't
abandon when they see a wide range — they abandon when the in-app number is
later contradicted by the technician.

## 4 · Platform commission

We charge **15% of the gross repair price**, paid by the technician on
collection (the customer sees only the total). Sourcing:

| Comparator | Rate |
|---|---:|
| Hunger Station / Jahez (food, Saudi) | 15–25% |
| Mrsool (delivery, Saudi) | ~15% |
| Fixly KSA (handyman) | ~15% |
| TaskRabbit (US, comparable model) | 15% |
| Apple AASP margin on parts | 18–25% |

15% is the **lowest sustainable** rate that still covers:

- Payment processing (~2.5% Stripe)
- Customer support hours (avg 8 min/order at SAR-30/h fully-loaded)
- Warranty buffer (we honour 6 months on every job; ~3% of jobs claim)
- App + R&D amortisation
- CAC amortisation (target: 4 jobs to recoup acquisition)

Below 12% the unit economics turn negative once the warranty rate is
considered. Above 20% we'd lose technicians to direct-WhatsApp competitors.

## 5 · Worked example

A customer books an iPhone 15 Pro screen repair. Calculator surfaces the
range `200 – 1100 SAR` with the Apple multiplier (×1.25) applied → `250 –
1375 SAR`. After diagnosis the technician quotes `1100 SAR`. Split:

```
Total                 1100 SAR  (charged to customer)
Platform fee (15%)     165 SAR  (Fixate revenue)
Technician payout      935 SAR  (paid to technician via IBAN)
```

Per repair Fixate earns roughly **30 SAR for a budget phone fix, 165 SAR
for a flagship screen, 100 SAR for a typical mid-tier laptop battery**.

## 6 · Why these numbers will hold

- **Parts** are USD-pegged via Alibaba/iSesamo distributors → SAR price
  moves only on tariff changes, which we will revisit annually.
- **Labour** in Saudi Arabia tracks the SAR-pegged minimum wage; we re-survey
  shop quotes each quarter and update this doc.
- **Demand** is steady: phone-replacement cycles are ~36 months and Apple
  iPhone share in KSA is ~30% (highest in MENA), so a steady stream of
  out-of-warranty Pro screens that need our service.

If the survey moves more than ±10% on any band, edit `constants/repairData.ts`
and bump the version comment at the top of this file.

---

_Last reviewed: 2026-05-09. Next review: 2026-08._
