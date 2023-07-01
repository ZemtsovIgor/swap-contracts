import chai, { expect } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { ethers, upgrades } from 'hardhat';
import TokenConfig from '../config/TokenConfig';
import { TokenContractType } from '../lib/ContractProvider';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {InitializeArguments} from "../config/ContractArguments";

chai.use(ChaiAsPromised);

describe('TBCCFinanceFeeHandler Deploy', function () {
  let owner!: SignerWithAddress;
  let holder!: SignerWithAddress;
  let externalUser!: SignerWithAddress;
  let contract!: TokenContractType;

  before(async function () {
    [owner, holder, externalUser] = await ethers.getSigners();
  });

  it('Contract proxy deployment', async function () {
    const Contract = await ethers.getContractFactory('TBCCFinanceFeeHandler');
    contract = await upgrades.deployProxy(Contract, [...InitializeArguments], {
      initializer: "initialize",
      kind: "uups",
    });
    await contract.deployed();
  });

  it('retrieve returns a value previously initialized', async function () {
    expect((await contract.tbcc()).toString()).to.equal(TokenConfig.tbcc);
    expect((await contract.tbccFinanceSwapRouter()).toString()).to.equal(TokenConfig.tbccFinanceSwapRouter);
    expect((await contract.operatorAddress()).toString()).to.equal(TokenConfig.operatorAddress);
    expect((await contract.tbccBurnAddress()).toString()).to.equal(TokenConfig.tbccBurnAddress);
    expect((await contract.tbccVaultAddress()).toString()).to.equal(TokenConfig.tbccVaultAddress);
    expect((await contract.tbccBurnRate()).toString()).to.equal(TokenConfig.tbccBurnRate);
  });
});
