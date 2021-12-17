import { Contract } from '@ethersproject/contracts';

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

  if (newestPrizeDistributionDrawId < drawNewestFromBeaconChain.drawId) {
    lockAndPush = true;
    drawIdToFetch = newestPrizeDistributionDrawId + 1;
    console.log('DrawBuffer Newest Draw: ', drawNewestFromBeaconChain);
    console.log(
      'PrizeDistributionBuffer newest PrizeDistribution DrawID: ',
      newestPrizeDistributionDrawId
    );
  }

  return {
    lockAndPush,
    drawIdToFetch,
  };
}
