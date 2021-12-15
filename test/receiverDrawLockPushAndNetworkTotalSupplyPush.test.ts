import { receiverDrawLockAndNetworkTotalSupplyPush } from '../src/receiverDrawLockAndNetworkTotalSupplyPush';
import contractsBlob from './contracts.json';
jest.setTimeout(10000); // 10 second

describe('receiverDrawLockPushAndNetworkTotalSupplyPush', () => {
  it('should succeed to connect to the network and verify the DrawBeacon status', async () => {
    const config = {
      beaconChain: {
        chainId: 4,
        providerUrl: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      },
      targetReceiverChain: {
        chainId: 80001,
        providerUrl: `https://polygon-mumbai.infura.io/v3/b81e24d29d1942b8bf04bf3c81ae3761`,
      },
      allPrizePoolNetworkChains: [
        {
          chainId: 4,
          providerUrl: `https://rinkeby.infura.io/v3/b81e24d29d1942b8bf04bf3c81ae3761`,
        },
        {
          chainId: 80001,
          providerUrl: `https://polygon-mumbai.infura.io/v3/b81e24d29d1942b8bf04bf3c81ae3761`,
        },
      ],
    };

    const transaction = await receiverDrawLockAndNetworkTotalSupplyPush(
      contractsBlob,
      config
    );

    expect(transaction).toBeTruthy();
  });
});
