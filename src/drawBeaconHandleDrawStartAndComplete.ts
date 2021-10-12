import contracts from '@pooltogether/v4-testnet/testnet.json'
import { Config, ActionState, Relayer } from './types'
import { getContract } from './utils/getContract';
import { getInfuraProvider } from "./utils/getInfuraProvider";

const debug = require('debug')('pt-autotask')

export async function drawBeaconHandleDrawStartAndComplete(config: Config, relayer?: Relayer): Promise<ActionState> {
  const provider = getInfuraProvider(config.network, config.apiKey)
  const drawBeacon = getContract('DrawBeacon', config.chainId, provider, contracts);

  try {
    let msg;
    let completedDraw = false;
    const nextDrawId = await drawBeacon.getNextDrawId()
    const beaconPeriodStartedAt = await drawBeacon.getBeaconPeriodStartedAt()
    const isRngRequested = await drawBeacon.isRngRequested()
    const isBeaconPeriodOver = await drawBeacon.isRngRequested()
    const beaconPeriodSeconds = await drawBeacon.getBeaconPeriodSeconds()
    const canStartDraw = await drawBeacon.canStartDraw()
    const canCompleteDraw = await drawBeacon.canCompleteDraw()

    // Debug Contract Request Parameters
    debug('DrawBeacon next Draw.drawId:', nextDrawId)
    debug('DrawBeacon Beacon PeriodStartedAt:', beaconPeriodStartedAt.toString())
    debug('DrawBeacon Beacon PeriodSeconds:', beaconPeriodSeconds.toString())
    debug('DrawBeacon Beacon PeriodOver:', isBeaconPeriodOver)
    debug('Is RNG Requested:', isRngRequested)
    debug('Can Start Draw:', canStartDraw)
    debug('Can Complete Draw:', canCompleteDraw)

    let tx;
    let txRes;
    let status = 0;
    msg = 'DrawBeacon/draw-in-progress';

    // Action : Can Start Draw
    if (await drawBeacon.canStartDraw()) {
      tx = await drawBeacon.populateTransaction.startDraw()
      if (config.execute && relayer) {
        debug(`Starting draw ${nextDrawId}...`)
        txRes = await relayer.sendTransaction({
          data: tx.data,
          to: tx.to,
          speed: config.speed,
          gasLimit: config.gasLimit,
        });
        debug(`Started Draw ${nextDrawId}: ${txRes.hash}`)
      }
      status = 1;
      msg = 'DrawBeacon/can-start-draw';
    }

    // Action : Can Complete Draw
    if (await drawBeacon.canCompleteDraw()) {
      tx = await drawBeacon.populateTransaction.completeDraw()
      if (config.execute && relayer) {
        debug(`Completing draw ${nextDrawId}...`)
        txRes = await relayer.sendTransaction({
          data: tx.data,
          to: tx.to,
          speed: config.speed,
          gasLimit: config.gasLimit,
        });
        completedDraw = true;
        debug(`Completed Draw ${nextDrawId}: ${txRes.hash}`)
      }
      status = 1;
      msg = 'DrawBeacon/can-complete-draw';
    }

    return {
      status: status, // 0 or 1
      err: false,
      msg: msg,
      transaction: {
        data: tx?.data,
        to: tx?.to,
      },
      data: {
        isBeaconPeriodOver: isBeaconPeriodOver.toString(),
        beaconPeriodSeconds: beaconPeriodSeconds.toString(),
        canStartDraw,
        canCompleteDraw,
        isRngRequested,
        completedDraw,
      },
    }
  } catch (error) {
    return {
      status: -1,
      err: error,
      msg: 'DrawBeacon/error',
    }
  }

}