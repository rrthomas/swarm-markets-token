import { ethers } from 'hardhat';
import { Signer, ContractFactory } from 'ethers';
import { expect } from 'chai';
import { SwarmMarketsToken, SmtDistributor } from '../typechain';

import Reverter from './utils/reverter';

let deployer: Signer;
let kakaroto: Signer;
let vegeta: Signer;
let karpincho: Signer;

let deployerAddress: string;
let kakarotoAddress: string;
let vegetaAddress: string;
let karpinchoAddress: string;

let SMTContract: SwarmMarketsToken;
let smtDisctributorContract: SmtDistributor;
let smtDisctributorContractKakaroto: SmtDistributor;
// let smtDisctributorContractVegeta: SmtDistributor;
let smtDisctributorContractKarpincho: SmtDistributor;

let SmtDistributorFactory: ContractFactory;

const tokenSupply = ethers.constants.One.mul(250000000);

describe('STM', function () {
  const reverter = new Reverter();

  before(async () => {
    [deployer, kakaroto, vegeta, karpincho] = await ethers.getSigners();
    [deployerAddress, kakarotoAddress, vegetaAddress, karpinchoAddress] = await Promise.all([
      deployer.getAddress(),
      kakaroto.getAddress(),
      vegeta.getAddress(),
      karpincho.getAddress(),
    ]);

    SmtDistributorFactory = await ethers.getContractFactory('SmtDistributor');
    const SwarmMarketsTokenFactory = await ethers.getContractFactory('SwarmMarketsToken');

    SMTContract = (await SwarmMarketsTokenFactory.deploy(tokenSupply, deployerAddress)) as SwarmMarketsToken;
    await SMTContract.deployed();
  });

  it('should not be able to deploy with zero address for token', async () => {
    await expect(SmtDistributorFactory.deploy(ethers.constants.AddressZero)).to.be.revertedWith(
      'token is the zero address',
    );
  });

  it('should be able to deploy with non zero address for token', async () => {
    smtDisctributorContract = (await SmtDistributorFactory.deploy(SMTContract.address)) as SmtDistributor;
    await smtDisctributorContract.deployed();

    smtDisctributorContractKakaroto = smtDisctributorContract.connect(kakaroto);
    // smtDisctributorContractVegeta = smtDisctributorContract.connect(vegeta);
    smtDisctributorContractKarpincho = smtDisctributorContract.connect(karpincho);

    await reverter.snapshot();
  });

  describe('#depositShares', () => {
    it('non owner should not be able to call depositShares', async () => {
      await expect(
        smtDisctributorContractKakaroto.depositShares([{ beneficiary: kakarotoAddress, amount: 100 }], 100),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('owner should not be able to call depositShares with totalAmount 0', async () => {
      await expect(
        smtDisctributorContract.depositShares([{ beneficiary: kakarotoAddress, amount: 100 }], 0),
      ).to.be.revertedWith('totalAmount is zero');
    });

    it('owner should not be able to call depositShares with empty shares', async () => {
      await expect(smtDisctributorContract.depositShares([], 100)).to.be.revertedWith('shares can not be empty');
    });

    it('owner should not be able to call depositShares with accumulated shares amont and totalAmount mismatch', async () => {
      await SMTContract.approve(smtDisctributorContract.address, ethers.constants.MaxUint256);

      const initialBlance = await SMTContract.balanceOf(deployerAddress);
      await expect(
        smtDisctributorContract.depositShares(
          [
            { beneficiary: kakarotoAddress, amount: 100 },
            { beneficiary: vegetaAddress, amount: 100 },
          ],
          100,
        ),
      ).to.be.revertedWith('total amount mismatch');

      expect(await SMTContract.balanceOf(deployerAddress)).to.eq(initialBlance);
    });

    it('owner should be able to call depositShares with right parameters', async () => {
      const deployerInitialBlance = await SMTContract.balanceOf(deployerAddress);
      const distributorInitialBlance = await SMTContract.balanceOf(smtDisctributorContractKarpincho.address);

      await smtDisctributorContract.depositShares(
        [
          { beneficiary: kakarotoAddress, amount: 100 },
          { beneficiary: vegetaAddress, amount: 100 },
        ],
        200,
      );

      expect(await SMTContract.balanceOf(deployerAddress)).to.eq(deployerInitialBlance.sub(200));
      expect(await SMTContract.balanceOf(smtDisctributorContractKarpincho.address)).to.eq(
        distributorInitialBlance.add(200),
      );
      expect(await smtDisctributorContract.beneficiaries(kakarotoAddress)).to.eq(100);
      expect(await smtDisctributorContract.beneficiaries(vegetaAddress)).to.eq(100);
    });

    it('beneficiary share should be accumulated with subsequent deposits', async () => {
      const deployerInitialBlance = await SMTContract.balanceOf(deployerAddress);
      const distributorInitialBlance = await SMTContract.balanceOf(smtDisctributorContractKarpincho.address);

      await smtDisctributorContract.depositShares([{ beneficiary: kakarotoAddress, amount: 100 }], 100);

      expect(await SMTContract.balanceOf(deployerAddress)).to.eq(deployerInitialBlance.sub(100));
      expect(await SMTContract.balanceOf(smtDisctributorContractKarpincho.address)).to.eq(
        distributorInitialBlance.add(100),
      );
      expect(await smtDisctributorContract.beneficiaries(kakarotoAddress)).to.eq(200);
      expect(await smtDisctributorContract.beneficiaries(vegetaAddress)).to.eq(100);
    });
  });

  describe('#claim', () => {
    it('nothing should happend if non-beneficiary calls claim', async () => {
      const distributorInitialBlance = await SMTContract.balanceOf(smtDisctributorContractKarpincho.address);
      const karpinchoInitialBlance = await SMTContract.balanceOf(karpinchoAddress);

      await smtDisctributorContractKarpincho.claim();

      expect(await SMTContract.balanceOf(smtDisctributorContractKarpincho.address)).to.eq(distributorInitialBlance);
      expect(await SMTContract.balanceOf(karpinchoAddress)).to.eq(karpinchoInitialBlance);
    });

    it('a beneficiary should be able to claim its current share', async () => {
      const distributorInitialBlance = await SMTContract.balanceOf(smtDisctributorContractKarpincho.address);
      const kakarotoInitialBlance = await SMTContract.balanceOf(kakarotoAddress);
      const kakarotoInitialClaimable = await smtDisctributorContract.beneficiaries(kakarotoAddress);

      await smtDisctributorContractKakaroto.claim();

      expect(await SMTContract.balanceOf(smtDisctributorContractKarpincho.address)).to.eq(
        distributorInitialBlance.sub(kakarotoInitialClaimable),
      );
      expect(await SMTContract.balanceOf(kakarotoAddress)).to.eq(kakarotoInitialBlance.add(kakarotoInitialClaimable));
      expect(await smtDisctributorContract.beneficiaries(kakarotoAddress)).to.eq(0);
    });
  });
});
