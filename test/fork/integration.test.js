const { expect } = require('chai');
const { ethers } = require('hardhat');
const addresses = require('../../lib/addresses');
const { getERC20, increaseTime } = require('../utils/test-helpers');
const { ADDRESS_ZERO, ONE_DAY_IN_SECONDS } = require('../../lib/constants');
const { impersonateAddress } = require('../../lib/rpc');
const { eth, getBabylonContractByName } = require('../../lib/helpers');
const { deployments } = require('hardhat');
const { deploy } = deployments;
// const { takeSnapshot, restoreSnapshot } = require('lib/rpc');

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const UniswapV3TradeIntegration = '0xc300FB5dE5384bcA63fb6eb3EfD9DB7dFd10325C';
const NFT_URI = 'https://babylon.mypinata.cloud/ipfs/QmcL826qNckBzEk2P11w4GQrrQFwGvR6XmUCuQgBX9ck1v';
const NFT_SEED = '504592746';

describe('Babylon integrations', function () {
  let owner;
  let garden;
  let strategy;
  let controller;
  let keeper;
  let alice;
  let bob;

  before(async () => {
    [, keeper, alice, bob] = await ethers.getSigners();
    controller = await ethers.getContractAt('IBabController', '0xD4a5b5fcB561dAF3aDF86F8477555B92FBa43b5F');
    owner = await impersonateAddress('0x97FcC2Ae862D03143b393e9fA73A32b563d57A6e');
    // await controller.connect(owner).addKeeper(keeper.address);

    // Creates a garden with custom integrations enabled
    const contribution = eth(1);
    await controller.connect(alice).createGarden(
      WETH,
      'Fountain',
      'FTN',
      NFT_URI,
      NFT_SEED,
      [
        eth(100), // Max Deposit Limit
        eth(100), // Min Liquidity Asset | ie: Uniswap Volume
        1, // Deposit Hardlock | 1 second
        eth(0.1), // Min Contribution
        ONE_DAY_IN_SECONDS, // Strategy Cooldown Period
        eth(0.1), // Min Voter Quorum | 10%
        ONE_DAY_IN_SECONDS * 3, // Min Strategy Duration
        ONE_DAY_IN_SECONDS * 365, // Max Strategy Duration
        1, // Min number of voters
        eth(), // Decay rate of price per share
        eth(), // Base slippage for price per share
        1, // Can mint NFT after 1 sec of being a member
        1 // Whether or not the garden has custom integrations enabled
      ],
      contribution,
      [true, true, true], // publicGardenStrategistsStewards
      [0, 0, 0], // Profit splits. Use defaults
      {
        value: contribution,
      },
    );

    const gardens = await controller.getGardens();
    // console.log(`Garden created at ${gardens[0]}`);
    garden = await ethers.getContractAt('IGarden', gardens.slice(-1)[0]);
    // Alternatively you can use mainnet Test WETH garden that has custom integrations enabled
    // garden = await ethers.getContractAt('IGarden', '0x2c4Beb32f0c80309876F028694B4633509e942D4');

  });

  beforeEach(async () => {});

  afterEach(async () => {});

  it('can deploy a strategy with the Yearn Custom integration', async () => {

    // We deploy the custom yearn integration. Change with your own integration when ready
    const customIntegration = await deploy('CustomIntegrationYearn', {
      from: alice.address,
      args: [controller.address, '0x61c733fE0Eb89b75440A21cD658C4011ec512EB8'],
    });

    await garden.connect(alice).addStrategy(
      'Yearn USDT Vault',
      '💎',
      [
        eth(10), // maxCapitalRequested: eth(10),
        eth(0.1), // stake: eth(0.1),
        ONE_DAY_IN_SECONDS * 30, // strategyDuration: ONE_DAY_IN_SECONDS * 30,
        eth(0.05), // expectedReturn: eth(0.05),
        eth(0.1), // maxAllocationPercentage: eth(0.1),
        eth(0.05), // maxGasFeePercentage: eth(0.05),
        eth(0.09), // maxTradeSlippagePercentage: eth(0.09),
      ],
      [5], // _opTypes
      [customIntegration.address], // _opIntegrations
      new ethers.utils.AbiCoder().encode(
        ['address', 'uint256'],
        ['0x7Da96a3891Add058AdA2E826306D812C638D87a7', 0] // integration params. We pass USDT vault
      ), // _opEncodedDatas
    );

    const strategies = await garden.getStrategies();
    customStrategy = await ethers.getContractAt('IStrategy', strategies[0]);

    await garden.connect(alice).deposit(eth(1), 0, alice.address, ADDRESS_ZERO, {
      value: eth(1),
    });
    const balance = await garden.balanceOf(alice.getAddress());

    // Vote Strategy
    await customStrategy.connect(keeper).resolveVoting([alice.address], [balance], 0);

    // Execute strategy
    await increaseTime(ONE_DAY_IN_SECONDS);
    await customStrategy.connect(keeper).executeStrategy(eth(1), 0);

    // Finalize strategy
    await increaseTime(ONE_DAY_IN_SECONDS * 30);
    await customStrategy.connect(keeper).finalizeStrategy(0, '', 0);
  });

  it('can deploy a strategy with a CRV + Yearn Custom integration. 3pool', async () => {

    // We deploy the custom yearn integration. Change with your own integration when ready
    const customIntegration = await deploy('CustomIntegrationYearn', {
      from: alice.address,
      args: [controller.address, '0x61c733fE0Eb89b75440A21cD658C4011ec512EB8'],
    });

    const integrations = [
      'MasterSwapper',
      'BalancerIntegration',
      'LidoStakeIntegration',
      'CurvePoolIntegration',
      'CurveGaugeIntegration',
      'ConvexStakeIntegration',
      'UniswapV3TradeIntegration',
      'CompoundLendIntegration',
      'CompoundBorrowIntegration',
      'FuseLendIntegration',
      'FuseBorrowIntegration',
      'AaveLendIntegration',
      'AaveBorrowIntegration',
      'UniswapPoolIntegration',
      'PickleJarIntegration',
      'PickleFarmIntegration',
      'StakewiseIntegration',
      'SushiswapPoolIntegration',
      'YearnVaultIntegration',
    ];

    const curvePoolIntegrationAddress = getBabylonContractByName('CurvePoolIntegration');


    const crvPool3crypto = '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46';
    const yearnvault3crypto = '0xE537B5cc158EB71037D4125BDD7538421981E6AA';
    await garden.connect(alice).addStrategy(
      'CRV 3Pool + yearn vault',
      '💎',
      [
        eth(10), // maxCapitalRequested: eth(10),
        eth(0.1), // stake: eth(0.1),
        ONE_DAY_IN_SECONDS * 30, // strategyDuration: ONE_DAY_IN_SECONDS * 30,
        eth(0.05), // expectedReturn: eth(0.05),
        eth(0.1), // maxAllocationPercentage: eth(0.1),
        eth(0.05), // maxGasFeePercentage: eth(0.05),
        eth(0.09), // maxTradeSlippagePercentage: eth(0.09),
      ],
      [1, 5], // _opTypes
      [curvePoolIntegrationAddress, customIntegration.address], // _opIntegrations
      new ethers.utils.AbiCoder().encode(
        ['address', 'uint256', 'address', 'uint256'],
        [crvPool3crypto, 0, yearnvault3crypto, 0] // integration params. We pass 3crypto pool + yearn vault
      ), // _opEncodedDatas
    );

    const strategies = await garden.getStrategies();
    customStrategy = await ethers.getContractAt('IStrategy', strategies[0]);

    await garden.connect(alice).deposit(eth(1), 0, alice.address, ADDRESS_ZERO, {
      value: eth(1),
    });
    const balance = await garden.balanceOf(alice.getAddress());

    // Vote Strategy
    await customStrategy.connect(keeper).resolveVoting([alice.address], [balance], 0);

    // Execute strategy
    await increaseTime(ONE_DAY_IN_SECONDS);
    await customStrategy.connect(keeper).executeStrategy(eth(1), 0);

    // Finalize strategy
    await increaseTime(ONE_DAY_IN_SECONDS * 30);
    await customStrategy.connect(keeper).finalizeStrategy(0, '', 0);
  });

  it('can deploy a strategy with Badger Custom integration', async () => {

    const VALID_BADGER_VAULT = '0x19D97D8fA813EE2f51aD4B4e04EA08bAf4DFfC28'; //Badger Vault

    // We deploy the custom yearn integration. Change with your own integration when ready
    const customIntegration = await deploy('CustomIntegrationBadger', {
      from: alice.address,
      args: [controller.address],
    });
    //console.log('badger customIntegration: ', customIntegration);


    let strategy = await garden.connect(alice).addStrategy(
      'Execute my custom integration',
      '💎',
      [
        eth(10), // maxCapitalRequested: eth(10),
        eth(0.1), // stake: eth(0.1),
        ONE_DAY_IN_SECONDS * 30, // strategyDuration: ONE_DAY_IN_SECONDS * 30,
        eth(0.05), // expectedReturn: eth(0.05),
        eth(0.1), // maxAllocationPercentage: eth(0.1),
        eth(0.05), // maxGasFeePercentage: eth(0.05),
        eth(0.09), // maxTradeSlippagePercentage: eth(0.09),
      ],
      [5], // _opTypes
      [customIntegration.address], // _opIntegrations
      new ethers.utils.AbiCoder().encode(
        ['address', 'uint256'],
        [VALID_BADGER_VAULT, 0] // integration params. We pass bbadger vault
      ), // _opEncodedDatas
    );

    //console.log("BADGER STRATEGY ADDED!")

    const strategies = await garden.getStrategies();
    customStrategy = await ethers.getContractAt('IStrategy', strategies[0]);

    //We need to impersonate badger dao governance to approve the custom strategy contract
    const GOVERNANCE_BADGER_ADDRESS = '0xb65cef03b9b89f99517643226d76e286ee999e77';
    const SETT_GOVERNANCE = await impersonateAddress(GOVERNANCE_BADGER_ADDRESS);
    let settcontract = await ethers.getContractAt('IBadgerVault',VALID_BADGER_VAULT);
    let approvecontractTx = await settcontract.connect(SETT_GOVERNANCE).approveContractAccess(customStrategy.address);
    //console.log(approvecontractTx);

    await garden.connect(alice).deposit(eth(1), 0, alice.address, ADDRESS_ZERO, {
      value: eth(1),
    });
    const balance = await garden.balanceOf(alice.getAddress());

    // Vote Strategy
    await customStrategy.connect(keeper).resolveVoting([alice.address], [balance], 0);

    // Execute strategy
    await increaseTime(ONE_DAY_IN_SECONDS);
    await customStrategy.connect(keeper).executeStrategy(eth(1), 0);

    // Finalize strategy
    await increaseTime(ONE_DAY_IN_SECONDS * 30);
    await customStrategy.connect(keeper).finalizeStrategy(0, '', 0);
  });

  it('can deploy a strategy with CRV + Badger Custom integration', async () => {

    const crvRenWBTC = '0x49849C98ae39Fff122806C06791Fa73784FB3675';
    const VALID_BADGER_VAULT = '0x6dEf55d2e18486B9dDfaA075bc4e4EE0B28c1545'; //Convex - renBTC/wBTC
    const curvePoolIntegrationAddress = getBabylonContractByName('CurvePoolIntegration');

    // We deploy the custom yearn integration. Change with your own integration when ready
    const customIntegration = await deploy('CustomIntegrationBadger', {
      from: alice.address,
      args: [controller.address],
    });
    //console.log('badger customIntegration: ', customIntegration);

    let encode = new ethers.utils.AbiCoder().encode(
      ['address', 'uint256', 'address', 'uint256'],
      [crvRenWBTC, 0, VALID_BADGER_VAULT, 0] // integration params. We pass 3crypto pool + yearn vault
    );

    console.log(encode);
    
    await garden.connect(alice).addStrategy(
      'CRV RenBTC + badger vault',
      '💎',
      [
        eth(10), // maxCapitalRequested: eth(10),
        eth(0.1), // stake: eth(0.1),
        ONE_DAY_IN_SECONDS * 30, // strategyDuration: ONE_DAY_IN_SECONDS * 30,
        eth(0.05), // expectedReturn: eth(0.05),
        eth(0.1), // maxAllocationPercentage: eth(0.1),
        eth(0.05), // maxGasFeePercentage: eth(0.05),
        eth(0.09), // maxTradeSlippagePercentage: eth(0.09),
      ],
      [1, 5], // _opTypes
      [curvePoolIntegrationAddress, customIntegration.address], // _opIntegrations
      new ethers.utils.AbiCoder().encode(
        ['address', 'uint256', 'address', 'uint256'],
        [crvRenWBTC, 0, VALID_BADGER_VAULT, 0] // integration params. We pass 3crypto pool + yearn vault
      ), // _opEncodedDatas
    );

    //console.log("BADGER STRATEGY ADDED!")

    const strategies = await garden.getStrategies();
    customStrategy = await ethers.getContractAt('IStrategy', strategies[0]);

    //We need to impersonate badger dao governance to approve the custom strategy contract
    const GOVERNANCE_BADGER_ADDRESS = '0xb65cef03b9b89f99517643226d76e286ee999e77';
    const SETT_GOVERNANCE = await impersonateAddress(GOVERNANCE_BADGER_ADDRESS);
    let settcontract = await ethers.getContractAt('IBadgerVault',VALID_BADGER_VAULT);
    let approvecontractTx = await settcontract.connect(SETT_GOVERNANCE).approveContractAccess(customStrategy.address);
    //console.log(approvecontractTx);

    await garden.connect(alice).deposit(eth(1), 0, alice.address, ADDRESS_ZERO, {
      value: eth(1),
    });
    const balance = await garden.balanceOf(alice.getAddress());

    // Vote Strategy
    await customStrategy.connect(keeper).resolveVoting([alice.address], [balance], 0);

    // Execute strategy
    await increaseTime(ONE_DAY_IN_SECONDS);
    await customStrategy.connect(keeper).executeStrategy(eth(1), 0);

    // Finalize strategy
    await increaseTime(ONE_DAY_IN_SECONDS * 30);
    await customStrategy.connect(keeper).finalizeStrategy(0, '', 0);
  });

});
