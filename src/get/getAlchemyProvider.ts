import { ethers } from 'ethers';

export function getAlchemyProvider(
  network: ethers.providers.Networkish | undefined,
  apiKey: string
) {
  return new ethers.providers.AlchemyProvider(network, apiKey);
}
