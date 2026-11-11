export type AccountView = {
  id: string;
  username: string;
  profile_picture_url: string | null;
  status: "active" | "needs_reconnect" | "disabled";
  group_id: string | null;
  daily_post_limit: number;
  token_expires_at: string | null;
  token_refreshed_at: string | null;
  follower_count: number | null;
};

export type GroupView = { id: string; name: string; color: string };
