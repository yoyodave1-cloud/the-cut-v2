export type CreatorsStackParamList = {
  CreatorsTabScreen: undefined;
  CreatorProfilePage: {
    creatorId: string;
    creatorName: string;
    supabaseId?: string;
    handle?: string;
    avatarUrl?: string;
  };
};
