/**
 * GEO (Geographic / Local SEO) Checks
 * 25 checks across 2 subcategories for local business optimization
 */

import * as cheerio from 'cheerio';
import { CheckResult, FetchResult, ParsedPage } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function make(
  checkId: string,
  name: string,
  status: 'pass' | 'fail' | 'warning' | 'na',
  severity: 'high' | 'medium' | 'low',
  currentValue: string | number | boolean | null,
  recommendedValue: string | number | boolean | null,
  explanation: string,
  impactScore: number,
  effortScore: number,
  affectedElements: string[] = []
): CheckResult {
  return {
    checkId,
    name,
    category: 'geo-local-seo',
    severity,
    status: status === 'na' ? 'pass' : status,  // treat N/A as pass (not applicable = no penalty)
    currentValue: status === 'na' ? 'N/A — Not applicable' : currentValue,
    recommendedValue,
    affectedElements,
    explanation,
    impactScore,
    effortScore,
  };
}

/** Detect if a site has local business indicators */
function detectLocalBusiness(html: string, bodyText: string): boolean {
  const localSignals = [
    /\b(store|shop|showroom|office|clinic|salon|restaurant|café|gym|warehouse)\b/i,
    /\b(visit us|walk in|in.store|pickup|open hours|opening hours|we are (open|located))\b/i,
    /\b(directions?|get directions|find us|our location)\b/i,
    /LocalBusiness|localBusiness|"@type"\s*:\s*"(Store|Restaurant|Hotel|Hospital|Dentist|Lawyer)/,
    /\b(near me|in [A-Z][a-z]+(,\s*[A-Z]{2})?|city|downtown|neighborhood)\b/i,
  ];
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray()
    .map((el) => $(el).html() || '').join('');

  const signalCount = localSignals.filter((p) => p.test(bodyText) || p.test(schemas)).length;
  return signalCount >= 2;
}

// ─── N/A wrapper — returns N/A result ─────────────────────────────────────────

function naResult(checkId: string, name: string): CheckResult {
  return make(checkId, name, 'na', 'low', 'N/A — No physical locations detected', 'Not applicable',
    'Not applicable — no local business signals detected. This check is for businesses with physical locations.', 0, 0);
}

// ─── Subcategory 1: Google Business Profile (15 checks) ──────────────────────

function checkLocalBusinessSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '');
  const localTypes = ['LocalBusiness', 'Store', 'Restaurant', 'Hotel', 'Hospital', 'Dentist',
    'LegalService', 'AccountingService', 'AutomotiveBusiness', 'ChildCare'];
  const found = schemas.find((s) => localTypes.some((t) => s.includes(t)));

  if (found) {
    const type = localTypes.find((t) => found.includes(t)) || 'LocalBusiness';
    return make('geo-local-schema', 'LocalBusiness Schema Markup', 'pass', 'high', `${type} schema`, 'LocalBusiness schema',
      `${type} schema detected. Essential for Google Local Pack rankings and AI local search answers.`, 9, 3);
  }
  return make('geo-local-schema', 'LocalBusiness Schema Markup', 'fail', 'high', false, 'Add LocalBusiness JSON-LD schema',
    'No LocalBusiness schema. This is the #1 local SEO signal — without it, you won\'t appear in local AI answers.', 9, 3);
}

function checkNAPConsistency(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');

  const hasNameInSchema = schemas.includes('"name"');
  const hasAddressInSchema = schemas.includes('"address"') || schemas.includes('"streetAddress"');
  const hasPhoneInSchema = schemas.includes('"telephone"');
  const hasPhoneInBody = /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/.test(bodyText);
  const hasAddressInBody = /\d+\s+\w+\s+(street|st|avenue|ave|road|rd|blvd|drive|dr|lane|ln)\b/i.test(bodyText);

  const schemaSignals = [hasNameInSchema, hasAddressInSchema, hasPhoneInSchema].filter(Boolean).length;
  const bodySignals = [hasPhoneInBody, hasAddressInBody].filter(Boolean).length;

  if (schemaSignals >= 3 && bodySignals >= 1) {
    return make('geo-nap', 'NAP Consistency (Name/Address/Phone)', 'pass', 'high', 'NAP in schema + body', 'NAP in schema + body',
      'Name, Address, and Phone in both schema and body content. Consistent NAP is the foundation of local SEO.', 9, 4);
  }
  if (schemaSignals >= 1 || bodySignals >= 1) {
    return make('geo-nap', 'NAP Consistency (Name/Address/Phone)', 'warning', 'high',
      `${schemaSignals} schema, ${bodySignals} body signals`, 'Full NAP in schema + visible on page',
      'Partial NAP information. Ensure Name, Address, and Phone are in schema AND visible on the page.', 9, 4);
  }
  return make('geo-nap', 'NAP Consistency (Name/Address/Phone)', 'fail', 'high', false, 'Add full NAP to schema and page',
    'No NAP information detected. Name, Address, and Phone consistency is the core local SEO ranking factor.', 9, 4);
}

function checkBusinessHoursSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasHours = schemas.includes('"openingHours"') || schemas.includes('"openingHoursSpecification"');
  const bodyText = $('body').text();
  const hasHoursInBody = /\b(mon|tue|wed|thu|fri|sat|sun|monday|hours?|open|closed)\b/i.test(bodyText) &&
    /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i.test(bodyText);

  if (hasHours) {
    return make('geo-hours-schema', 'Business Hours in Schema', 'pass', 'high', 'openingHours in schema', 'Business hours schema',
      'Business hours in schema detected. Enables "Is it open now?" answers in Google and AI engines.', 8, 3);
  }
  if (hasHoursInBody) {
    return make('geo-hours-schema', 'Business Hours in Schema', 'warning', 'high', 'Hours in body, no schema', 'Add openingHours to LocalBusiness schema',
      'Hours visible but not in schema. Add openingHoursSpecification for Google rich results.', 8, 3);
  }
  return make('geo-hours-schema', 'Business Hours in Schema', 'fail', 'high', false, 'Add openingHours to LocalBusiness schema',
    'No business hours found. Hours in schema are required for "open now" local search results.', 8, 3);
}

function checkAddressSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasPostalAddress = schemas.includes('PostalAddress') || schemas.includes('"streetAddress"');
  if (hasPostalAddress) {
    return make('geo-address-schema', 'Structured Address (PostalAddress)', 'pass', 'high', 'PostalAddress schema', 'PostalAddress schema',
      'PostalAddress schema detected. Machine-readable addresses enable map integrations and local results.', 8, 3);
  }
  return make('geo-address-schema', 'Structured Address (PostalAddress)', 'fail', 'high', false, 'Add PostalAddress to LocalBusiness schema',
    'No PostalAddress schema. Structured address is required for Google Maps rich results.', 8, 3);
}

function checkPhoneSchema(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasPhoneSchema = schemas.includes('"telephone"');
  const hasClickToCall = $('a[href^="tel:"]').length > 0;
  const hasPhoneInBody = /\b(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/.test(bodyText);

  if (hasPhoneSchema && hasClickToCall) {
    return make('geo-phone-schema', 'Click-to-Call Phone Number', 'pass', 'high', 'Schema + tel: link', 'Schema + click-to-call',
      'Phone in schema + click-to-call link. Mobile users can call directly — critical for local conversions.', 8, 2);
  }
  if (hasPhoneInBody || hasPhoneSchema) {
    return make('geo-phone-schema', 'Click-to-Call Phone Number', 'warning', 'high', 'Phone present, no click-to-call', 'Add tel: href + telephone schema',
      'Phone number found but missing click-to-call (tel:) link or schema. Both are needed for mobile optimization.', 8, 2);
  }
  return make('geo-phone-schema', 'Click-to-Call Phone Number', 'fail', 'high', false, 'Add tel: link + telephone in schema',
    'No phone number. Local businesses without a visible, clickable phone number lose 40%+ of mobile leads.', 8, 2);
}

function checkGoogleMapsEmbed(html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasMapEmbed = $('iframe[src*="google.com/maps"], iframe[src*="maps.google"]').length > 0;
  const hasMapLink = $('a[href*="google.com/maps"], a[href*="maps.google"]').length > 0;

  if (hasMapEmbed) {
    return make('geo-maps-embed', 'Google Maps Embed', 'pass', 'medium', 'Maps iframe embedded', 'Google Maps embed',
      'Google Maps embed detected. Maps increase local trust and reduce "how do I get there" friction.', 7, 2);
  }
  if (hasMapLink) {
    return make('geo-maps-embed', 'Google Maps Embed', 'warning', 'medium', 'Maps link present, no embed', 'Embed Google Maps iframe',
      'Link to Google Maps found but no embed. An embedded map is more trustworthy and user-friendly.', 7, 2);
  }
  return make('geo-maps-embed', 'Google Maps Embed', 'fail', 'medium', false, 'Embed Google Maps on contact/location page',
    'No Google Maps embed. Maps dramatically improve local credibility and reduce bounce from location queries.', 7, 2);
}

function checkLocationKeywords(bodyText: string, title: string | null): CheckResult {
  const cityPattern = /\b[A-Z][a-z]+(?:,\s*[A-Z]{2})?\b/;
  const locationPhrases = [/\b(in|at|near|serving|located in|based in)\s+[A-Z][a-z]+/,
    /\b[A-Z][a-z]+\s+(area|region|city|county|district|neighborhood)\b/i];
  const hasCity = cityPattern.test(bodyText) && !/(^|\s)[A-Z]{2,}(\s|$)/.test(bodyText);
  const hasPhrase = locationPhrases.some((p) => p.test(bodyText));
  const hasCityInTitle = title ? cityPattern.test(title) : false;

  if (hasCityInTitle && hasPhrase) {
    return make('geo-location-keywords', 'Location Keywords in Content', 'pass', 'high', true, true,
      'Location keywords in title + body. Location-specific content is the #1 local ranking factor.', 9, 3);
  }
  if (hasCity || hasPhrase) {
    return make('geo-location-keywords', 'Location Keywords in Content', 'warning', 'high', 'Location terms in body only', 'Add city name to title + H1',
      'Location references in body but not title/H1. Add city/region to the page title for local ranking.', 9, 3);
  }
  return make('geo-location-keywords', 'Location Keywords in Content', 'fail', 'high', false, 'Add city/region keywords to title, H1, and body',
    'No location keywords. Without location-specific content, you won\'t rank for "near me" or city-based queries.', 9, 3);
}

function checkLocalContactPage(html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasContactLink = $('a[href*="contact"], a[href*="location"]').length > 0;
  const contactText = $('a').toArray().some((el) => /contact|find us|get directions|location/i.test($(el).text()));
  if (hasContactLink && contactText) {
    return make('geo-contact-page', 'Local Contact/Location Page', 'pass', 'medium', true, true,
      'Contact/location page linked. A dedicated location page is essential for multi-location businesses.', 7, 3);
  }
  if (hasContactLink || contactText) {
    return make('geo-contact-page', 'Local Contact/Location Page', 'warning', 'medium', 'Partial contact signals', 'Create a dedicated Contact/Locations page',
      'Some contact page signals. Create a clear Contact Us page with full address, hours, and map.', 7, 3);
  }
  return make('geo-contact-page', 'Local Contact/Location Page', 'fail', 'medium', false, 'Add a Contact/Location page',
    'No contact or location page linked. A Contact Us page with full NAP is mandatory for local SEO.', 7, 3);
}

function checkServiceArea(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasServiceArea = schemas.includes('"areaServed"') || schemas.includes('ServiceArea') || schemas.includes('"hasMap"');
  const hasServiceAreaText = /\b(service area|we serve|serving .+ and surrounding|available in)\b/i.test(bodyText);

  if (hasServiceArea && hasServiceAreaText) {
    return make('geo-service-area', 'Service Area Definition', 'pass', 'medium', 'Schema + body content', 'Schema + content',
      'Service area defined in schema and content. Essential for businesses serving multiple areas.', 7, 3);
  }
  if (hasServiceArea || hasServiceAreaText) {
    return make('geo-service-area', 'Service Area Definition', 'warning', 'medium', 'Partial service area signals', 'Add areaServed to LocalBusiness schema',
      'Service area partially defined. Add areaServed to schema + service area page/content.', 7, 3);
  }
  return make('geo-service-area', 'Service Area Definition', 'fail', 'low', false, 'Define service area in schema + content',
    'No service area defined. Helps Google understand your coverage area for local results.', 7, 3);
}

function checkBusinessCategory(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasType = schemas.includes('"@type"');
  const localTypes = ['LocalBusiness', 'MedicalOrganization', 'AutomotiveBusiness', 'FoodEstablishment',
    'LegalService', 'HealthAndBeautyBusiness', 'HomeAndConstructionBusiness', 'SportsOrganization'];
  const hasSpecificType = localTypes.some((t) => schemas.includes(t));

  if (hasSpecificType) {
    const found = localTypes.find((t) => schemas.includes(t));
    return make('geo-business-category', 'Business Category Classification', 'pass', 'medium', found || 'Specific business type', 'Specific Schema.org type',
      `Specific business type (${found}) detected. Specific categories get higher priority in category-based searches.`, 6, 2);
  }
  if (hasType) {
    return make('geo-business-category', 'Business Category Classification', 'warning', 'medium', 'Generic @type only', 'Use specific LocalBusiness subtype',
      'Generic schema type used. Use a specific subtype (e.g., MedicalOrganization instead of LocalBusiness).', 6, 2);
  }
  return make('geo-business-category', 'Business Category Classification', 'fail', 'medium', false, 'Add specific LocalBusiness @type',
    'No business category. Schema @type classification is essential for appearing in category-specific local searches.', 6, 2);
}

function checkBusinessDescription(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const descMatch = schemas.match(/"description"\s*:\s*"([^"]{50,})"/);

  if (descMatch) {
    const descLen = descMatch[1].length;
    const status = descLen >= 150 ? 'pass' : 'warning';
    return make('geo-description', 'Business Description Quality', status, 'medium',
      `${descLen} char description`, '150+ char description',
      status === 'pass'
        ? `Good business description (${descLen} chars) in schema.`
        : `Description found (${descLen} chars) — expand to 150+ characters.`, 6, 3);
  }
  return make('geo-description', 'Business Description Quality', 'fail', 'medium', false, 'Add 150+ char description to LocalBusiness schema',
    'No business description in schema. A compelling description improves click-through from local pack results.', 6, 3);
}

function checkReviewVisibility(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasRating = schemas.includes('"ratingValue"') || schemas.includes('"aggregateRating"'.toLowerCase());
  const hasGoogleReviews = /google reviews?|g2\.com|trustpilot/i.test(bodyText);
  const hasStars = $('[class*="star"], [class*="rating"]').length > 0;

  if (hasRating && (hasGoogleReviews || hasStars)) {
    return make('geo-review-visibility', 'Local Review Visibility', 'pass', 'high', true, true,
      'Review ratings with visual display detected. Local reviews are the #2 ranking factor for Google local pack.', 8, 4);
  }
  if (hasRating || hasGoogleReviews || hasStars) {
    return make('geo-review-visibility', 'Local Review Visibility', 'warning', 'high', 'Partial review signals', 'Add schema + visible star ratings',
      'Some review signals. Show star ratings from Google/Trustpilot with schema markup.', 8, 4);
  }
  return make('geo-review-visibility', 'Local Review Visibility', 'fail', 'high', false, 'Embed Google reviews + add AggregateRating schema',
    'No local reviews visible. 88% of consumers trust online reviews as much as personal recommendations.', 8, 4);
}

function checkBookingIntegration(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const hasBooking = $('a[href*="book"], a[href*="appointment"], a[href*="schedule"], a[href*="calendly"], a[href*="acuity"]').length > 0;
  const hasBookingText = /\b(book now|schedule|make an appointment|reserve|book a|get a quote)\b/i.test(bodyText);
  const hasSchemaPotentialAction = $('script[type="application/ld+json"]').toArray()
    .map((el) => $(el).html() || '').some((s) => s.includes('potentialAction') || s.includes('OrderAction') || s.includes('ReserveAction'));

  if (hasBooking && (hasBookingText || hasSchemaPotentialAction)) {
    return make('geo-booking', 'Booking / Appointment Integration', 'pass', 'high', true, true,
      'Booking system detected. Online booking reduces friction and is a Google local pack ranking signal.', 8, 5);
  }
  if (hasBooking || hasBookingText) {
    return make('geo-booking', 'Booking / Appointment Integration', 'warning', 'high', 'Booking text, no integration', 'Add booking link + ReserveAction schema',
      'Booking mentioned but no integration. Add Calendly/Acuity + ReserveAction schema for Google booking.', 8, 5);
  }
  return make('geo-booking', 'Booking / Appointment Integration', 'fail', 'medium', false, 'Add online booking system',
    'No booking system. Google allows bookings directly from search results — missing this loses direct conversions.', 8, 5);
}

function checkLocalSocialLinks(html: string): CheckResult {
  const $ = cheerio.load(html);
  const socialLinks = $('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="twitter.com"], a[href*="yelp.com"]').length;
  const hasSameAs = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').some((s) => s.includes('"sameAs"'));

  if (socialLinks >= 2 && hasSameAs) {
    return make('geo-social-links', 'Local Social Profile Links', 'pass', 'medium', `${socialLinks} social links + sameAs schema`, 'Social links + sameAs',
      'Social profiles linked with sameAs schema. Cross-platform NAP consistency strengthens local authority.', 6, 2);
  }
  if (socialLinks >= 1 || hasSameAs) {
    return make('geo-social-links', 'Local Social Profile Links', 'warning', 'medium', `${socialLinks} social links`, 'Add sameAs schema + 2+ social profiles',
      'Some social links present. Add sameAs to schema with all social profile URLs for consistency.', 6, 2);
  }
  return make('geo-social-links', 'Local Social Profile Links', 'fail', 'low', false, 'Link to social profiles + add sameAs schema',
    'No social profile links. Social profiles reinforce NAP consistency and local authority signals.', 6, 2);
}

function checkGMBLink(html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasGMBLink = $('a[href*="g.page"], a[href*="maps.app.goo.gl"], a[href*="google.com/maps"]').length > 0;
  const hasGMBText = /google business|google my business|gmb|view on google/i.test($('body').text());

  if (hasGMBLink || hasGMBText) {
    return make('geo-gmb-link', 'Google Business Profile Link', 'pass', 'medium', true, true,
      'Link to Google Business Profile detected. Drives reviews and signals ownership verification to Google.', 6, 1);
  }
  return make('geo-gmb-link', 'Google Business Profile Link', 'warning', 'medium', false, 'Add link to Google Business Profile',
    'No Google Business Profile link. Linking to GMB from your website reinforces profile ownership and review generation.', 6, 1);
}

// ─── Subcategory 2: Local Inventory & Products (10 checks) ───────────────────

function checkProductAvailabilitySchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasOffer = schemas.includes('"Offer"') || schemas.includes('"Product"');
  const hasAvailability = schemas.includes('"availability"') || schemas.includes('InStock') || schemas.includes('InStore');

  if (hasOffer && hasAvailability) {
    return make('geo-product-availability', 'Local Product Availability Schema', 'pass', 'high', 'Product + availability schema', 'Product availability schema',
      'Local product availability in schema. Enables "in-store product" rich results.', 8, 4);
  }
  if (hasOffer) {
    return make('geo-product-availability', 'Local Product Availability Schema', 'warning', 'high', 'Product schema, no availability', 'Add availability + inStorePickup',
      'Product schema present without availability. Add availability and pickupOption for local shopping results.', 8, 4);
  }
  return make('geo-product-availability', 'Local Product Availability Schema', 'fail', 'high', false, 'Add Product + Offer schema with local availability',
    'No product availability schema. Google shows local inventory in search results — missing this loses local shoppers.', 8, 4);
}

function checkStorePickup(html: string, bodyText: string): CheckResult {
  const hasPickup = /\b(pickup|pick up|buy online.*(pick up|collect)|click.and.collect|curbside|BOPIS)\b/i.test(bodyText);
  const $ = cheerio.load(html);
  const hasPickupLink = $('a, button').toArray().some((el) => /pickup|collect|curbside/i.test($(el).text()));

  if (hasPickup && hasPickupLink) {
    return make('geo-store-pickup', 'Store Pickup / BOPIS Option', 'pass', 'high', true, true,
      'In-store pickup (BOPIS) option detected. Click-and-collect increases both online and offline sales.', 8, 5);
  }
  if (hasPickup || hasPickupLink) {
    return make('geo-store-pickup', 'Store Pickup / BOPIS Option', 'warning', 'high', 'Pickup mentioned, no clear CTA', 'Add clear pickup CTA + button',
      'Pickup mentioned without a clear CTA. Add a prominent "Pick Up In Store" button.', 8, 5);
  }
  return make('geo-store-pickup', 'Store Pickup / BOPIS Option', 'fail', 'medium', false, 'Add in-store pickup option',
    'No store pickup option. 67% of local shoppers want to buy online and pick up in-store.', 8, 5);
}

function checkLocalPricing(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const hasPriceSchema = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').some((s) => s.includes('"price"') || s.includes('"priceCurrency"'));
  const hasPriceOnPage = /\$[\d,]+|\bfree\b|\bfrom \$|\bstarting at/i.test(bodyText);

  if (hasPriceSchema && hasPriceOnPage) {
    return make('geo-local-pricing', 'Local Pricing Display', 'pass', 'medium', 'Price in schema + body', 'Price schema + visible pricing',
      'Pricing in schema and body. Transparent pricing reduces friction and improves local query rankings.', 7, 3);
  }
  if (hasPriceOnPage || hasPriceSchema) {
    return make('geo-local-pricing', 'Local Pricing Display', 'warning', 'medium', 'Partial pricing signals', 'Add price schema + visible prices',
      'Pricing partially shown. Add Offer schema with price + display pricing prominently.', 7, 3);
  }
  return make('geo-local-pricing', 'Local Pricing Display', 'fail', 'medium', false, 'Display prices + add Offer schema',
    'No pricing displayed. Local searchers expect to see pricing — hidden prices increase bounce rate.', 7, 3);
}

function checkInventoryIndicators(bodyText: string): CheckResult {
  const signals = [/\b(in stock|out of stock|limited stock|only \d+ left|ships (today|within))\b/i,
    /\b(\d+|[a-z]+)\s+(units?|items?|pieces?)\s+(available|in stock|remaining)\b/i,
    /\b(available|unavailable|pre.order|backorder)\b/i];
  const found = signals.filter((p) => p.test(bodyText)).length;

  if (found >= 2) {
    return make('geo-inventory', 'Inventory Status Indicators', 'pass', 'medium', `${found} inventory signals`, 'Live inventory status',
      'Multiple inventory signals detected. Real-time inventory reduces wasted trips and builds trust.', 6, 4);
  }
  if (found === 1) {
    return make('geo-inventory', 'Inventory Status Indicators', 'warning', 'medium', `${found} inventory signal`, 'Show live inventory status',
      'Limited inventory signals. Show clear in-stock/out-of-stock status for all products.', 6, 4);
  }
  return make('geo-inventory', 'Inventory Status Indicators', 'fail', 'low', false, 'Display real-time inventory status',
    'No inventory status indicators. Customers need to know availability before visiting your store.', 6, 4);
}

function checkStoreFinder(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const hasStoreFinder = $('[class*="store-finder"], [class*="location-finder"], [id*="store-finder"]').length > 0;
  const hasFinderText = /\b(find a store|store locator|find location|nearest store|location finder)\b/i.test(bodyText);
  const hasMultiLocation = /\b(locations?|branches?|multiple|stores?|outlets?)\b/i.test(bodyText) && /\d+/.test(bodyText);

  if (hasStoreFinder && (hasFinderText || hasMultiLocation)) {
    return make('geo-store-finder', 'Store Locator / Finder', 'pass', 'high', true, true,
      'Store locator detected. Multi-location finder is essential for businesses with multiple branches.', 8, 5);
  }
  if (hasFinderText || hasMultiLocation) {
    return make('geo-store-finder', 'Store Locator / Finder', 'warning', 'high', 'Multiple locations mentioned, no finder', 'Add interactive store locator',
      'Multiple locations referenced but no store locator tool. Add an interactive location finder.', 8, 5);
  }
  return make('geo-store-finder', 'Store Locator / Finder', 'fail', 'medium', false, 'Add store locator for multi-location businesses',
    'No store finder. If you have multiple locations, a store locator is essential for local conversion.', 8, 5);
}

function checkCityRegionMentions(bodyText: string, title: string | null): CheckResult {
  const cityMentions = (bodyText.match(/\b[A-Z][a-z]+(?:,?\s*[A-Z]{2})?\b/g) || [])
    .filter((m) => m.length > 3 && !/^(The|This|That|Their|There|Then|They|When|What|Where|Which|Who|With|Your|From|Some|Have|Into|Only|Also|These|Those|More|Most|Much|Such|Both|All|Any|For|Are|Was|Were|Has|Had|Can|Will|May|Not|But|And|The|Our|Its|Been|Each|Many|Over|Made|Like|Into|Than|Then|Only|Other|Same|Time|Years|Very|Because)$/.test(m))
    .length;

  if (cityMentions >= 3) {
    return make('geo-city-mentions', 'City / Region Keyword Mentions', 'pass', 'high', `${cityMentions} location mentions`, '3+ location mentions',
      `${cityMentions} location references detected. Geographic keywords anchor content for local search.`, 8, 3);
  }
  if (cityMentions >= 1) {
    return make('geo-city-mentions', 'City / Region Keyword Mentions', 'warning', 'high', `${cityMentions} location mention(s)`, '3+ city/region mentions',
      'Limited location references. Naturally incorporate city/region names throughout content.', 8, 3);
  }
  return make('geo-city-mentions', 'City / Region Keyword Mentions', 'fail', 'high', '0 location mentions', '3+ location mentions in content',
    'No geographic keywords. Add city and region names naturally throughout content and metadata.', 8, 3);
}

function checkGeoTargetedContent(html: string, bodyText: string): CheckResult {
  const localPatterns = [/\b(serving .+ since|family.owned|locally.owned|community|neighborhood)\b/i,
    /\b(call .+ area code|local expert|local specialist)\b/i,
    /\b(visit our .+ location|our .+ store|.+ branch)\b/i];
  const found = localPatterns.filter((p) => p.test(bodyText)).length;

  if (found >= 2) {
    return make('geo-targeted-content', 'Geo-Targeted Content Signals', 'pass', 'medium', `${found} local content signals`, '2+ local signals',
      'Multiple geo-targeted content signals. Locally-resonant content improves community trust and local ranking.', 7, 5);
  }
  if (found === 1) {
    return make('geo-targeted-content', 'Geo-Targeted Content Signals', 'warning', 'medium', `${found} local signal`, '2+ local content signals',
      'Limited geo-targeted content. Add locally relevant content, community mentions, and service area focus.', 7, 5);
  }
  return make('geo-targeted-content', 'Geo-Targeted Content Signals', 'fail', 'medium', false, 'Create locally-relevant content',
    'No geo-targeted content. Local businesses need content that resonates with their specific community.', 7, 5);
}

function checkLocalEventSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasEvent = schemas.includes('"Event"') || schemas.includes('"SportsEvent"') || schemas.includes('"BusinessEvent"');

  if (hasEvent) {
    return make('geo-event-schema', 'Local Event Schema', 'pass', 'medium', 'Event schema present', 'Event schema',
      'Local Event schema detected. Events appear in Google Events and boost local visibility.', 6, 3);
  }
  const hasEventText = /\b(event|workshop|seminar|class|open day|sale|promotion)\b/i.test($('body').text());
  if (hasEventText) {
    return make('geo-event-schema', 'Local Event Schema', 'warning', 'medium', 'Events in content, no schema', 'Add Event schema for local events',
      'Event content without Event schema. Add schema to appear in Google Events carousel.', 6, 3);
  }
  return make('geo-event-schema', 'Local Event Schema', 'fail', 'low', false, 'Add local events with Event schema',
    'No event schema. Local events in schema appear in Google Events, driving additional local traffic.', 6, 3);
}

function checkLocalServiceSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasService = schemas.includes('"Service"') || schemas.includes('"Offer"') || schemas.includes('"itemOffered"');

  if (hasService) {
    return make('geo-service-schema', 'Local Service Schema', 'pass', 'medium', 'Service schema present', 'Service schema',
      'Service schema detected. Structured service listings enable local service rich results.', 7, 3);
  }
  const hasServiceText = /\b(our services?|what we offer|we provide|we specialize in)\b/i.test($('body').text());
  if (hasServiceText) {
    return make('geo-service-schema', 'Local Service Schema', 'warning', 'medium', 'Services in content, no schema', 'Add Service schema',
      'Service descriptions without schema. Add Service/Offer schema for each service.', 7, 3);
  }
  return make('geo-service-schema', 'Local Service Schema', 'fail', 'medium', false, 'Add Service schema for each offering',
    'No service schema. Service schema helps Google match your offerings to local service queries.', 7, 3);
}

function checkLocalImageOptimization(html: string): CheckResult {
  const $ = cheerio.load(html);
  const images = $('img').toArray();
  const localImages = images.filter((el) => {
    const alt = $(el).attr('alt') || '';
    const src = $(el).attr('src') || '';
    return /[A-Z][a-z]+|city|local|store|shop|location/i.test(alt) || /local|store|location/i.test(src);
  });
  const imagesWithAlt = images.filter((el) => ($(el).attr('alt') || '').length > 0).length;

  if (localImages.length >= 2) {
    return make('geo-image-optimization', 'Local Image Optimization', 'pass', 'medium', `${localImages.length} geo-optimized images`, '2+ local images',
      'Location-specific image alt texts detected. Local image optimization reinforces geographic relevance.', 6, 3);
  }
  if (imagesWithAlt >= 3) {
    return make('geo-image-optimization', 'Local Image Optimization', 'warning', 'medium', `${imagesWithAlt} images with alt, ${localImages.length} geo-specific`, 'Add location names to image alt text',
      'Images have alt text but missing geographic context. Include city/location names in alt attributes.', 6, 3);
  }
  return make('geo-image-optimization', 'Local Image Optimization', 'fail', 'low', 'No geo-optimized images', 'Add location-specific images with geo alt text',
    'No geo-optimized images. Use location-specific photos and include city/region in alt text.', 6, 3);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function runGEOChecks(
  url: string,
  fetchResult: FetchResult,
  parsed: ParsedPage
): CheckResult[] {
  const html = fetchResult.html || '';
  const bodyText = parsed.bodyText || '';
  const title = parsed.title;

  const isLocal = detectLocalBusiness(html, bodyText);

  if (!isLocal) {
    // Return N/A results for all 25 checks — no physical location detected
    const naIds = [
      ['geo-local-schema', 'LocalBusiness Schema Markup'],
      ['geo-nap', 'NAP Consistency (Name/Address/Phone)'],
      ['geo-hours-schema', 'Business Hours in Schema'],
      ['geo-address-schema', 'Structured Address (PostalAddress)'],
      ['geo-phone-schema', 'Click-to-Call Phone Number'],
      ['geo-maps-embed', 'Google Maps Embed'],
      ['geo-location-keywords', 'Location Keywords in Content'],
      ['geo-contact-page', 'Local Contact/Location Page'],
      ['geo-service-area', 'Service Area Definition'],
      ['geo-business-category', 'Business Category Classification'],
      ['geo-description', 'Business Description Quality'],
      ['geo-review-visibility', 'Local Review Visibility'],
      ['geo-booking', 'Booking / Appointment Integration'],
      ['geo-social-links', 'Local Social Profile Links'],
      ['geo-gmb-link', 'Google Business Profile Link'],
      ['geo-product-availability', 'Local Product Availability Schema'],
      ['geo-store-pickup', 'Store Pickup / BOPIS Option'],
      ['geo-local-pricing', 'Local Pricing Display'],
      ['geo-inventory', 'Inventory Status Indicators'],
      ['geo-store-finder', 'Store Locator / Finder'],
      ['geo-city-mentions', 'City / Region Keyword Mentions'],
      ['geo-targeted-content', 'Geo-Targeted Content Signals'],
      ['geo-event-schema', 'Local Event Schema'],
      ['geo-service-schema', 'Local Service Schema'],
      ['geo-image-optimization', 'Local Image Optimization'],
    ];
    return naIds.map(([id, name]) => naResult(id, name));
  }

  return [
    // Google Business Profile (15)
    checkLocalBusinessSchema(html),
    checkNAPConsistency(html, bodyText),
    checkBusinessHoursSchema(html),
    checkAddressSchema(html),
    checkPhoneSchema(html, bodyText),
    checkGoogleMapsEmbed(html),
    checkLocationKeywords(bodyText, title),
    checkLocalContactPage(html),
    checkServiceArea(html, bodyText),
    checkBusinessCategory(html),
    checkBusinessDescription(html),
    checkReviewVisibility(html, bodyText),
    checkBookingIntegration(html, bodyText),
    checkLocalSocialLinks(html),
    checkGMBLink(html),

    // Local Inventory (10)
    checkProductAvailabilitySchema(html),
    checkStorePickup(html, bodyText),
    checkLocalPricing(html, bodyText),
    checkInventoryIndicators(bodyText),
    checkStoreFinder(html, bodyText),
    checkCityRegionMentions(bodyText, title),
    checkGeoTargetedContent(html, bodyText),
    checkLocalEventSchema(html),
    checkLocalServiceSchema(html),
    checkLocalImageOptimization(html),
  ];
}

/** Returns null if not applicable, else GEO score 0-100 */
export function calculateGEOScore(checks: CheckResult[]): number | null {
  const geoChecks = checks.filter((c) => c.category === 'geo-local-seo');
  if (geoChecks.length === 0) return null;
  // If all are N/A (currentValue starts with "N/A"), return null
  const nonNA = geoChecks.filter((c) => !String(c.currentValue).startsWith('N/A'));
  if (nonNA.length === 0) return null;

  const passed = nonNA.filter((c) => c.status === 'pass').length;
  const warned = nonNA.filter((c) => c.status === 'warning').length;
  return Math.round(((passed + warned * 0.5) / nonNA.length) * 100);
}
