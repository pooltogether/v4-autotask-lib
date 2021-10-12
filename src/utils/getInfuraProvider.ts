import { ethers } from 'ethers'

export function getInfuraProvider(network: ethers.providers.Networkish | undefined, apiKey: string | undefined) {
  return new ethers.providers.InfuraProvider(network, apiKey)
}

export default getInfuraProvider;