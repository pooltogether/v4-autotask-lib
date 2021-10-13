// @ts-ignore
import { ethers } from 'ethers';
import contracts from '@pooltogether/v4-testnet/testnet.json'
import { ActionState, Relayer } from './types'
import getContract from './utils/getContract';
import getInfuraProvider from "./utils/getInfuraProvider";
import computePrizeDistribution from './utils/computePrizeDistribution';
const debug = require('debug')('pt-autotask')

interface L1PrizeDistributionPushConfig {
  chainId: number;
  network: string;
  apiKey: string | undefined;
  speed?: "slow" | "normal" | "fast";
  gasLimit?: number | string;
  execute?: Boolean;
  L1: {
    chainId: number;
    network: string;
  },
  L2: {
    chainId: number;
    network: string;
  }
}

export async function L1PrizeDistributionPush(config: L1PrizeDistributionPushConfig, relayer: Relayer): Promise<ActionState> {
  // Connects to Infura provider. @TODO // Handle support for multiple networks if neccesary
  const provider = getInfuraProvider(config.network, config.apiKey)

  // INITIALIZE Contracts
  const drawBuffer = getContract('DrawBuffer', config.L1.chainId, provider, contracts)
  const prizeDistributionBuffer = getContract('PrizeDistributionBuffer', config.L1.chainId, provider, contracts)
  const drawCalculatorTimelock = getContract('DrawCalculatorTimelock', config.L1.chainId, provider, contracts)
  const l1TimelockTrigger = getContract('L1TimelockTrigger', config.L1.chainId, provider, contracts)
  const ticketL1 = getContract('Ticket', config.L1.chainId, provider, contracts)
  const ticketL2 = getContract('Ticket', config.L2.chainId, provider, contracts)
  const prizeTierHistory = getContract('PrizeTierHistory', config.L1.chainId, provider, contracts)

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

    const timelockElapsed = await drawCalculatorTimelock.hasElapsed()
    debug(`Last L1 prize distribution draw id is ${lastPrizeDistributionDrawId}`)

    // If the prize distribution hasn't propagated and we're allowed to push
    if (lastPrizeDistributionDrawId < newestDraw.drawId && timelockElapsed) {
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
          to: draw.address,
          speed: 'fast',
          gasLimit: 500000,
        });
        status = 1;
        msg = 'L1PrizeDistributionPush/pushed'
        response = await provider.getTransaction(txRes.hash);
        debug(`Propagated prize distribution for draw ${draw.drawId} to L1: `, txRes.hash)
      }
    }

    return {
      err: false,
      msg,
      status,
      response,
      transaction: {
        data: tx?.data,
        to: tx?.to,
      },
      data: {
        newestDraw
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