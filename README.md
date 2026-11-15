# 生活选物 · Shopping need demo

Research interface preview; no checkout or payment.

Catalog metadata: [Amazon Reviews 2023, McAuley Lab](https://amazon-reviews-2023.github.io/). Images follow the corresponding source product records. USD prices are original crawl-time listings, not live offers. Chinese text is machine-translated with Qwen3-8B and Qwen3.5-9B; originals are retained. The storefront displays only CNY reference prices. Original price/currency stay USD; price_conversion and data/price-mapping.csv + .json preserve every mapping, decimal ROUND_HALF_UP to 0.01, at USD/CNY 6.6751 (2026-11-06), from Exchange Rates UK, not China retail offers.

No missing prices, reviews or product features are fabricated. Unconnected self-browsing stays local. Connected participants share a private server identity across self-browsing and Agent runs; both use the same event schema and durable retry queue. Agent dialogue and source assignment are isolated from platform features. Personal recovery codes are private credentials. No server credentials, questionnaire responses, GPU jobs or private research model documents are included in this repository.


## Product sorting (2026-11-15, v2)

The default is 综合排序. After scene/category and query filtering, rank by title/brand query match, then `(rating_count * rating + 20 * 4) / (rating_count + 20)`. Missing ratings rank last; ties use rating count and stable product ID. This dampens single-review five-star products. The 4-star prior and weight 20 are pilot parameters, not Amazon's formula. Other rating, count, price, attribute and title sorts remain available. All results are sorted before pagination. `catalog-featured-v2` is recorded with exposures and sort changes.

Amazon describes customer-fit ranking using behavior, price, delivery, novelty and satisfaction. We borrow the combined-ranking idea; we do not have its proprietary formula, sales, delivery or return data:
https://www.aboutamazon.com/news/how-amazon-works/how-customers-get-to-pick-the-winners-in-amazons-store

## Two-round study (shopping-crossover-v4)

History has two alternatives: screenshots of at least five recent purchases, or manual item names with optional brand/model, newest first. The satisfaction question is removed. Screenshot drafts are kept in IndexedDB and uploaded privately after authentication. Images have NOT been OCR-extracted; their item count is requested, not machine-verified. Pending screenshots cannot yet be treated as structured RS_Agent model inputs. Manual entries remain unmatched self-report.

The server allocates human→Agent or Agent→human once for each participant and stores two linked round records. Both rounds use the same stated need. Only a persisted final choice/no-selection can complete a round; retries do not advance twice. Source assignments and dialogue remain separate from platform model features. Legacy unbound sessions are not silently counted as new rounds. The Agent round's final confirmation remains a human action.

The list exit moved into the cart. Repeated transaction/storage caveats were removed from choice/outcome dialogs; the entry page still identifies simulated shopping. HTML break tags in review text become line breaks without executing HTML.

Human and Browser Use now share the same 20,000-item immutable catalog (5,000 per scene), ordering, details, prices, and server-side item validation. Both use `/api/catalog`; the original `/api/human-catalog` endpoints remain for cached clients. The legacy `human-expansion-<hash>` session version is deliberately preserved to avoid breaking ongoing human sessions; it now identifies the shared snapshot. Before a formal source-comparison study, account for learning/carryover between repeated tasks. Final selections are still stored separately from verified purchases.
