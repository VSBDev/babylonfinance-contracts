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

describe('Babylon BADGER Irioder integrations', function () {
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

  it('can deploy a strategy with Badger Custom integration - bBADGER', async () => {

    const VALID_BADGER_VAULT = '0x19D97D8fA813EE2f51aD4B4e04EA08bAf4DFfC28'; //Badger Vault

    const customIntegration = await deploy('CustomIntegrationBadger', {
      from: alice.address,
      args: [controller.address],
    });

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

    const strategies = await garden.getStrategies();
    customStrategy = await ethers.getContractAt('IStrategy', strategies[0]);

    //We need to impersonate badger dao governance to approve the custom strategy contract
    const GOVERNANCE_BADGER_ADDRESS = '0xb65cef03b9b89f99517643226d76e286ee999e77';
    const SETT_GOVERNANCE = await impersonateAddress(GOVERNANCE_BADGER_ADDRESS);
    let settcontract = await ethers.getContractAt('IBadgerVault',VALID_BADGER_VAULT);
    let approvecontractTx = await settcontract.connect(SETT_GOVERNANCE).approveContractAccess(customStrategy.address);

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

  //Curve + BADGER TESTING
  let badger_curve_addresses = [
    {
      vault: '0x6dEf55d2e18486B9dDfaA075bc4e4EE0B28c1545',
      curve: true,
      name: 'bcrvRenBTC',
      needs: '0x93054188d876f558f4a66B2EF1d97d16eDf0895B', //bcrvRenBTC
    },
    //'Failed midway in out synthsrc/dest rate stale or flagged; Babylon synthetix not supported'
    /*{
      vault: '0xd04c48a53c111300ad41190d63681ed3dad998ec',
      curve: true,
      name: 'bcrvSBTC',
      needs: '0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714', //bcrvSBTC
    },*/
    {
      vault: '0xb9d076fde463dbc9f915e5392f807315bf940334',
      curve: true,
      name: 'bcrvTBTC',
      needs: '0xC25099792E9349C7DD09759744ea681C7de2cb66', //crvTBTC
    },
    {
      vault: '0x8c76970747afd5398e958bdfada4cf0b9fca16c4',
      curve: true,
      name: 'bcrvHBTC',
      needs: '0x4CA9b3063Ec5866A4B82E437059D2C43d1be596F', //bcrvHBTC
    },
    {
      vault: '0x55912d0cf83b75c492e761932abc4db4a5cb1b17',
      curve: true,
      name: 'bcrvPBTC',
      needs: '0x7F55DDe206dbAD629C080068923b36fe9D6bDBeF', //bcrvPBTC
    },
    {
      vault: '0xf349c0faa80fc1870306ac093f75934078e28991',
      curve: true,
      name: 'bcrvOBTC',
      needs: '0xd81dA8D904b52208541Bade1bD6595D8a251F8dd', //bcrvOBTC
    },
    {
      vault: '0x5dce29e92b1b939f8e8c60dcf15bde82a85be4a9',
      curve: true,
      name: 'bcrvBBTC',
      needs: '0x071c661B4DeefB59E2a3DdB20Db036821eeE8F4b', //bcrvBBTC
    },
    {
      vault: '0xbe08ef12e4a553666291e9ffc24fccfd354f2dd2',
      curve: true,
      name: 'bcrvTricrypto',
      needs: '0x80466c64868E1ab14a1Ddf27A676C3fcBE638Fe5', //bcrvTricrypto
    },
    {
      vault: '0x27e98fc7d05f54e544d16f58c194c2d7ba71e3b5',
      curve: true,
      name: 'bcrvTricrypto2',
      needs: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46', //bcrvTricrypto2
    }
  ]

  for(let i=0; i < badger_curve_addresses.length; i++){
    it('can deploy a strategy with CRV + Badger Custom integration - '+badger_curve_addresses[i].name, async () => {

      const needs = badger_curve_addresses[i].needs;
      const VALID_BADGER_VAULT = badger_curve_addresses[i].vault;
      const curvePoolIntegrationAddress = getBabylonContractByName('CurvePoolIntegration');
  
      const customIntegration = await deploy('CustomIntegrationBadger', {
        from: alice.address,
        args: [controller.address],
      });
  
      await garden.connect(alice).addStrategy(
        badger_curve_addresses[i].name+' vault',
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
          [needs, 0, VALID_BADGER_VAULT, 0] // integration params.
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
  }
 
});
