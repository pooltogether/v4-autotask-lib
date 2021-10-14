import { Transaction } from "@ethersproject/transactions";

export interface ActionState {
  err: any;
  msg: any;
  data?: any;
  transaction?: any;
  response?: Transaction;
  status: number;
}

export interface ContractData {
  address: string,
  chainId: number,
  type: string,
  abi: any,
}

export interface ContractsBlob {
  contracts: ContractData[];
}

export interface Config {
  chainId: number;
  network: string;
  apiKey: string | undefined;
  speed?: "slow" | "normal" | "fast" | string;
  gasLimit?: number | string;
  execute?: Boolean;
}

export interface ConfigWithL2 {
  chainId: number;
  network: string;
  apiKey: string | undefined;
  speed?: "slow" | "normal" | "fast" | string;
  gasLimit?: number | string;
  execute?: Boolean;
  L1: {
    chainId: number;
    network: string;
  },
  L2: {
    chainId: number;
    network: string;
  }
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
  getPrizeTier: Function
}
export interface ReserverContract {
  getReserveAccumulatedBetween: Function
}

