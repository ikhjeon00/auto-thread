export type FarmKind = "growth" | "monetize";

/** campaigns.config */
export type FarmConfig = {
  kind: FarmKind;
  /** 하루 일상글 수(키우기 농장은 이것만) */
  dailyGeneralCount: number;
  /** 하루 상품글 수(수익화 농장) */
  dailyProductCount: number;
  generalSource: "ai" | "pool";
  poolId: string | null;
  assignTiming: "pre" | "at_publish";
  generatorId: string | null;
  productGeneratorId: string | null;
  productIds: string[];
  /** 상품 사진을 AI에게 보여 주고 쓰게 하기 */
  useVision: boolean;
  isAiLabel: boolean;
  mode: "review" | "auto";
  phase: "slots" | "fill" | "done";
  skipped?: number;
};

/** posts.ai_meta.farm (자리만 잡아 둔 글의 정보) */
export type FarmPostMeta = {
  type: "general" | "product";
  productId?: string | null;
  pickAtPublish?: boolean;
  issues?: string[];
};
