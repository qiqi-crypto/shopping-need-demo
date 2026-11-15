# 生活选物 · Shopping need demo

Research interface preview; no checkout or payment.

Catalog metadata: [Amazon Reviews 2023, McAuley Lab](https://amazon-reviews-2023.github.io/). Images follow the corresponding source product records. USD prices are original crawl-time listings, not live offers. Chinese text is machine-translated with Qwen3-8B and Qwen3.5-9B; originals are retained. The storefront displays only CNY reference prices. Original price/currency stay USD; price_conversion and data/price-mapping.csv + .json preserve every mapping, decimal ROUND_HALF_UP to 0.01, at USD/CNY 6.6751 (2026-11-06), from Exchange Rates UK, not China retail offers.

No missing prices, reviews or product features are fabricated. Unconnected self-browsing stays local. Connected participants share a private server identity across self-browsing and Agent runs; both use the same event schema and durable retry queue. Agent dialogue and source assignment are isolated from platform features. Personal recovery codes are private credentials. No server credentials, questionnaire responses, GPU jobs or private research model documents are included in this repository.


## Product sorting (2026-11-15)

`catalog-sort.js` sorts all matching products before pagination, for both storefront renderers. Default keeps the supplied catalog order (embedded products first, then the scene expansion); it is not personalized ranking. Rating ascending/descending uses source `rating`, breaking ties by `rating_count` descending, with unrated products last. Rating-count sorting uses the source number of ratings, not the number of translated review bodies, sales, or distinct buyers. Equal keys preserve input order. Existing price, attribute-count, and title sorts remain available.

Sort changes and result exposures include `sort_version`; result snapshots preserve rating values shown to the participant. The UI revision is `storefront-20261115-sorting-v1`.
