export interface Token {
    id: string;
    mint: string;
    name: string;
    symbol: string;
    uri: string;
    description: string | null;
    creator: string;
    createdAt: string;
    isGraduated: boolean;
    realSolBalance: string;
    totalSupply: string;
    virtualSol: string;
    virtualToken: string;
    currentPrice?: number;
    marketCap?: number;
  }
  
  export interface TokenMetadata {
    name: string;
    symbol: string;
    description: string;
    image: string;
  }
  
  export type SortOption = "latest" | "trending" | "graduated";