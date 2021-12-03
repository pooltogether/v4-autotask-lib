// @ts-nocheck
import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { Transaction } from '@ethersproject/transactions';
import { ActionState, CalculateL2DrawAndPrizeDistributionConfig, ContractsBlob, Draw, Relayer, ProviderOptions } from './types'
import { getContract } from './get/getContract';
import { getJsonRpcProvider } from "./get/getJsonRpcProvider";
import { computePrizeDistributionFromTicketAverageTotalSupplies, getMultiTicketAverageTotalSuppliesBetween, sumBigNumbers } from './utils'
import { calculateDrawTimestamps, calculateDrawToPushToTimelock } from './helpers'
const debug = require('debug')('pt-autotask-lib')

export interface PrizePoolNetworkConfig {
  beaconChain: ProviderOptions
  targetReceiverChain: ProviderOptions
  allPrizePoolNetworkChains: ProviderOptions[]
}

export async function receiverDrawLockPushAndNetworkTotalSupplyPush(
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

  //  Initialize BeaconChain contracts
  const drawBufferBeaconChain = getContract('DrawBuffer', config.beaconChain.chainId, providerBeaconChain, contracts)
  const prizeTierHistoryBeaconChain = getContract('PrizeTierHistory', config.beaconChain.chainId, providerBeaconChain, contracts)
  const prizeDistributionBufferBeaconChain = getContract('PrizeDistributionBuffer', config.beaconChain.chainId, providerBeaconChain, contracts)

  //  Initialize ReceiverChain contracts
  const ticketReceiverChain = getContract('Ticket', config.targetReceiverChain.chainId, providerTargetReceiverChain, contracts)
  const prizeDistributionBufferReceiverChain = getContract('PrizeDistributionBuffer', config.targetReceiverChain.chainId, providerTargetReceiverChain, contracts)
  const drawCalculatorTimelockReceiverChain = getContract('DrawCalculatorTimelock', config.targetReceiverChain.chainId, providerTargetReceiverChain, contracts)
  const receiverTimelockAndPushRouter = getContract('ReceiverTimelockAndPushRouter', config.targetReceiverChain.chainId, providerTargetReceiverChain, contracts)

  // TODO: throw error if any of the contracts is unavailable?
  if (!drawBufferBeaconChain || !prizeTierHistoryBeaconChain || !prizeDistributionBufferBeaconChain || !prizeDistributionBufferReceiverChain || !drawCalculatorTimelockReceiverChain || !receiverTimelockAndPushRouter || !ticketReceiverChain) return undefined;

  //  Initialize Secondary ReceiverChain contracts
  let otherTicketContracts: Array<Contract | undefined> | undefined = config.allTicketChains?.map(otherTicket => {
    return getContract('Ticket', otherTicket.chainId, getJsonRpcProvider(otherTicket.providerUrl), contracts)
  })

  /* ============================================================ */
  // Fetching data from Beacon/Receiver/SecondaryReceiver Chains
  /* ============================================================ */
  const decimals = await ticketReceiverChain.decimals()
  const { drawFromBeaconChainToPush, drawIdToFetch } = calculateDrawToPushToTimelock(
    drawBufferBeaconChain,
    prizeDistributionBufferBeaconChain,
    prizeDistributionBufferReceiverChain,
    drawCalculatorTimelockReceiverChain,
  )

  const prizeTier = await prizeTierHistoryBeaconChain.getPrizeTier(draw.drawId)
  const [startTime, endTime] = calculateDrawTimestamps(prizeTier, draw)

  const allTicketAverageTotalSupply = await getMultiTicketAverageTotalSuppliesBetween(allPrizePoolNetworkChains, startTime, endTime)
  debug('allTicketAverageTotalSupply', allTicketAverageTotalSupply)

  const totalNetworkTicketSupply = sumBigNumbers(allTicketAverageTotalSupply);

  return await receiverTimelockAndPushRouter.populateTransaction(drawFromBeaconChainToPush, totalNetworkTicketSupply)
}