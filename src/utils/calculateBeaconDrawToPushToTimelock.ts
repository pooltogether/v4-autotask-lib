import { Contract } from '@ethersproject/contracts';
const debug = require('debug')('pt-autotask-lib');

export async function calculateBeaconDrawToPushToTimelock(
  drawBufferBeaconChain: Contract,
  prizeDistributionBufferBeaconChain: Contract
) {
  let drawIdToFetch;
  let drawNewestFromBeaconChain;
  let lockAndPush: Boolean = false;
  let newestPrizeDistributionDrawId = 0;
  try {
    drawNewestFromBeaconChain = await drawBufferBeaconChain.getNewestDraw();
  } catch (error) {
    throw new Error('BeaconChain: DrawBuffer is not initialized');
  }

  try {
    const {
      drawId,
    } = await prizeDistributionBufferBeaconChain.getNewestPrizeDistribution();
    if (drawId > 0) {
      newestPrizeDistributionDrawId = drawId;
    }
  } catch (error) {
    newestPrizeDistributionDrawId = 0;
  }

  debug('DrawBuffer:newestDraw: ', drawNewestFromBeaconChain);
  debug(
    'PrizeDistributionBuffer:newestPrizeDistributionDrawId: ',
    newestPrizeDistributionDrawId
  );
  if (newestPrizeDistributionDrawId < drawNewestFromBeaconChain.drawId) {
    lockAndPush = true;
    drawIdToFetch = newestPrizeDistributionDrawId + 1;
  }

  return {
    lockAndPush,
    drawIdToFetch,
  };
}
