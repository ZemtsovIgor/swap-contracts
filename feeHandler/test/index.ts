import { assert } from "chai";
import {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
  // @ts-ignore
} from "@openzeppelin/test-helpers";
import { formatUnits, parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";

const TBCCFinanceFeeHandler = artifacts.require("./TBCCFinanceFeeHandler.sol");

const MockERC20 = artifacts.require("./test/MockERC20.sol");
const TBCCFinanceFactory = artifacts.require("./test/TBCCFinanceFactory.sol");
const TBCCFinancePair = artifacts.require("./test/TBCCFinancePair.sol");
const TBCCFinanceRouter = artifacts.require("./test/TBCCFinanceRouter.sol");
const TBCCFinanceZapV1 = artifacts.require("./test/TBCCFinanceZapV1.sol");
const WBNB = artifacts.require("./test/WBNB.sol");

contract("TBCCFinanceFeeHandler", ([alice, bob, carol, david, erin]) => {
  let maxZapReverseRatio: any;
  let pairAB: any;
  let pairBC: any;
  let pairAC: any;
  let tbccFinanceZap: any;
  let tbccFinanceFactory: any;
  let tbccFinanceRouter: any;
  let tbccFinanceFeeHandler: any;
  let tokenA: any;
  let tokenC: any;
  let wrappedBNB: any;
  const burnRate: string = "900000";

  before(async () => {
    // Deploy Factory
    tbccFinanceFactory = await TBCCFinanceFactory.new(alice, { from: alice });

    // Deploy Wrapped BNB
    wrappedBNB = await WBNB.new({ from: alice });

    // Deploy Router
    tbccFinanceRouter = await TBCCFinanceRouter.new(
      tbccFinanceFactory.address,
      wrappedBNB.address,
      { from: alice }
    );

    // Deploy ZapV1
    maxZapReverseRatio = 100; // 1%
    tbccFinanceZap = await TBCCFinanceZapV1.new(
      wrappedBNB.address,
      tbccFinanceRouter.address,
      maxZapReverseRatio,
      { from: alice }
    );
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

    // Deploy FeeHandler
    tbccFinanceFeeHandler = await TBCCFinanceFeeHandler.new({ from: alice });

    await tbccFinanceFeeHandler.initialize(
      wrappedBNB.address,
      tokenA.address,
      tbccFinanceRouter.address,
      bob,
      carol,
      david,
      burnRate,
      erin,
      { from: alice }
    );

    // Setting fee to
    await tbccFinanceFactory.setFeeTo(tbccFinanceFeeHandler.address, {
      from: alice,
    });

    assert.equal(
      String(await tbccFinanceFactory.feeTo()),
      tbccFinanceFeeHandler.address
    );

    // Mint and approve all contracts
    for (const thisUser of [alice, bob, carol, david, erin]) {
      await tokenA.mintTokens(parseEther("2000000"), { from: thisUser });
      await tokenC.mintTokens(parseEther("2000000"), { from: thisUser });

      await tokenA.approve(tbccFinanceRouter.address, constants.MAX_UINT256, {
        from: thisUser,
      });

      await tokenA.approve(tbccFinanceZap.address, constants.MAX_UINT256, {
        from: thisUser,
      });

      await tokenC.approve(tbccFinanceRouter.address, constants.MAX_UINT256, {
        from: thisUser,
      });

      await tokenC.approve(tbccFinanceZap.address, constants.MAX_UINT256, {
        from: thisUser,
      });

      await wrappedBNB.approve(
        tbccFinanceRouter.address,
        constants.MAX_UINT256,
        { from: thisUser }
      );

      await wrappedBNB.approve(tbccFinanceZap.address, constants.MAX_UINT256, {
        from: thisUser,
      });

      await pairAB.approve(tbccFinanceZap.address, constants.MAX_UINT256, {
        from: thisUser,
      });

      await pairBC.approve(tbccFinanceZap.address, constants.MAX_UINT256, {
        from: thisUser,
      });

      await pairAC.approve(tbccFinanceZap.address, constants.MAX_UINT256, {
        from: thisUser,
      });
    }
  });
  describe("Normal cases for liquidity provision and zap ins", async () => {
    it("User adds liquidity to LP tokens", async function () {
      const deadline = new BN(await time.latest()).add(new BN("100"));

      /* Add liquidity (TBCC Finance Router)
       * address tokenB,
       * uint256 amountADesired,
       * uint256 amountBDesired,
       * uint256 amountAMin,
       * uint256 amountBMin,
       * address to,
       * uint256 deadline
       */

      // 1 A = 1 C
      let result = await tbccFinanceRouter.addLiquidity(
        tokenC.address,
        tokenA.address,
        parseEther("1000000"), // 1M token A
        parseEther("1000000"), // 1M token B
        parseEther("1000000"),
        parseEther("1000000"),
        bob,
        deadline,
        { from: bob }
      );

      expectEvent.inTransaction(
        result.receipt.transactionHash,
        tokenA,
        "Transfer",
        {
          from: bob,
          to: pairAC.address,
          value: parseEther("1000000").toString(),
        }
      );

      expectEvent.inTransaction(
        result.receipt.transactionHash,
        tokenC,
        "Transfer",
        {
          from: bob,
          to: pairAC.address,
          value: parseEther("1000000").toString(),
        }
      );

      assert.equal(
        String(await pairAC.totalSupply()),
        parseEther("1000000").toString()
      );
      assert.equal(
        String(await tokenA.balanceOf(pairAC.address)),
        parseEther("1000000").toString()
      );
      assert.equal(
        String(await tokenC.balanceOf(pairAC.address)),
        parseEther("1000000").toString()
      );

      // 1 BNB = 100 A
      result = await tbccFinanceRouter.addLiquidityETH(
        tokenA.address,
        parseEther("100000"), // 100k token A
        parseEther("100000"), // 100k token A
        parseEther("1000"), // 1,000 BNB
        bob,
        deadline,
        { from: bob, value: parseEther("1000").toString() }
      );

      expectEvent.inTransaction(
        result.receipt.transactionHash,
        tokenA,
        "Transfer",
        {
          from: bob,
          to: pairAB.address,
          value: parseEther("100000").toString(),
        }
      );

      assert.equal(
        String(await pairAB.totalSupply()),
        parseEther("10000").toString()
      );
      assert.equal(
        String(await wrappedBNB.balanceOf(pairAB.address)),
        parseEther("1000").toString()
      );
      assert.equal(
        String(await tokenA.balanceOf(pairAB.address)),
        parseEther("100000").toString()
      );

      // 1 BNB = 100 C
      result = await tbccFinanceRouter.addLiquidityETH(
        tokenC.address,
        parseEther("100000"), // 100k token C
        parseEther("100000"), // 100k token C
        parseEther("1000"), // 1,000 BNB
        bob,
        deadline,
        { from: bob, value: parseEther("1000").toString() }
      );

      expectEvent.inTransaction(
        result.receipt.transactionHash,
        tokenC,
        "Transfer",
        {
          from: bob,
          to: pairBC.address,
          value: parseEther("100000").toString(),
        }
      );

      assert.equal(
        String(await pairBC.totalSupply()),
        parseEther("10000").toString()
      );
      assert.equal(
        String(await wrappedBNB.balanceOf(pairBC.address)),
        parseEther("1000").toString()
      );
      assert.equal(
        String(await tokenC.balanceOf(pairBC.address)),
        parseEther("100000").toString()
      );
    });

    it("User completes zapIn with tokenA (pair tokenA/tokenC)", async function () {
      const lpToken = pairAC.address;
      const tokenToZap = tokenA.address;
      const tokenAmountIn = parseEther("1");

      const estimation = await tbccFinanceZap.estimateZapInSwap(
        tokenToZap,
        parseEther("1"),
        lpToken
      );
      assert.equal(estimation[2], tokenC.address);

      // Setting up slippage at 0.5%
      const minTokenAmountOut = new BN(estimation[1].toString())
        .mul(new BN("9995"))
        .div(new BN("10000"));

      const result = await tbccFinanceZap.zapInToken(
        tokenToZap,
        tokenAmountIn,
        lpToken,
        minTokenAmountOut,
        { from: carol }
      );

      expectEvent(result, "ZapIn", {
        tokenToZap: tokenToZap,
        lpToken: lpToken,
        tokenAmountIn: parseEther("1").toString(),
        lpTokenAmountReceived: parseEther("0.499373703204732474").toString(),
        user: carol,
      });

      expectEvent.inTransaction(
        result.receipt.transactionHash,
        pairAC,
        "Transfer",
        {
          from: constants.ZERO_ADDRESS,
          to: carol,
          value: parseEther("0.499373703204732474").toString(),
        }
      );

      assert.equal(
        String(await pairAC.balanceOf(carol)),
        parseEther("0.499373703204732474").toString()
      );
      console.info(
        "Balance tokenA: " +
          formatUnits(
            String(await tokenA.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance WBNB: " +
          formatUnits(
            String(await wrappedBNB.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance tokenC: " +
          formatUnits(
            String(await tokenC.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
    });

    it("User completes zapIn with BNB (pair BNB/tokenC)", async function () {
      const lpToken = pairBC.address;
      const tokenAmountIn = parseEther("1");

      const estimation = await tbccFinanceZap.estimateZapInSwap(
        wrappedBNB.address,
        parseEther("1"),
        lpToken
      );
      assert.equal(estimation[2], tokenC.address);

      // Setting up slippage at 0.5%
      const minTokenAmountOut = new BN(estimation[1].toString())
        .mul(new BN("9995"))
        .div(new BN("10000"));

      const result = await tbccFinanceZap.zapInBNB(lpToken, minTokenAmountOut, {
        from: carol,
        value: tokenAmountIn.toString(),
      });

      expectEvent(result, "ZapIn", {
        tokenToZap: constants.ZERO_ADDRESS,
        lpToken: lpToken,
        tokenAmountIn: parseEther("1").toString(),
        lpTokenAmountReceived: parseEther("4.992494115555979119").toString(),
        user: carol,
      });

      console.info(
        "Balance tokenA: " +
          formatUnits(
            String(await tokenA.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance WBNB: " +
          formatUnits(
            String(await wrappedBNB.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance tokenC: " +
          formatUnits(
            String(await tokenC.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
    });

    it("User completes zapInRebalancing with BNB (pair BNB/tokenC)", async function () {
      const lpToken = pairBC.address;
      const token0AmountIn = parseEther("1"); // 1 BNB
      const token1AmountIn = parseEther("50"); // 50 token C

      const estimation = await tbccFinanceZap.estimateZapInRebalancingSwap(
        wrappedBNB.address,
        tokenC.address,
        token0AmountIn,
        token1AmountIn,
        lpToken
      );

      assert.equal(estimation[2], true);

      // Setting up slippage at 2x 0.5%
      const minTokenAmountOut = new BN(estimation[1].toString())
        .mul(new BN("9995"))
        .div(new BN("10000"));
      const maxTokenAmountIn = new BN(estimation[0].toString())
        .mul(new BN("10005"))
        .div(new BN("10000"));

      const result = await tbccFinanceZap.zapInBNBRebalancing(
        tokenC.address,
        token1AmountIn,
        lpToken,
        maxTokenAmountIn,
        minTokenAmountOut,
        estimation[2],
        {
          from: carol,
          value: token0AmountIn.toString(),
        }
      );

      expectEvent(result, "ZapInRebalancing", {
        token0ToZap: constants.ZERO_ADDRESS,
        token1ToZap: tokenC.address,
        lpToken: lpToken,
        token0AmountIn: token0AmountIn.toString(),
        token1AmountIn: token1AmountIn.toString(),
        lpTokenAmountReceived: parseEther("7.495313513075342927").toString(),
        user: carol,
      });

      console.info(
        "Balance tokenA: " +
          formatUnits(
            String(await tokenA.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance WBNB: " +
          formatUnits(
            String(await wrappedBNB.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance tokenC: " +
          formatUnits(
            String(await tokenC.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
    });

    it("User completes zapInRebalancing with tokens (tokenA/tokenC)", async function () {
      const lpToken = pairAC.address;
      const token0AmountIn = parseEther("1000"); // 1000 token A
      const token1AmountIn = parseEther("5000"); // 5000 token C

      const estimation = await tbccFinanceZap.estimateZapInRebalancingSwap(
        tokenA.address,
        tokenC.address,
        token0AmountIn,
        token1AmountIn,
        lpToken
      );

      assert.equal(estimation[2], false);

      // Setting up slippage at 2x 0.5%
      const minTokenAmountOut = new BN(estimation[1].toString())
        .mul(new BN("9995"))
        .div(new BN("10000"));
      const maxTokenAmountIn = new BN(estimation[0].toString())
        .mul(new BN("10005"))
        .div(new BN("10000"));

      const result = await tbccFinanceZap.zapInTokenRebalancing(
        tokenA.address,
        tokenC.address,
        token0AmountIn,
        token1AmountIn,
        lpToken,
        maxTokenAmountIn,
        minTokenAmountOut,
        estimation[2],
        {
          from: carol,
        }
      );

      expectEvent(result, "ZapInRebalancing", {
        token0ToZap: tokenA.address,
        token1ToZap: tokenC.address,
        lpToken: lpToken,
        token0AmountIn: token0AmountIn.toString(),
        token1AmountIn: token1AmountIn.toString(),
        lpTokenAmountReceived: "2995505694675001653537",
        user: carol,
      });

      console.info(
        "Balance tokenA: " +
          formatUnits(
            String(await tokenA.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance WBNB: " +
          formatUnits(
            String(await wrappedBNB.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance tokenC: " +
          formatUnits(
            String(await tokenC.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
    });

    it("User completes zapOut to token (tokenA/tokenC)", async function () {
      const lpToken = pairAC.address;
      const lpTokenAmount = parseEther("1");
      const tokenToReceive = tokenA.address;

      const estimation = await tbccFinanceZap.estimateZapOutSwap(
        lpToken,
        lpTokenAmount,
        tokenToReceive
      );
      assert.equal(estimation[2], tokenC.address);

      const minTokenAmountOut = new BN(estimation[1].toString())
        .mul(new BN("9995"))
        .div(new BN("10000"));

      const result = await tbccFinanceZap.zapOutToken(
        lpToken,
        tokenToReceive,
        lpTokenAmount,
        minTokenAmountOut,
        { from: carol }
      );

      expectEvent(result, "ZapOut", {
        lpToken: lpToken,
        tokenToReceive: tokenToReceive,
        lpTokenAmount: lpTokenAmount.toString(),
        tokenAmountReceived: parseEther("1.999585257721842347").toString(),
        user: carol,
      });

      console.info(
        "Balance tokenA: " +
          formatUnits(
            String(await tokenA.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance WBNB: " +
          formatUnits(
            String(await wrappedBNB.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance tokenC: " +
          formatUnits(
            String(await tokenC.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
    });

    it("User completes zapOut to BNB (BNB/tokenC)", async function () {
      const lpToken = pairBC.address;
      const lpTokenAmount = parseEther("1");
      const tokenToReceive = wrappedBNB.address;

      const estimation = await tbccFinanceZap.estimateZapOutSwap(
        lpToken,
        lpTokenAmount,
        tokenToReceive
      );
      assert.equal(estimation[2], tokenC.address);

      const minTokenAmountOut = new BN(estimation[1].toString())
        .mul(new BN("9995"))
        .div(new BN("10000"));

      const result = await tbccFinanceZap.zapOutBNB(
        lpToken,
        lpTokenAmount,
        minTokenAmountOut,
        { from: carol }
      );

      expectEvent(result, "ZapOut", {
        lpToken: lpToken,
        tokenToReceive: constants.ZERO_ADDRESS,
        lpTokenAmount: lpTokenAmount.toString(),
        tokenAmountReceived: parseEther("0.199890235601183875").toString(),
        user: carol,
      });

      console.info(
        "Balance tokenA: " +
          formatUnits(
            String(await tokenA.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance WBNB: " +
          formatUnits(
            String(await wrappedBNB.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
      console.info(
        "Balance tokenC: " +
          formatUnits(
            String(await tokenC.balanceOf(tbccFinanceZap.address)),
            18
          )
      );
    });

    it("Zap estimation fail if wrong tokens", async function () {
      await expectRevert(
        tbccFinanceZap.estimateZapInSwap(
          wrappedBNB.address,
          parseEther("1"),
          pairAC.address
        ),
        "Zap: Wrong tokens"
      );
      await expectRevert(
        tbccFinanceZap.estimateZapInRebalancingSwap(
          tokenA.address,
          wrappedBNB.address,
          parseEther("1"),
          parseEther("1"),
          pairAC.address
        ),
        "Zap: Wrong token1"
      );

      await expectRevert(
        tbccFinanceZap.estimateZapInRebalancingSwap(
          wrappedBNB.address,
          tokenA.address,
          parseEther("1"),
          parseEther("1"),
          pairAC.address
        ),
        "Zap: Wrong token0"
      );
      await expectRevert(
        tbccFinanceZap.estimateZapInRebalancingSwap(
          tokenA.address,
          tokenA.address,
          parseEther("1"),
          parseEther("1"),
          pairAC.address
        ),
        "Zap: Same tokens"
      );

      await expectRevert(
        tbccFinanceZap.estimateZapOutSwap(
          pairAC.address,
          parseEther("1"),
          wrappedBNB.address
        ),
        "Zap: Token not in LP"
      );
    });

    it("Zap estimations work as expected", async function () {
      // Verify estimations are the same regardless of the argument ordering
      const estimation0 = await tbccFinanceZap.estimateZapInRebalancingSwap(
        tokenA.address,
        tokenC.address,
        parseEther("0.5"),
        parseEther("1"),
        pairAC.address
      );
      const estimation1 = await tbccFinanceZap.estimateZapInRebalancingSwap(
        tokenC.address,
        tokenA.address,
        parseEther("1"),
        parseEther("0.5"),
        pairAC.address
      );

      assert.equal(estimation0[0].toString(), estimation1[0].toString());
      assert.equal(estimation0[1].toString(), estimation1[1].toString());
      assert.equal(!estimation0[2], estimation1[2]);

      // Verify estimations are the same for zapIn and zapInRebalancing with 0 for one of the quantity
      const estimation2 = await tbccFinanceZap.estimateZapInSwap(
        tokenA.address,
        parseEther("5"),
        pairAC.address
      );
      const estimation3 = await tbccFinanceZap.estimateZapInRebalancingSwap(
        tokenA.address,
        tokenC.address,
        parseEther("5"),
        parseEther("0"),
        pairAC.address
      );

      assert.equal(estimation2[0].toString(), estimation3[0].toString());
      assert.equal(estimation2[1].toString(), estimation3[1].toString());
    });

    it("Cannot zap if wrong direction/tokens used", async function () {
      await expectRevert(
        tbccFinanceZap.zapInToken(
          tokenA.address,
          parseEther("1"),
          pairBC.address,
          parseEther("0.51"),
          { from: carol }
        ),
        "Zap: Wrong tokens"
      );
      await expectRevert(
        tbccFinanceZap.zapInBNB(pairAC.address, parseEther("0.51"), {
          from: carol,
          value: parseEther("0.51").toString(),
        }),
        "Zap: Wrong tokens"
      );

      await expectRevert(
        tbccFinanceZap.zapOutToken(
          pairBC.address,
          tokenA.address,
          parseEther("0.51"),
          parseEther("0.51"),
          { from: carol }
        ),
        "Zap: Token not in LP"
      );

      await expectRevert(
        tbccFinanceZap.zapOutBNB(
          pairAC.address,
          parseEther("0.51"),
          parseEther("0.51"),
          { from: carol }
        ),
        "Zap: Token not in LP"
      );

      await expectRevert(
        tbccFinanceZap.zapInTokenRebalancing(
          tokenA.address,
          tokenC.address,
          parseEther("1"),
          parseEther("1"),
          pairBC.address,
          parseEther("0.5"),
          parseEther("0.5"),
          true,
          { from: carol }
        ),
        "Zap: Wrong token0"
      );

      await expectRevert(
        tbccFinanceZap.zapInTokenRebalancing(
          tokenC.address,
          tokenA.address,
          parseEther("1"),
          parseEther("1"),
          pairBC.address,
          parseEther("0.5"),
          parseEther("0.5"),
          true,
          { from: carol }
        ),
        "Zap: Wrong token1"
      );

      await expectRevert(
        tbccFinanceZap.zapInTokenRebalancing(
          tokenC.address,
          tokenC.address,
          parseEther("1"),
          parseEther("1"),
          pairBC.address,
          parseEther("0.5"),
          parseEther("0.5"),
          true,
          { from: carol }
        ),
        "Zap: Same tokens"
      );

      await expectRevert(
        tbccFinanceZap.zapInBNBRebalancing(
          tokenC.address,
          parseEther("1"),
          pairAB.address,
          parseEther("0.5"),
          parseEther("0.5"),
          true,
          { from: carol, value: parseEther("0.1").toString() }
        ),
        "Zap: Wrong token1"
      );
      await expectRevert(
        tbccFinanceZap.zapInBNBRebalancing(
          tokenA.address,
          parseEther("1"),
          pairAC.address,
          parseEther("0.5"),
          parseEther("0.5"),
          true,
          { from: carol, value: parseEther("0.1").toString() }
        ),
        "Zap: Wrong token0"
      );

      // David gets WBNB
      const result = await wrappedBNB.deposit({
        from: david,
        value: parseEther("1").toString(),
      });
      expectEvent(result, "Deposit", {
        dst: david,
        wad: parseEther("1").toString(),
      });

      await expectRevert(
        tbccFinanceZap.zapInBNBRebalancing(
          wrappedBNB.address,
          parseEther("1"),
          pairBC.address,
          parseEther("0.5"),
          parseEther("0.5"),
          false,
          { from: david, value: parseEther("0.1").toString() }
        ),
        "Zap: Same tokens"
      );

      // TokenC (token0) > BNB (token1) --> sell token1 (should be false)
      await expectRevert(
        tbccFinanceZap.zapInBNBRebalancing(
          tokenC.address,
          parseEther("0.05"),
          pairBC.address,
          parseEther("0.5"),
          parseEther("0.5"),
          true,
          { from: david, value: parseEther("0.0000000001").toString() }
        ),
        "Zap: Wrong trade direction"
      );

      // TokenC (token0) < BNB (token1) --> sell token0 (should be true)
      await expectRevert(
        tbccFinanceZap.zapInBNBRebalancing(
          tokenC.address,
          parseEther("0.0000000001"),
          pairBC.address,
          parseEther("0.5"),
          parseEther("0.5"),
          false,
          { from: david, value: parseEther("0.05").toString() }
        ),
        "Zap: Wrong trade direction"
      );

      // TokenA (token0) > tokenC (token1) --> sell token0 (should be true)
      await expectRevert(
        tbccFinanceZap.zapInTokenRebalancing(
          tokenA.address,
          tokenC.address,
          parseEther("1"),
          parseEther("0"),
          pairAC.address,
          parseEther("0.5"),
          parseEther("0.5"),
          false,
          { from: david }
        ),
        "Zap: Wrong trade direction"
      );

      // TokenA (token0) < tokenC (token1) --> sell token0 (should be true)
      await expectRevert(
        tbccFinanceZap.zapInTokenRebalancing(
          tokenA.address,
          tokenC.address,
          parseEther("0"),
          parseEther("1"),
          pairAC.address,
          parseEther("0.5"),
          parseEther("0.5"),
          true,
          { from: david }
        ),
        "Zap: Wrong trade direction"
      );
    });

    it("Testing pair balances for Admin Wallet", async function () {
      // Getting all pairs information
      const result = await tbccFinanceFeeHandler.getAllPairTokens(
        tbccFinanceFactory.address,
        { from: david }
      );

      // Display all LP Data
      for (const lpData of result) {
        if (lpData.lpAddress === pairAB.address) {
          console.info(
            "Pair AB: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
        if (lpData.lpAddress === pairBC.address) {
          console.info(
            "Pair BC: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
        if (lpData.lpAddress === pairAC.address) {
          console.info(
            "Pair AC: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
        if (lpData.token0 === tokenA.address) {
          console.info(
            "     Token A: " + formatUnits(String(lpData.token0Amt), 18)
          );
        }
        if (lpData.token0 === wrappedBNB.address) {
          console.info(
            "     WBNB: " + formatUnits(String(lpData.token0Amt), 18)
          );
        }
        if (lpData.token0 === tokenC.address) {
          console.info(
            "     Token C: " + formatUnits(String(lpData.token0Amt), 18)
          );
        }
        if (lpData.token1 === tokenA.address) {
          console.info(
            "     Token A: " + formatUnits(String(lpData.token1Amt), 18)
          );
        }
        if (lpData.token1 === wrappedBNB.address) {
          console.info(
            "     WBNB: " + formatUnits(String(lpData.token1Amt), 18)
          );
        }
        if (lpData.token1 === tokenC.address) {
          console.info(
            "     Token C: " + formatUnits(String(lpData.token1Amt), 18)
          );
        }
      }
    });

    it("Testing pair balances for User Wallet", async function () {
      // Getting all pairs information
      const result = await tbccFinanceFeeHandler.getAllPairTokensForAccount(
        tbccFinanceFactory.address,
        tbccFinanceFeeHandler.address,
        { from: david }
      );

      // Display all LP Data
      for (const lpData of result) {
        if (lpData.lpAddress === pairAB.address) {
          console.info(
            "Pair AB: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
        if (lpData.lpAddress === pairBC.address) {
          console.info(
            "Pair BC: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
        if (lpData.lpAddress === pairAC.address) {
          console.info(
            "Pair AC: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
      }
    });

    it("Testing pair tokens for account", async function () {
      // Getting all pairs information
      const result = await tbccFinanceFeeHandler.getPairTokens(
        [pairAC.address],
        tbccFinanceFeeHandler.address,
        { from: david }
      );

      // Display all LP Data
      for (const lpData of result) {
        if (lpData.lpAddress === pairAB.address) {
          console.info(
            "Pair AB: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
        if (lpData.lpAddress === pairBC.address) {
          console.info(
            "Pair BC: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
        if (lpData.lpAddress === pairAC.address) {
          console.info(
            "Pair AC: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
      }
    });

    it("Sell LP token, buy back $TBCC", async function () {
      const lpToken = pairAC.address;
      const lpTokenAmount = parseEther("0.79801008225172625");
      const amountAMin = parseEther("0.7");
      const amountBMin = parseEther("0.7");

      // Getting all pairs information
      await tbccFinanceFeeHandler.processFee(
        [
          {
            pair: lpToken,
            amount: lpTokenAmount,
            amountAMin,
            amountBMin,
          },
        ],
        [],
        false,
        { from: bob }
      );

      // Getting all pairs information
      const result = await tbccFinanceFeeHandler.getAllPairTokens(
        tbccFinanceFactory.address,
        { from: david }
      );

      // Display all LP Data
      for (const lpData of result) {
        if (lpData.lpAddress === pairAB.address) {
          console.info(
            "Pair AB: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
        if (lpData.lpAddress === pairBC.address) {
          console.info(
            "Pair BC: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
        if (lpData.lpAddress === pairAC.address) {
          console.info(
            "Pair AC: " + formatUnits(String(lpData.userBalance), 18)
          );
        }
        if (lpData.token0 === tokenA.address) {
          console.info(
            "     Token A: " + formatUnits(String(lpData.token0Amt), 18)
          );
        }
        if (lpData.token0 === wrappedBNB.address) {
          console.info(
            "     WBNB: " + formatUnits(String(lpData.token0Amt), 18)
          );
        }
        if (lpData.token0 === tokenC.address) {
          console.info(
            "     Token C: " + formatUnits(String(lpData.token0Amt), 18)
          );
        }
        if (lpData.token1 === tokenA.address) {
          console.info(
            "     Token A: " + formatUnits(String(lpData.token1Amt), 18)
          );
        }
        if (lpData.token1 === wrappedBNB.address) {
          console.info(
            "     WBNB: " + formatUnits(String(lpData.token1Amt), 18)
          );
        }
        if (lpData.token1 === tokenC.address) {
          console.info(
            "     Token C: " + formatUnits(String(lpData.token1Amt), 18)
          );
        }
      }

      console.info(
        "Admin Wallet Balance tokenA: " +
          formatUnits(
            String(await tokenA.balanceOf(tbccFinanceFeeHandler.address)),
            18
          )
      );

      console.info(
        "Admin Wallet Balance tokenC: " +
          formatUnits(
            String(await tokenC.balanceOf(tbccFinanceFeeHandler.address)),
            18
          )
      );

      // swap to TBCC
      const amountIn = parseEther("0.799604674196686496");
      await tbccFinanceFeeHandler.processFee(
        [],
        [
          {
            amountIn,
            amountOutMin: parseEther("0.7"),
            path: [tokenC.address, tokenA.address],
          },
        ],
        false,
        { from: bob }
      );

      console.info(
        "Admin Wallet Balance tokenA: " +
          formatUnits(
            String(await tokenA.balanceOf(tbccFinanceFeeHandler.address)),
            18
          )
      );

      console.info(
        "Admin Wallet Balance tokenC: " +
          formatUnits(
            String(await tokenC.balanceOf(tbccFinanceFeeHandler.address)),
            18
          )
      );
    });
    it("Sending $TBCC to voult", async function () {
      console.info(
        "carol Balance Before tokenA: " +
          formatUnits(String(await tokenA.balanceOf(carol)), 18)
      );

      const result = await tbccFinanceFeeHandler.sendTBCC(
        parseEther("1.590851061546826563"),
        { from: bob }
      );

      expectEvent.inTransaction(
        result.receipt.transactionHash,
        tokenA,
        "Transfer",
        [
          {
            from: tbccFinanceFeeHandler.address,
            to: carol,
            value: parseEther("1000000").toString(),
          },
        ]
      );

      console.info(
        "carol Balance tokenA: " +
          formatUnits(String(await tokenA.balanceOf(carol)), 18)
      );
    });
  });
});
