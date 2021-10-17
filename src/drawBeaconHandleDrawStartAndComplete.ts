import { ActionState, Config, ContractsBlob, Relayer } from './types'
import { getContract } from './get/getContract';
import { getInfuraProvider } from "./get/getInfuraProvider";

const debug = require('debug')('pt-autotask')

export async function drawBeaconHandleDrawStartAndComplete(contracts: ContractsBlob, config: Config, relayer?: Relayer): Promise<ActionState> {
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
    let response;
    let status = 0;
    msg = 'DrawBeacon/draw-not-started';

    // Action : Can Start Draw
    if (await drawBeacon.canStartDraw()) {
      tx = await drawBeacon.populateTransaction.startDraw()
      // IF executable and Relayer is available.
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

      // Populate Transation: encode data without submitting to provider.
      tx = await drawBeacon.populateTransaction.completeDraw()

      // IF executable and Relayer is available.
      if (config.execute && relayer) {
        debug(`Completing draw ${nextDrawId}...`)
        txRes = await relayer.sendTransaction({
          data: tx.data,
          to: tx.to,
          speed: config.speed,
          gasLimit: config.gasLimit,
        });
        response = await provider.getTransaction(txRes.hash);
        completedDraw = true;
        debug(`Completed Draw ${nextDrawId}: ${txRes.hash}`)
      }
      status = 1;
      msg = 'DrawBeacon/can-complete-draw';
    }

    return {
      status: status,
      err: false,
      msg: msg,
      response,
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