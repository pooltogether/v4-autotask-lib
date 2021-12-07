import { Provider } from '@ethersproject/abstract-provider';
import { BigNumber } from '@ethersproject/bignumber';
import { Transaction } from '@ethersproject/transactions';

export interface ActionState {
  err: any;
  msg: any;
  data?: any;
  transaction?: any;
  response?: Transaction;
  status: number;
}

export interface ContractData {
  address: string;
  chainId: number;
  type: string;
  abi: any;
}

export interface ContractsBlob {
  contracts: ContractData[];
}

export interface Config {
  chainId: number;
  network: string;
  apiKey: string | undefined;
  speed?: 'slow' | 'normal' | 'fast' | string;
  gasLimit?: number | string;
  execute?: Boolean;
}

export interface ProviderOptions {
  chainId: number;
  providerUrl: string;
}
export interface CalculateL2DrawAndPrizeDistributionConfig {
  speed?: 'slow' | 'normal' | 'fast' | string;
  gasLimit?: number | string;
  execute?: Boolean;
  beaconChain: ProviderOptions;
  targetReceiverChain: ProviderOptions;
  otherReceiverChains?: ProviderOptions[];
  otherTicketChains?: ProviderOptions[];
}

export interface ConfigWithL2 {
  speed?: 'slow' | 'normal' | 'fast' | string;
  gasLimit?: number | string;
  execute?: Boolean;
  L1: {
    chainId: number;
    providerUrl?: string;
  };
  L2: {
    chainId: number;
    providerUrl?: string;
  };
}

export interface Relayer {
  sendTransaction: Function;
}

export interface Draw {
  drawId: number;
  beaconPeriodSeconds: number;
  timestamp: number;
  getBeaconPeriodSeconds: Function;
}

export interface ContractPrizeTierHistory {
  getPrizeTier: Function;
}
export interface ReserverContract {
  getReserveAccumulatedBetween: Function;
}

export interface Draw {
  drawId: number;
  winningRandomNumber: BigNumber;
  timestamp: number;
  beaconPeriodStartedAt: number;
  beaconPeriodSeconds: number;
}

export interface PrizeDistribution {
  bitRangeSize: number;
  matchCardinality: number;
  startTimestampOffset?: number;
  endTimestampOffset?: number;
  maxPicksPerUser: number;
  expiryDuration: number;
  numberOfPicks: BigNumber;
  tiers: Array<BigNumber | number>;
  prize: BigNumber;
}

export interface PrizeTier {
  bitRangeSize: number;
  drawId: number;
  maxPicksPerUser: number;
  expiryDuration: number;
  endTimestampOffset: number;
  prize: BigNumber;
  tiers: Array<number>;
}
