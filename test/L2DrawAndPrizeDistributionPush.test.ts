import { drawBeaconHandleDrawStartAndComplete } from '../src';
import { Relayer } from './mocks/Relayer'

describe('drawBeaconHandleDrawStartAndComplete', () => {
  it('should succeed to connect to the network and verify the DrawBeacon status', async () => {

    expect(await drawBeaconHandleDrawStartAndComplete(
      { network: 'rinkeby', chainId: 4, apiKey: process.env.INFURA_API_KEY },
      Relayer
    ))
      .toMatchObject({
        err: false
      });
  });
});
