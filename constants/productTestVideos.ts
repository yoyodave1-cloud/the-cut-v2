/**
 * Hand-curated Product Tests videos for Home.
 * First 5 = carousel, last 3 = featured. No repeats.
 *
 * Do not edit titles/dates by hand. Hydrate with:
 *   railway run node scripts/refreshProductTestVideos.js
 * (from the-cut/backend). To change the list, edit CURATED in that script.
 */

export type ProductTestVideo = {
  videoId: string;
  handle: string;
  title: string;
  channelName: string;
  publishedAt: string;
  thumbnailUrl: string;
};

export const PRODUCT_TEST_CAROUSEL_COUNT = 5;
export const PRODUCT_TEST_FEATURED_COUNT = 3;

export const PRODUCT_TEST_VIDEOS: ProductTestVideo[] = [
  {
    videoId: "M7E6p5ri_Xk",
    handle: "@GolfMonthly",
    title: "Ultimate 2026 Driver Battle: TaylorMade Qi4D vs Titleist GTS3",
    channelName: "Golf Monthly",
    publishedAt: "2026-08-20T13:00:13Z",
    thumbnailUrl: "https://i.ytimg.com/vi/M7E6p5ri_Xk/maxresdefault.jpg",
  },
  {
    videoId: "c8z2k9YdC0I",
    handle: "@HITGolfReviews",
    title: "Rick Shiels Tests NEW 2026 Drivers",
    channelName: "H.I.T GOLF",
    publishedAt: "2026-03-24T20:35:43Z",
    thumbnailUrl: "https://i.ytimg.com/vi/c8z2k9YdC0I/maxresdefault.jpg",
  },
  {
    videoId: "TSLJaHImCIo",
    handle: "@GolfMonthly",
    title: "Best Drivers 2026: Your Ultimate Guide!",
    channelName: "Golf Monthly",
    publishedAt: "2026-02-11T16:00:52Z",
    thumbnailUrl: "https://i.ytimg.com/vi/TSLJaHImCIo/maxresdefault.jpg",
  },
  {
    videoId: "ZoFiF3GP70o",
    handle: "@Precision_Golf",
    title: "2026 Driver SHOWDOWN | Which New Release WINS!!",
    channelName: "Precision Golf",
    publishedAt: "2026-02-12T15:01:07Z",
    thumbnailUrl: "https://i.ytimg.com/vi/ZoFiF3GP70o/maxresdefault.jpg",
  },
  {
    videoId: "KECRK1A3Fp0",
    handle: "@epgolfstudios",
    title: "We Ranked These 4 New Drivers.…And We Didn’t Agree!",
    channelName: "Elite Performance Golf Studios",
    publishedAt: "2026-05-27T18:42:42Z",
    thumbnailUrl: "https://i.ytimg.com/vi/KECRK1A3Fp0/maxresdefault.jpg",
  },
  {
    videoId: "T3fy-3yTJNM",
    handle: "@MarkCrossfield",
    title: "New Ping G440 K Driver Review",
    channelName: "Mark Crossfield",
    publishedAt: "2026-01-13T15:00:55Z",
    thumbnailUrl: "https://i.ytimg.com/vi/T3fy-3yTJNM/maxresdefault.jpg",
  },
  {
    videoId: "jiA6rL9mLNQ",
    handle: "@MichaelNewtonGolf",
    title: "I DIDN'T EXPECT THIS! Titleist GTS3 vs Callaway Quantum Triple Diamond Max",
    channelName: "Michael Newton Golf",
    publishedAt: "2026-06-07T15:00:30Z",
    thumbnailUrl: "https://i.ytimg.com/vi/jiA6rL9mLNQ/maxresdefault.jpg",
  },
  {
    videoId: "abaevgMQfso",
    handle: "@todaysgolfer",
    title: "TaylorMade Qi4D vs Callaway Quantum Max 2026 Driver Comparison | The Best Driver of 2026 is..",
    channelName: "Today's Golfer",
    publishedAt: "2026-01-16T15:00:05Z",
    thumbnailUrl: "https://i.ytimg.com/vi/abaevgMQfso/maxresdefault.jpg",
  },
];
