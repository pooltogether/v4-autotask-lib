import { ethers } from 'ethers';
import { ActionState, ConfigWithL2, ContractsBlob, Relayer } from './types'
import { getContract } from './get/getContract';
import { getInfuraProvider } from "./get/getInfuraProvider";
import { getJsonRpcProvider } from "./get/getJsonRpcProvider";
import { computePrizeDistribution } from './utils/computePrizeDistribution';
const debug = require('debug')('pt-autotask')

export async function L1PrizeDistributionPush(contracts: ContractsBlob, config: ConfigWithL2, relayer?: Relayer): Promise<ActionState> {
  // Connects to Infura provider.
  const providerL1 = getInfuraProvider(config.L1.network, config.apiKey)
  const providerL2 = getJsonRpcProvider(`https://${config.L2.network}.infura.io/v3/${config.apiKey}`)

  // INITIALIZE Contracts
  const drawBuffer = getContract('DrawBuffer', config.L1.chainId, providerL1, contracts)
  const prizeDistributionBuffer = getContract('PrizeDistributionBuffer', config.L1.chainId, providerL1, contracts)
  const drawCalculatorTimelock = getContract('DrawCalculatorTimelock', config.L1.chainId, providerL1, contracts)
  const l1TimelockTrigger = getContract('L1TimelockTrigger', config.L1.chainId, providerL1, contracts)
  const ticketL1 = getContract('Ticket', config.L1.chainId, providerL1, contracts)
  const ticketL2 = getContract('Ticket', config.L2.chainId, providerL2, contracts)
  const prizeTierHistory = getContract('PrizeTierHistory', config.L1.chainId, providerL1, contracts)

  try {
    let tx;
    let txRes;
    let status = 0;
    let response;
    let newestDraw
    let msg = 'L1TimelockTrigger/no-action-required';

    newestDraw = await drawBuffer.getNewestDraw()
    const totalSupplyTickets = (await ticketL2.totalSupply()).add(await ticketL1.totalSupply())
    const decimals = await ticketL2.decimals()
    debug(`Total supply of tickets: ${ethers.utils.formatUnits(totalSupplyTickets, decimals)}`)

    /// L1 Prize Distribution (L1 Trigger)
    let lastPrizeDistributionDrawId = 0
    try {
      const { drawId } = await prizeDistributionBuffer.getNewestPrizeDistribution()
      lastPrizeDistributionDrawId = drawId
    } catch (e) { }

    const getTimelock = await drawCalculatorTimelock.getTimelock()
    const getTimelockDuration = await drawCalculatorTimelock.getTimelockDuration()
    const hasElapsed = await drawCalculatorTimelock.hasElapsed()
    debug(`Last L1 prize distribution draw id is ${lastPrizeDistributionDrawId}`)

    debug(`Last PrizeDistribution Draw ID: ${lastPrizeDistributionDrawId}`)
    debug(`Newest DrawID: ${newestDraw.drawId} `);
    debug(`Lock Elapsed: ${hasElapsed} `);
    debug(`Timelock: ${getTimelock}`);
    debug(`Timelock Duration: ${getTimelockDuration} `);

    // If the prize distribution hasn't propagated and we're allowed to push
    if (lastPrizeDistributionDrawId < newestDraw.drawId) {
      const drawId = lastPrizeDistributionDrawId + 1
      const draw = await drawBuffer.getDraw(drawId)
      const prizeDistribution = await computePrizeDistribution(
        draw,
        prizeTierHistory,
        ticketL1,
        ticketL2,
        totalSupplyTickets,
        decimals
      )

      // IF executable and Relayer is available.
      tx = await l1TimelockTrigger.populateTransaction.push(draw.drawId, prizeDistribution)

      if (config.execute && relayer) {
        debug(`Pushing L1 prize distrubtion for draw ${drawId}...`)
        txRes = await relayer.sendTransaction({
          data: tx.data,
          to: tx.data,
          speed: 'fast',
          gasLimit: 500000,
        });
        status = 1;
        msg = 'L1PrizeDistributionPush/pushed'
        response = await providerL1.getTransaction(txRes.hash);
        debug(`Propagated prize distribution for draw ${draw.drawId} to L1: `, txRes.hash)
      }
      status = 1;
      msg = 'L1PrizeDistributionPush/push-prize-distribution'
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

export default L1PrizeDistributionPush