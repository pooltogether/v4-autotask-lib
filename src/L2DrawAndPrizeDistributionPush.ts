import { ethers } from 'ethers';
import { ActionState, ConfigWithL2, ContractsBlob, Relayer } from './types'
import { getContract } from './get/getContract';
import { getInfuraProvider } from "./get/getInfuraProvider";
import { getJsonRpcProvider } from "./get/getJsonRpcProvider";
import { computePrizeDistribution } from './utils/computePrizeDistribution';
const debug = require('debug')('pt-autotask')

export async function L2DrawAndPrizeDistributionPush(contracts: ContractsBlob, config: ConfigWithL2, relayer?: Relayer): Promise<ActionState> {
  // Connects to Infura provider. 
  const providerL1 = getInfuraProvider(config.L1.network, config.apiKey)
  const providerL2 = getJsonRpcProvider(`https://${config.L2.network}.infura.io/v3/${config.apiKey}`)

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
    if (lastPrizeDistributionDrawId < newestDraw.drawId && timelockElapsed) {
      const drawId = lastPrizeDistributionDrawId + 1
      const draw = await drawBuffer.getDraw(drawId)
      debug("Draw: ", draw)

      const prizeDistribution = await computePrizeDistribution(
        draw,
        prizeTierHistory,
        ticketL1,
        ticketL2
      )

      debug("PrizeDistribution: ", prizeDistribution)

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
