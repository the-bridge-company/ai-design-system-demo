---
"@bridge-ds/core": minor
---

Two reviews: the library decision (governance.owners.design, for every product) and the design review (products[].designReview, a list of reviewers per product, off per product) replace the one review that waited on the design lead. New `two-reviews.ts` (reviewsFor, waitingFor, noReviewLine, designReviewOf, migrateReviews), `askReviewsOnGitHub` and `designApproveOnGitHub`; block fields `lead*` become `design*` (old names still read), decisions carry their `hat`. `askLeadOnGitHub`, `leadApproveOnGitHub` and `isWaitingForLead` stay as deprecated aliases for 2 releases.
