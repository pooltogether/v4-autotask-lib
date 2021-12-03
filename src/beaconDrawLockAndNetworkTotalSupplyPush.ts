// @ts-nocheck
import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { ActionState, CalculateL2DrawAndPrizeDistributionConfig, ContractsBlob, Draw, Relayer, ProviderOptions } from './types'
import { getContract } from './get/getContract';
import { getJsonRpcProvider } from "./get/getJsonRpcProvider";
import { computePrizeDistributionFromTicketAverageTotalSupplies, getMultiTicketAverageTotalSuppliesBetween, sumBigNumbers } from './utils'
import { Transaction } from '@ethersproject/transactions';
const debug = require('debug')('pt-autotask-lib')

export interface PrizePoolNetworkConfig {
  beaconChain: ProviderOptions
  targetReceiverChain: ProviderOptions
  allPrizePoolNetworkChains: ProviderOptions[]
}

export async function beaconDrawLockAndNetworkTotalSupplyPush(
  contracts: ContractsBlob,
  config: PrizePoolNetworkConfig,
): Promise<Transaction | undefined> {
  let providerBeaconChain;
  let providerTargetReceiverChain;


}