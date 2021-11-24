import { ethers } from 'ethers';
import { ActionState, ConfigWithL2, ContractsBlob, Relayer } from './types'
import { getContract } from './get/getContract';
import { getJsonRpcProvider } from "./get/getJsonRpcProvider";
import { computePrizeDistribution } from './utils/computePrizeDistribution';
const debug = require('debug')('pt-autotask-lib')

export async function L2DrawAndPrizeDistributionPush(contracts: ContractsBlob, config: ConfigWithL2, relayer?: Relayer): Promise<ActionState | undefined> {
  let providerL1;
  if (config?.L1?.providerUrl) {
    providerL1 = getJsonRpcProvider(config?.L1?.providerUrl)
  }

  let providerL2;
  if (config?.L2?.providerUrl) {
    providerL2 = getJsonRpcProvider(config?.L2?.providerUrl)
  }

  if (!providerL1 || !providerL2) {
    return undefined
  }

  // INITIALIZE Contracts
  const drawBuffer = getContract('DrawBuffer', config.L1.chainId, providerL1, contracts)
  const prizeDistributionBufferL2 = getContract('PrizeDistributionBuffer', config.L2.chainId, providerL2, contracts)
  const drawCalculatorTimelock = getContract('DrawCalculatorTimelock', config.L2.chainId, providerL2, contracts)
  const l2TimelockTrigger = getContract('L2TimelockTrigger', config.L2.chainId, providerL2, contracts)
  const ticketL1 = getContract('Ticket', config.L1.chainId, providerL1, contracts)
  const ticketL2 = getContract('Ticket', config.L2.chainId, providerL2, contracts)
  const prizeTierHistory = getContract('PrizeTierHistory', config.L1.chainId, providerL1, contracts)

  try {
    let tx;
    let txRes;
    let status = 0;
    let response;
    let newestDraw
    let msg = 'L2TimelockTrigger/no-action-required';

    newestDraw = await drawBuffer.getNewestDraw()
    const totalSupplyTickets = (await ticketL2.totalSupply()).add(await ticketL1.totalSupply())
    const decimals = await ticketL2.decimals()
    debug(`Total supply of tickets: ${ethers.utils.formatUnits(totalSupplyTickets, decimals)}`)

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
    const draw = await drawBuffer.getDraw(drawId)
    debug("Draw: ", draw)

    const prizeDistribution = await computePrizeDistribution(
      draw,
      prizeTierHistory,
      ticketL2,
      ticketL1
    )

    debug("PrizeDistribution: ", prizeDistribution)
    console.log('PRIZE', prizeDistribution.prize.toString())
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
        response = await providerL2.getTransaction(txRes.hash);
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
