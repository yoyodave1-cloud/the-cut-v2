export type CreatorRef = {
  readonly id: string;
  readonly supabaseId?: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string;
  readonly channelId: string;
  readonly descriptor: string;
};

type CreatorSeed = {
  id: string;
  supabaseId?: string;
  name: string;
  handle: string;
  avatarUrl: string;
  channelId: string;
  type: 'competitive' | 'instruction';
};

function seedToCreator(seed: CreatorSeed): CreatorRef {
  return {
    id: seed.id,
    supabaseId: seed.supabaseId,
    name: seed.name,
    handle: seed.handle,
    avatarUrl: seed.avatarUrl,
    channelId: seed.channelId,
    descriptor:
      seed.type === 'instruction'
        ? 'Instruction and coaching'
        : 'Matches, challenges, and creator golf',
  };
}

const CREATOR_SEEDS: CreatorSeed[] = [
  { id: 'good-good', supabaseId: '3ed34fa8-5f92-4feb-9bb2-c9865bc849e0', name: 'Good Good', handle: 'GoodGood', avatarUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_l5KkCmx0sHAHOT_pTszsSj392DJqCY1ms0M6sIy14NXKk=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCfi-mPMOmche6WI-jkvnGXw', type: 'competitive' },
  { id: 'rick-shiels-golf', supabaseId: '6d553dcf-a55e-4464-b4df-398cb842e412', name: 'Rick Shiels Golf', handle: 'rickshielspga', avatarUrl: 'https://yt3.googleusercontent.com/SEeFGb423boD4UsvJVi7mkItMDnq4XQ-HaoIEcl2oICVKhwUy3bYSTgxjaftemU136BP7QgsATQ=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCFHZHhZaH7Rc_FOMIzUziJA', type: 'competitive' },
  { id: 'grant-horvat-golf', supabaseId: '74e6f870-20b6-40f6-8ce9-7f8f29764f58', name: 'Grant Horvat Golf', handle: 'granthorvatgolfs', avatarUrl: 'https://yt3.googleusercontent.com/PTyFdO40IOBjTgPmTSc0xZVBLCCeEl_zzgmJ7POkip2Gyil3wvXtu2_nM7YHI0QO_isKlr7cSQ=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCgUueMmSpcl-aCTt5CuCKQw', type: 'competitive' },
  { id: 'peter-finch-golf', supabaseId: '3b5581d9-2fd5-441c-a4d0-5b5cfc7e4814', name: 'Peter Finch Golf', handle: 'peterfinchgolf', avatarUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_mwJJKb11NHZStguHyOSbBlz51pnQakRjeqjbg1pvmFoqo=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCFoez1Xjc90CsHvCzqKnLcw', type: 'competitive' },
  { id: 'gm-golf', supabaseId: '65ce7989-b0f4-4586-84e6-4d2db89cdf44', name: 'GM Golf', handle: 'gmgolf', avatarUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_mdaXBYCV7MxOTZt-vHSNPga74rkkFhZI4WsRW4j58Ka-w=s800-c-k-c0x00ffffff-no-rj', channelId: 'UClljAz6ZKy0XeViKsohdjqA', type: 'competitive' },
  { id: 'bob-does-sports', supabaseId: '533fdb9f-bf04-425f-a094-6780ab212428', name: 'Bob Does Sports', handle: 'bobdoessports', avatarUrl: 'https://yt3.googleusercontent.com/Jqy1ArSMKiFbpQjJzVOkOd3wi8WlXhGdnp3KmaQh2vGRMIF-kh8ts9r6jpcQqQkKP1Urc2DBMRU=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCqr4sONkmFEOPc3rfoVLEvg', type: 'competitive' },
  { id: 'bryan-bros-golf', supabaseId: '5173ec57-b852-46fb-9698-5fa8ef23be10', name: 'Bryan Bros Golf', handle: 'bryanbrosgolf', avatarUrl: 'https://yt3.googleusercontent.com/BtavUlJM1_sRwSuR2Jf2yy7Qkyjt005fg5uO-l3pY19H4xge3yX--LCApeRjS0ejoDGthykZxg=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCdCxaD8rWfAj12rloIYS6jQ', type: 'competitive' },
  { id: 'fore-bros-golf', supabaseId: '61167dd0-a8fa-4bb0-9b15-a2f4d313f822', name: 'Fore Bros Golf', handle: 'ForeBrosGolf', avatarUrl: 'https://yt3.googleusercontent.com/DyQThjCsc2fXOO-J0TCD-fcuUf7MqGUA11GIuQCdAMQZuNW6H9SBGOXZHJN9rV6fsp3uLVkp1u0=s800-c-k-c0x00ffffff-no-rj', channelId: 'UC5qdckIlEsXUseofynYwrRA', type: 'competitive' },
  { id: 'bryson-dechambeau', supabaseId: '31f98ea4-b4dd-4263-9f22-4be1bb8d3468', name: 'Bryson DeChambeau', handle: 'brysondechambeau', avatarUrl: 'https://yt3.googleusercontent.com/-j2vSZFoILnPNItgqLj_E0djyuZ8Mes2mpwqMdCTLWzPE7dRFAtZYKW_f1gqMxh5QfwJ_FoIAw=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCCxF55adGXOscJ3L8qdKnrQ', type: 'competitive' },
  { id: 'no-laying-up', supabaseId: 'cc46a4e9-4c9a-42cf-ac2d-5390adf0ecf0', name: 'No Laying Up', handle: 'NoLayingUp', avatarUrl: 'https://yt3.googleusercontent.com/h-bCNDu1MpliZhLVW-0_Lvz6kbta1Gdg7julkWO8wFcre6iJ_jmDMcftvzbloqzANugXxJDg=s800-c-k-c0x00ffffff-no-rj', channelId: 'UC1w9eK1xX3gV7o1JzYgP0aA', type: 'competitive' },
  { id: 'me-and-my-golf-comp', supabaseId: 'ef71966d-baa5-4f72-8ce1-eb73ffa907e5', name: 'Me and My Golf', handle: 'meandmygolf', avatarUrl: 'https://yt3.googleusercontent.com/aAO1X6M0dWiWY2z6oetISnvPRc4xOPahu4JIN8heb2wwUTlo5OZBOYtwI_EX0TIO2I5N36gGng=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCTwywdg9Sw5xs4wdN-qz7yw', type: 'competitive' },
  { id: 'luke-kwon-golf', supabaseId: '0b4e90ad-baf5-4f2f-9f31-6fd15cec0016', name: 'Luke Kwon Golf', handle: 'lukekwongolf', avatarUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_lDITSQjzij4ADQKdbizlDr6RtSYgxKkDMztyTuNS0gJnc=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCJcc1x6emfrQquiV8Oe_pug', type: 'competitive' },
  { id: 'bustajack-golf', supabaseId: '7085b945-f012-46c1-bb4d-f7fa34a084a1', name: 'BustaJack Golf', handle: 'bustajackgolf', avatarUrl: 'https://yt3.googleusercontent.com/rW_TGF7Gk9OndE9uN1MDvO_peToT2RcsqcxTnJbSGoA3XVcQigJyywg9sB7HJW-qlT__CDNqwA=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCWlDdrhJCiJaGpkQgwa0A7A', type: 'competitive' },
  { id: 'brad-dalke', supabaseId: 'bfd20ebc-923f-463e-87cc-ddb83f0f6939', name: 'Brad Dalke', handle: 'braddalkegolf', avatarUrl: 'https://yt3.googleusercontent.com/_YNq7EaWlc-eGy_VjfG3Hra8S1NeKmlavUBr2vqArpLb-YazK6Aoa2MIa4l-bUXsVyO_bXG4xs8=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCjchle1bmH0acutqK15_XSA', type: 'competitive' },
  { id: 'danny-maude', supabaseId: '0bf2cc31-8f0a-46b8-95a4-b8ebcf4f5cd7', name: 'Danny Maude', handle: 'DanielMaude', avatarUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_mQ5MrmCkGTGJHU85kD16Sd_XN922RJaQCg-BhyekLLnw=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCSwdmDQhAi_-ICkAvNBLEBw', type: 'instruction' },
  { id: 'dan-grieve', supabaseId: 'f2d6a4be-c455-4fdf-ac8a-eb9fcbf89ecf', name: 'Dan Grieve', handle: 'DanGrieveGolf', avatarUrl: 'https://yt3.googleusercontent.com/JY2qK6Xms3NpVe553xYiu2HJms4S_CAi56N5TTvRZgozIknP5rrNczbZj4tl45_whXTqxVJq=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCHcp_82PzKGeVa3F0CJdXjg', type: 'instruction' },
  { id: 'alex-clapp', supabaseId: '2dbd6691-d66e-4955-a3d4-5f63f7ccf75f', name: 'Alex Clapp', handle: 'alexclappgolf', avatarUrl: 'https://yt3.googleusercontent.com/Y-1142vcOKy5MUdSAuxGFhizI6drBbzXpO8ft2kgbRjKIydpiy6WX7_Hc2xBX2huatf4Of4HVQ=s800-c-k-c0x00ffffff-no-rj', channelId: 'UCJOVCdmBN_2MEmu1W0YSrfQ', type: 'instruction' },
];

export const CREATORS: readonly CreatorRef[] = CREATOR_SEEDS.map(seedToCreator);

export function creatorInitials(displayName: string): string {
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0]!.length >= 2) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

export function youtubeThumbnailUri(videoId: string, quality: 'max' | 'hq'): string {
  const slug = quality === 'max' ? 'maxresdefault' : 'hqdefault';
  return `https://img.youtube.com/vi/${videoId}/${slug}.jpg`;
}

export function getCreatorById(id: string): CreatorRef | undefined {
  return CREATORS.find((c) => c.id === id);
}

export function getCreatorBySupabaseId(supabaseId: string): CreatorRef | undefined {
  return CREATORS.find((c) => c.supabaseId === supabaseId);
}
