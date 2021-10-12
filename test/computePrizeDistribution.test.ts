import { L1SyncAutotask } from '../src';
import { utils } from '../src';
import { Relayer } from './mocks/Relayer'

describe('computePrizeDistribution', () => {

  it('should succeed to connect and push new Draw and PrizeDistribution parameters to L1TimeLockTrigger', async () => {
    expect(await L1SyncAutotask.L1PrizeDistributionPush(
      {
        network: 'rinkeby',
        chainId: 4,
        apiKey: process.env.INFURA_API_KEY,
        L1: {
          chainId: 4,
          network: 'rinkeby',
        },
        L2: {
          chainId: 80001,
          network: 'mumbai',
        }
      },
      Relayer
    ))
      .toMatchObject({
        err: false
      });
  });
});
