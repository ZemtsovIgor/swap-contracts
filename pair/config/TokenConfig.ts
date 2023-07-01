import TokenConfigInterface from '../lib/TokenConfigInterface';
import * as Networks from '../lib/Networks';

const TokenConfig: TokenConfigInterface = {
  testnet: Networks.bscTestnet,
  mainnet: Networks.bscMainnet,
  contractName: 'TBCCFinancePair',
  contractAddress: '0xC2008Fc7850c71E32b218e0c07D09376b9602AE0'
};

export default TokenConfig;
