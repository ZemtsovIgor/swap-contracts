import { assert } from "chai";
import { parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";

const MockERC20 = artifacts.require("./test/MockERC20.sol");
const TBCCFinanceFactory = artifacts.require("./TBCCFinanceFactory.sol");
const TBCCFinancePair = artifacts.require("./TBCCFinancePair.sol");
const WBNB = artifacts.require("./test/WBNB.sol");

contract("TBCCFinanceFactory", ([alice, bob, carol, david, erin]) => {
  let pairAB;
  let pairBC;
  let pairAC;
  let tbccFinanceFactory;
  let tokenA;
  let tokenC;
  let wrappedBNB;

  before(async () => {
    // Deploy Factory
    tbccFinanceFactory = await TBCCFinanceFactory.new(alice, { from: alice });

    // Deploy Wrapped BNB
    wrappedBNB = await WBNB.new({ from: alice });

    // Deploy ERC20s
    tokenA = await MockERC20.new("Token A", "TA", parseEther("10000000"), {
      from: alice,
    });
    tokenC = await MockERC20.new("Token C", "TC", parseEther("10000000"), {
      from: alice,
    });

    // Create 3 LP tokens
    let result = await tbccFinanceFactory.createPair(
      tokenA.address,
      wrappedBNB.address,
      { from: alice }
    );
    pairAB = await TBCCFinancePair.at(result.logs[0].args[2]);

    result = await tbccFinanceFactory.createPair(
      wrappedBNB.address,
      tokenC.address,
      { from: alice }
    );
    pairBC = await TBCCFinancePair.at(result.logs[0].args[2]);

    result = await tbccFinanceFactory.createPair(
      tokenA.address,
      tokenC.address,
      { from: alice }
    );
    pairAC = await TBCCFinancePair.at(result.logs[0].args[2]);

    assert.equal(
      String(await pairAB.totalSupply()),
      parseEther("0").toString()
    );
    assert.equal(
      String(await pairBC.totalSupply()),
      parseEther("0").toString()
    );
    assert.equal(
      String(await pairAC.totalSupply()),
      parseEther("0").toString()
    );

    // Mint and approve all contracts
    for (const thisUser of [alice, bob, carol, david, erin]) {
      await tokenA.mintTokens(parseEther("2000000"), { from: thisUser });
      await tokenC.mintTokens(parseEther("2000000"), { from: thisUser });
    }
  });
});
