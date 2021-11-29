import { L2DrawAndPrizeDistributionPush } from '../src';
import { Relayer } from './mocks/Relayer'
import { CalculateL2DrawAndPrizeDistributionConfig } from '../src/types'
import contractsBlob from './contracts.json'
jest.setTimeout(10000); // 10 second

describe('L2DrawAndPrizeDistributionPush', () => {
  it('should succeed to connect to the network and verify the DrawBeacon status', async () => {

    const config: CalculateL2DrawAndPrizeDistributionConfig = {
      beaconChain: {
        chainId: 4,
        providerUrl: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      },
      targetReceiverChain: {
        chainId: 80001,
        providerUrl: `https://polygon-mumbai.infura.io/v3/b81e24d29d1942b8bf04bf3c81ae3761`,
      },
      otherTicketChains: [
        {
          chainId: 4,
          providerUrl: `https://rinkeby.infura.io/v3/b81e24d29d1942b8bf04bf3c81ae3761`,
        }
      ]
    }

    const autotask = await L2DrawAndPrizeDistributionPush(
      contractsBlob,
      config,
      Relayer
    )

    console.log(autotask, 'autotask')

    expect(autotask).toBeTruthy();
  })
})