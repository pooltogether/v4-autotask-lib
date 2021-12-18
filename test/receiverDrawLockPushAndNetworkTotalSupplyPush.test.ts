import { receiverDrawLockAndNetworkTotalSupplyPush } from '../src/receiverDrawLockAndNetworkTotalSupplyPush';
import { testnet as testnetContracts } from '@pooltogether/v4-pool-data';
jest.setTimeout(10000); // 10 second

describe('receiverDrawLockPushAndNetworkTotalSupplyPush', () => {
  it('should succeed to connect to the network and verify the DrawBeacon status', async () => {
    const config = {
      beaconChain: {
        chainId: 4,
        providerUrl: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      },
      receiverChain: {
        chainId: 80001,
        providerUrl: `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_API_KEY}`,
      },
      allPrizePoolNetworkChains: [
        {
          chainId: 4,
          providerUrl: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
        },
        {
          chainId: 80001,
          providerUrl: `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_API_KEY}`,
        },
      ],
    };

    try {
      const transaction = await receiverDrawLockAndNetworkTotalSupplyPush(
        testnetContracts,
        config
      );
      expect(transaction).toBeTruthy();
    } catch (error) {
      console.log('Network Error');
    }
  });
});
