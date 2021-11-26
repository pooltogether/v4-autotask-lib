
import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { ActionState, CalculateL2DrawAndPrizeDistributionConfig, ContractsBlob, Relayer } from './types'
import { getContract } from './get/getContract';
import { getJsonRpcProvider } from "./get/getJsonRpcProvider";
import { computePrizeDistributionFromTicketAverageTotalSupplies, getMultiTicketAverageTotalSuppliesBetween } from './utils'
const debug = require('debug')('pt-autotask-lib')

export async function L2DrawAndPrizeDistributionPush(
  contracts: ContractsBlob,
  config: CalculateL2DrawAndPrizeDistributionConfig,
  relayer?: Relayer
): Promise<ActionState | undefined> {
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

  //  Initialize BeaconChain contracts
  const drawBuffer = getContract('DrawBuffer', config.beaconChain.chainId, providerBeaconChain, contracts)
  const prizeTierHistory = getContract('PrizeTierHistory', config.beaconChain.chainId, providerBeaconChain, contracts)

  //  Initialize ReceiverChain contracts
  const prizeDistributionBufferL2 = getContract('PrizeDistributionBuffer', config.targetReceiverChain.chainId, providerTargetReceiverChain, contracts)
  const drawCalculatorTimelock = getContract('DrawCalculatorTimelock', config.targetReceiverChain.chainId, providerTargetReceiverChain, contracts)
  const l2TimelockTrigger = getContract('L2TimelockTrigger', config.targetReceiverChain.chainId, providerTargetReceiverChain, contracts)
  const ticketL2 = getContract('Ticket', config.targetReceiverChain.chainId, providerTargetReceiverChain, contracts)


  // TODO: throw error if any of the contracts is unavailable?
  if (!drawBuffer || !prizeTierHistory || !prizeDistributionBufferL2 || !drawCalculatorTimelock || !l2TimelockTrigger || !ticketL2) return undefined;

  //  Initialize Secondary ReceiverChain contracts
  let otherTicketContracts: Array<Contract | undefined> | undefined = config.otherTicketChains?.map(otherTicket => {
    return getContract('Ticket', otherTicket.chainId, getJsonRpcProvider(otherTicket.providerUrl), contracts)
  })

  try {
    let tx;
    let txRes;
    let status = 0;
    let response;
    let newestDraw
    let decimals = 18;
    let msg = 'L2TimelockTrigger/no-action-required';

    decimals = await ticketL2.decimals()
    newestDraw = await drawBuffer.getNewestDraw()

    /// L1 Prize Distribution (L1 Trigger)
    let lastPrizeDistributionDrawId = 0
    try {
      const { drawId } = await prizeDistributionBufferL2.getNewestPrizeDistribution()
      lastPrizeDistributionDrawId = drawId
    } catch (e) {
      debug(e)
    }

    const timelockElapsed = await drawCalculatorTimelock.hasElapsed()
    debug(`Last L2 PrizeDistribution Draw ID is ${lastPrizeDistributionDrawId}`)
    debug(lastPrizeDistributionDrawId)
    debug(newestDraw.drawId)
    debug(timelockElapsed)

    // If the prize distribution hasn't propagated and we're allowed to push
    const drawId = lastPrizeDistributionDrawId + 1;
    const draw = await drawBuffer.getDraw(drawId - 1)
    debug("Draw: ", draw)

    const prizeTier = await prizeTierHistory.getPrizeTier(drawId - 1)
    const endTimestampOffset = prizeTier.endTimestampOffset
    const startTimestampOffset = draw.beaconPeriodSeconds
    const startTime = draw.timestamp - startTimestampOffset
    const endTime = draw.timestamp - endTimestampOffset

    const L2TicketTotalSupply = await getMultiTicketAverageTotalSuppliesBetween([ticketL2], startTime, endTime)
    debug('L2TicketTotalSupply: ', L2TicketTotalSupply)
    if (!L2TicketTotalSupply || L2TicketTotalSupply.length === 0 && typeof L2TicketTotalSupply[0] === 'undefined') throw new Error('No L2 Ticket Total Supply')

    const totalSupplyOtherTickets = await getMultiTicketAverageTotalSuppliesBetween(otherTicketContracts, startTime, endTime)
    debug('totalSupplyOtherTickets', totalSupplyOtherTickets)

    if (totalSupplyOtherTickets && !totalSupplyOtherTickets[0]) throw new Error('No totalSupplyOtherTickets')

    // @ts-ignore
    const prizeDistribution = await computePrizeDistributionFromTicketAverageTotalSupplies(draw, prizeTier, BigNumber.from(L2TicketTotalSupply[0]), [totalSupplyOtherTickets[0]], decimals)
    debug("PrizeDistribution: ", prizeDistribution)
    if (!prizeDistribution) throw new Error('PrizeDistribution is undefined')

    debug("prizeDistribution: ", prizeDistribution)
    debug('prizeDistribution:prize', prizeDistribution.prize.toString())
    if (lastPrizeDistributionDrawId < newestDraw.drawId && timelockElapsed) {
      tx = await l2TimelockTrigger.populateTransaction.push(draw, prizeDistribution)
      // IF executable and Relayer is available.
      if (config.execute && relayer) {
        debug(`Pushing L2 prize distrubtion for draw ${drawId}...`)
        txRes = await relayer.sendTransaction({
          data: tx.data,
          to: draw.address,
          speed: 'fast',
          gasLimit: 500000,
        });
        response = await providerTargetReceiverChain.getTransaction(txRes.hash);
        debug(`Propagated prize distribution for draw ${draw} to L2: `, txRes.hash)
      }
      msg = 'L2TimelockTrigger/push-prize-distribution';
      status = 1;
    }

    return {
      err: false,
      msg,
      status,
      response,
      data: {
        newestDraw
      },
      transaction: {
        data: tx?.data,
        to: tx?.to,
      },
    }
  } catch (error) {
    debug(error)
    return {
      status: 0,
      err: error,
      msg: 'Error',
    }
  }
}
