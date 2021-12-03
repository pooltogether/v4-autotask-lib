// @ts-nocheck
import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { Transaction } from '@ethersproject/transactions';
import { ActionState, CalculateL2DrawAndPrizeDistributionConfig, ContractsBlob, Draw, Relayer, ProviderOptions } from './types'
import { getContract } from './get/getContract';
import { getJsonRpcProvider } from "./get/getJsonRpcProvider";
import { computePrizeDistributionFromTicketAverageTotalSupplies, getMultiTicketAverageTotalSuppliesBetween, sumBigNumbers } from './utils'
import { calculateDrawTimestamps, calculateReceiverDrawToPushToTimelock } from './helpers'
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

  if (config?.beaconChain?.providerUrl) {
    providerBeaconChain = getJsonRpcProvider(config?.beaconChain?.providerUrl)
  }

  if (config?.targetReceiverChain?.providerUrl) {
    providerTargetReceiverChain = getJsonRpcProvider(config?.targetReceiverChain?.providerUrl)
  }

  // TODO: throw error if no provider?
  if (!providerBeaconChain || !providerTargetReceiverChain) {
    return undefined
  }

  /* ==========================================================================================*/
  // Initializing Contracts using the Beacon/Receiver/SecondaryReceiver chain configurations
  /* ========================================================================================== */
  const drawBufferBeaconChain = getContract('DrawBuffer', config.beaconChain.chainId, providerBeaconChain, contracts)
  const prizeTierHistoryBeaconChain = getContract('PrizeTierHistory', config.beaconChain.chainId, providerBeaconChain, contracts)
  const prizeDistributionBufferBeaconChain = getContract('PrizeDistributionBuffer', config.beaconChain.chainId, providerBeaconChain, contracts)
  const beaconTimelockAndPushRouter = getContract('BeaconTimelockAndPushRouter', config.beaconChain.chainId, providerBeaconChain, contracts)
  const ticketBeaconChain = getContract('Ticket', config.beaconChain.chainId, providerBeaconChain, contracts)

  // TODO: throw error if any of the contracts is unavailable?
  if (!drawBufferBeaconChain || !prizeTierHistoryBeaconChain || !prizeDistributionBufferBeaconChain || !beaconTimelockAndPushRouter || !ticketBeaconChain) {
    throw new Error('Smart Contracts are unavailable')
  };

  //  Initialize Secondary ReceiverChain contracts
  let otherTicketContracts: Array<Contract | undefined> | undefined = config.allTicketChains?.map(otherTicket => {
    return getContract('Ticket', otherTicket.chainId, getJsonRpcProvider(otherTicket.providerUrl), contracts)
  })

  /* ============================================================ */
  // Fetching data from Beacon/Receiver/SecondaryReceiver Chains
  /* ============================================================ */
  const decimals = await ticketBeaconChain.decimals()
  let draw;
  let lastPrizeDistributionDrawId = 0
  const { drawId } = await prizeDistributionBuffer.getNewestPrizeDistribution()
  if (drawId > 0) {
    lastPrizeDistributionDrawId = drawId
    draw = await drawBuffer.getDraw(drawId)
  }

  const prizeTier = await prizeTierHistoryBeaconChain.getPrizeTier(draw.drawId)
  const [startTime, endTime] = calculateDrawTimestamps(prizeTier, draw)

  const allTicketAverageTotalSupply = await getMultiTicketAverageTotalSuppliesBetween(allPrizePoolNetworkChains, startTime, endTime)
  debug('allTicketAverageTotalSupply', allTicketAverageTotalSupply)

  const totalNetworkTicketSupply = sumBigNumbers(allTicketAverageTotalSupply);

  return await beaconTimelockAndPushRouter.populateTransaction(drawFromBeaconChainToPush, totalNetworkTicketSupply)
}