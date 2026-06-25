import type { TourSeasonEvent } from './tourSchedules2026';
const PGA_EVENT_LINKS: Record<string, { tournId: string; slug: string }> = {
  'pga-2026-sony-open-in-hawaii': { tournId: '006', slug: 'sony-open-in-hawaii' },
  'pga-2026-the-american-express': { tournId: '002', slug: 'the-american-express' },
  'pga-2026-farmers-insurance-open': { tournId: '003', slug: 'farmers-insurance-open' },
  'pga-2026-wm-phoenix-open': { tournId: '004', slug: 'wm-phoenix-open' },
  'pga-2026-att-pebble-beach-pro-am': { tournId: '005', slug: 'att-pebble-beach-pro-am' },
  'pga-2026-the-genesis-invitational': { tournId: '007', slug: 'the-genesis-invitational' },
  'pga-2026-cognizant-classic': { tournId: '010', slug: 'cognizant-classic-in-the-palm-beaches' },
  'pga-2026-arnold-palmer-invitational': {
    tournId: '009',
    slug: 'arnold-palmer-invitational-presented-by-mastercard',
  },
  'pga-2026-puerto-rico-open': { tournId: '483', slug: 'puerto-rico-open' },
  'pga-2026-the-players': { tournId: '011', slug: 'the-players-championship' },
  'pga-2026-valspar-championship': { tournId: '475', slug: 'valspar-championship' },
  'pga-2026-texas-childrens-houston-open': { tournId: '020', slug: 'texas-childrens-houston-open' },
  'pga-2026-valero-texas-open': { tournId: '041', slug: 'valero-texas-open' },
  'pga-2026-masters': { tournId: '014', slug: 'masters-tournament' },
  'pga-2026-rbc-heritage': { tournId: '012', slug: 'rbc-heritage' },
  'pga-2026-zurich-classic': { tournId: '018', slug: 'zurich-classic-of-new-orleans' },
  'pga-2026-cadillac-championship': { tournId: '540', slug: 'cadillac-championship' },
  'pga-2026-truist-championship': { tournId: '054', slug: 'truist-championship' },
  'pga-2026-myrtle-beach-classic': { tournId: '525', slug: 'oneflight-myrtle-beach-classic' },
  'pga-2026-pga-championship': { tournId: '033', slug: 'pga-championship' },
  'pga-2026-cj-cup-byron-nelson': { tournId: '019', slug: 'the-cj-cup-byron-nelson' },
  'pga-2026-charles-schwab-challenge': { tournId: '021', slug: 'charles-schwab-challenge' },
  'pga-2026-memorial': { tournId: '023', slug: 'the-memorial-tournament-presented-by-workday' },
  'pga-2026-rbc-canadian-open': { tournId: '032', slug: 'rbc-canadian-open' },
  'pga-2026-us-open': { tournId: '026', slug: 'us-open' },
  'pga-2026-travelers-championship': { tournId: '034', slug: 'travelers-championship' },
  'pga-2026-john-deere-classic': { tournId: '030', slug: 'john-deere-classic' },
  'pga-2026-genesis-scottish-open': { tournId: '541', slug: 'genesis-scottish-open' },
  'pga-2026-isco-championship': { tournId: '518', slug: 'isco-championship' },
  'pga-2026-the-open': { tournId: '100', slug: 'the-open-championship' },
  'pga-2026-corales-puntacana': { tournId: '065', slug: 'corales-puntacana-championship' },
  'pga-2026-3m-open': { tournId: '049', slug: '3m-open' },
  'pga-2026-rocket-classic': { tournId: '524', slug: 'rocket-classic' },
  'pga-2026-wyndham-championship': { tournId: '022', slug: 'wyndham-championship' },
  'pga-2026-fedex-st-jude': { tournId: '047', slug: 'fedex-st-jude-championship' },
  'pga-2026-bmw-championship': { tournId: '027', slug: 'bmw-championship' },
  'pga-2026-tour-championship': { tournId: '060', slug: 'tour-championship' },
};

/** DP World Tour europeantour.com slugs (include season year). */
const DP_EVENT_SLUGS: Record<string, string> = {
  'dpwt-2026-australian-pga': 'bmw-australian-pga-championship-2025',
  'dpwt-2026-australian-open': 'isps-handa-australian-open-2025',
  'dpwt-2026-nedbank': 'nedbank-golf-challenge-2025',
  'dpwt-2026-dunhill-championship': 'alfred-dunhill-championship-2025',
  'dpwt-2026-mauritius-open': 'afrasia-bank-mauritius-open-2025',
  'dpwt-2026-dubai-invitational': 'dubai-invitational-2026',
  'dpwt-2026-hero-dubai-desert': 'hero-dubai-desert-classic-2026',
  'dpwt-2026-bahrain-championship': 'bahrain-championship-2026',
  'dpwt-2026-qatar-masters': 'qatar-masters-2026',
  'dpwt-2026-kenya-open': 'magical-kenya-open-2026',
  'dpwt-2026-sa-open': 'investec-south-african-open-championship-2026',
  'dpwt-2026-joburg-open': 'joburg-open-2026',
  'dpwt-2026-hainan-classic': 'hainan-classic-2026',
  'dpwt-2026-hero-indian-open': 'hero-indian-open-2026',
  'dpwt-2026-volvo-china-open': 'volvo-china-open-2026',
  'dpwt-2026-turkish-airlines-open': 'turkish-airlines-open-2026',
  'dpwt-2026-catalunya-championship': 'estrella-damm-catalunya-championship-2026',
  'dpwt-2026-soudal-open': 'soudal-open-2026',
  'dpwt-2026-austrian-alpine-open': 'austrian-alpine-open-2026',
  'dpwt-2026-klm-open': 'klm-open-2026',
  'dpwt-2026-italian-open': 'italian-open-2026',
  'dpwt-2026-bmw-intl-open': 'bmw-international-open-2026',
  'dpwt-2026-genesis-scottish-open': 'genesis-scottish-open-2026',
  'dpwt-2026-isco-championship': 'isco-championship-2026',
  'dpwt-2026-corales-puntacana': 'corales-puntacana-championship-2026',
  'dpwt-2026-danish-championship': 'danish-golf-championship-2026',
  'dpwt-2026-british-masters': 'husqvarna-british-masters-2026',
  'dpwt-2026-omega-european-masters': 'omega-european-masters-2026',
  'dpwt-2026-irish-open': 'amgen-irish-open-2026',
  'dpwt-2026-bmw-pga': 'bmw-pga-championship-2026',
  'dpwt-2026-open-de-france': 'fedex-open-de-france-2026',
  'dpwt-2026-dunhill-links': 'alfred-dunhill-links-championship-2026',
  'dpwt-2026-open-espana': 'open-de-espana-2026',
  'dpwt-2026-india-championship': 'dp-world-india-championship-2026',
  'dpwt-2026-genesis-championship': 'genesis-championship-2026',
  'dpwt-2026-abu-dhabi-championship': 'abu-dhabi-championship-2026',
  'dpwt-2026-tour-championship-dubai': 'dp-world-tour-championship-2026',
};

function slugFromPrefixedId(id: string, prefix: string): string | undefined {
  if (!id.startsWith(prefix)) return undefined;
  const slug = id.slice(prefix.length).trim();
  return slug || undefined;
}

export function resolveEventLinkFields(event: TourSeasonEvent): Pick<TourSeasonEvent, 'slug' | 'tournId'> {
  if (event.id.startsWith('pga-')) {
    const link = PGA_EVENT_LINKS[event.id];
    return link ? { slug: link.slug, tournId: link.tournId } : {};
  }

  if (event.id.startsWith('dpwt-')) {
    const slug = DP_EVENT_SLUGS[event.id];
    return slug ? { slug } : {};
  }

  if (event.id.startsWith('liv-')) {
    const slug = slugFromPrefixedId(event.id, 'liv-2026-');
    return slug ? { slug } : {};
  }

  if (event.id.startsWith('lpga-')) {
    const slug = slugFromPrefixedId(event.id, 'lpga-2026-');
    return slug ? { slug } : {};
  }

  return {};
}

export function withEventLinkFields(event: TourSeasonEvent): TourSeasonEvent {
  const links = resolveEventLinkFields(event);
  if (!links.slug && !links.tournId) return event;
  return { ...event, ...links };
}
