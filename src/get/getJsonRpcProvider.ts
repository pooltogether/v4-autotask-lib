import { JsonRpcProvider } from '@ethersproject/providers';

export function getJsonRpcProvider(url: string) {
  return new JsonRpcProvider(url);
}

export default getJsonRpcProvider;
