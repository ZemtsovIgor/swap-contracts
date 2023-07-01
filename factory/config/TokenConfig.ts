import TokenConfigInterface from '../lib/TokenConfigInterface';
import * as Networks from '../lib/Networks';

const TokenConfig: TokenConfigInterface = {
  testnet: Networks.bscTestnet,
  mainnet: Networks.bscMainnet,
  contractName: 'TBCCFinanceFactory',
  feeToSetter: '0x447E77Cb651Ba486D59E3a024D2793f6c6B96510',
  contractAddress: '0x864741961F7e895A48aBf3e90e2EB9caD0E58EAC'
};

export default TokenConfig;
