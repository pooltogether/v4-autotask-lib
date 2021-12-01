// @ts-nocheck
import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { ActionState, CalculateL2DrawAndPrizeDistributionConfig, ContractsBlob, Draw, Relayer } from './types'
import { getContract } from './get/getContract';
import { getJsonRpcProvider } from "./get/getJsonRpcProvider";
import { computePrizeDistributionFromTicketAverageTotalSupplies, getMultiTicketAverageTotalSuppliesBetween } from './utils'
const debug = require('debug')('pt-autotask-lib')

export async function ReceiverDrawLockPushAndNetworkTotalSupplyPush(
  contracts: ContractsBlob,
  config: CalculateL2DrawAndPrizeDistributionConfig,
  relayer?: Relayer
): Promise<ActionState | undefined> {


}