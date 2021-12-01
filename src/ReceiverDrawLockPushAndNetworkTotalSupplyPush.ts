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

export async function ReceiverDrawLockPushAndNetworkTotalSupplyPush(
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
  decimals = await ticketReceiverChain.decimals()
  drawNewest = await drawBufferBeaconChain.getNewestDraw()

  let oldestBeaconChainDrawId = 0
  let newestBeaconChainDrawId = 0
  let newestReceiverChainDrawId = 0
  try {
    const { drawId: drawIdNewestFromReceiverChain } = await prizeDistributionBufferReceiverChain.getNewestPrizeDistribution()
    newestReceiverChainDrawId = drawIdNewestFromReceiverChain
  } catch (e) {
    // IF no prize distribution exists on the RECEIVER chain, the RPC call will throw an error.
    // IF no PrizeDistribution struct exists we know that the ReceiverChain PrizeDistributionBuffer has not been initialized yet.
    const { drawId: drawIdNewestFromBeaconChain } = await prizeDistributionBufferBeaconChain.getNewestPrizeDistribution()
    newestBeaconChainDrawId = drawIdNewestFromBeaconChain

    const { drawId: drawIdOldestFromBeaconChain } = await prizeDistributionBufferBeaconChain.getOldestPrizeDistribution()
    oldestBeaconChainDrawId = drawIdOldestFromBeaconChain
  }
  debug(`ReceiverChain: Newest PrizeDistribution Draw ID is ${newestReceiverChainDrawId}`)
  debug(drawNewest.drawId)

  const timelockElapsed = await drawCalculatorTimelockReceiverChain.hasElapsed()
  debug(timelockElapsed)

  if (!timelockElapsed) {
    // IF the timelock has not elapsed, we can NOT push a new Draw/PrizeDistribution so we return early.
    throw new Error('DrawCalculatorTimelockReceiverChain/timelock-not-elapsed')
  }

  debug('oldestBeaconChainDrawId: ', oldestBeaconChainDrawId)
  debug('newestBeaconChainDrawId: ', newestBeaconChainDrawId)
  debug('newestReceiverChainDrawId: ', newestReceiverChainDrawId)

  /**
   * Depending on the state of the Beacon and Receiver chain, existing prize distributions may NOT required on the Receiver chain.
   * State 0: The Beacon and Receiver chains have not been initialized.
   * State 1: Beacon chain is 1 draw ahead of the Receiver chain.
   * State 2: Beacon chain is 2 draws ahead of an uninitialized Receiver chain.
   * State 3: Beacon chain is 2 draws ahead of an initialized Receiver chain.
   */

  if (oldestBeaconChainDrawId === 0 && newestBeaconChainDrawId === 0) {
    throw new Error('BeaconChainPrizeDistributionBuffer/no-prize-distribution-buffer-available')
  }

  let drawIdToFetch = 0;
  let drawFromBeaconChainToPush: Draw | undefined;

  if (newestBeaconChainDrawId === newestReceiverChainDrawId + 1) {
    /**
     * IF the Beacon chain has exactly 1 more draw and than Receiver chain we can
     * PUSH the NEWEST draw from the Beacon chain to the Receiver chain.
     * @dev This includes the case where the Receiver chain has 0 draws and the Beacon chain has 1 draws.
     * @dev This includes the case where the Receiver chain has 1 draw and the Beacon chain has 2 draws.
     * @dev When the Receiver is staying in sync with the Beacon chain we can request the newest draw from the Beacon chain.
     */
    drawIdToFetch = newestBeaconChainDrawId
    drawFromBeaconChainToPush = await drawBufferBeaconChain.getDraw(drawIdToFetch)
  }

  if (newestBeaconChainDrawId > 1 && newestReceiverChainDrawId === 0) {
    /**
     * IF the Beacon chain has 2 or more draws and the Receiver chain is NOT initialized, we can
     * PUSH the NEWEST draw from the Beacon chain to the Receiver chain.
     * @dev This scenario is likely to occur if a new PrizePool is created on the Receiver chain, after a Beacon chain has
     *      been previously initialized with 2 more or more draws. 
     *      We're assuming the Receiver chain has no need to sync with previous Beacon chain Draws/PrizeDistributions
     *      because the Receiver chain PrizePool DID NOT exist yet when the parameters were created.
     */
    drawIdToFetch = newestBeaconChainDrawId
    drawFromBeaconChainToPush = await drawBufferBeaconChain.getDraw(drawIdToFetch)
  }

  if (newestBeaconChainDrawId > (newestReceiverChainDrawId + 1) && newestReceiverChainDrawId > 0) {
    /**
     * IF the Beacon chain is 2 draws ahead of the Receiver chain AFTER the Receiver has been initialized and synced, we can
     * PUSH a Draw between the OLDEST and NEWEST from the Beacon chain to the Receiver chain.
     * @dev This scenario is likely to occur if the Receiver chain missed a draw from the Beacon chain
     *      and needs to catch up to Beacon chain, since it was previously in sync.
     */
    drawIdToFetch = newestReceiverChainDrawId + 1
    drawFromBeaconChainToPush = await drawBufferBeaconChain.getDraw(drawIdToFetch)
  }

  // WHY would we get undefined? What situation are missing?
  if (typeof drawFromBeaconChainToPush === 'undefined') {
    throw new Error('DrawBufferBeaconChain/error-calculating-correct-draw')
  }

  debug("DrawID: ", drawIdToFetch)
  debug("Draw: ", drawFromBeaconChainToPush)

  const prizeTier = await prizeTierHistoryBeaconChain.getPrizeTier(draw.drawId)
  const endTimestampOffset = prizeTier.endTimestampOffset
  const startTimestampOffset = draw.beaconPeriodSeconds
  const startTime = draw.timestamp - startTimestampOffset
  const endTime = draw.timestamp - endTimestampOffset

  const allTicketAverageTotalSupply = await getMultiTicketAverageTotalSuppliesBetween(allPrizePoolNetworkChains, startTime, endTime)
  debug('allTicketAverageTotalSupply', allTicketAverageTotalSupply)

  const totalNetworkTicketSupply = sumBigNumbers(allTicketAverageTotalSupply);

  return await receiverTimelockAndPushRouter.populateTransaction(drawFromBeaconChainToPush, totalNetworkTicketSupply)
}