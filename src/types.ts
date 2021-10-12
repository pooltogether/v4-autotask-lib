export interface ActionState {
  err: any;
  msg: any;
  data?: any;
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
  speed?: "slow" | "normal" | "fast";
  gasLimit?: number | string;
}

export interface Relayer {
  sendTransaction: Function;
}

export interface Draw {
  drawId: number;
  beaconPeriodSeconds: number;
}

export interface ContractPrizeTierHistory {
  getPrizeTier: Function
}
export interface ReserverContract {
  getReserveAccumulatedBetween: Function
}

