const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZakatFitrah", function () {
  let zakatFitrah;
  let owner, admin2, donor1, donor2, beneficiary1, beneficiary2, attacker;
  const MIN_DONATION = ethers.parseEther("0.0003");

  beforeEach(async function () {
    [owner, admin2, donor1, donor2, beneficiary1, beneficiary2, attacker] =
      await ethers.getSigners();

    const ZakatFitrah = await ethers.getContractFactory("ZakatFitrah");
    zakatFitrah = await ZakatFitrah.deploy();
    await zakatFitrah.waitForDeployment();
  });

  // ─── Helper ────────────────────────────────────────────────────────────────
  async function seedApprovedBeneficiary(address) {
    await zakatFitrah.submitBeneficiaryForReview(address);
    await zakatFitrah.approveBeneficiary(address);
  }

  // ─── T1: Minimum threshold ─────────────────────────────────────────────────
  describe("T1 – donateZakat reverts below MIN_DONATION_WEI", function () {
    it("reverts when value is 1 wei below minimum", async function () {
      await expect(
        zakatFitrah.connect(donor1).donateZakat({
          value: MIN_DONATION - 1n,
        })
      ).to.be.revertedWith("Below minimum threshold");
    });

    it("reverts when value is zero", async function () {
      await expect(
        zakatFitrah.connect(donor1).donateZakat({ value: 0 })
      ).to.be.revertedWith("Below minimum threshold");
    });
  });

  // ─── T2: Successful donation at exactly MIN ────────────────────────────────
  describe("T2 – donateZakat succeeds at exactly MIN_DONATION_WEI", function () {
    it("emits DonationReceived with correct fields", async function () {
      const tx = await zakatFitrah
        .connect(donor1)
        .donateZakat({ value: MIN_DONATION });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(zakatFitrah, "DonationReceived")
        .withArgs(0n, donor1.address, MIN_DONATION, block.timestamp);
    });

    it("increments totalPool by the donated amount", async function () {
      await zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION });
      expect(await zakatFitrah.totalPool()).to.equal(MIN_DONATION);
    });

    it("grants DONOR_ROLE after first donation", async function () {
      await zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION });
      const DONOR_ROLE = await zakatFitrah.DONOR_ROLE();
      expect(await zakatFitrah.hasRole(DONOR_ROLE, donor1.address)).to.be.true;
    });

    it("does not revert on a second donation (role already held)", async function () {
      await zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION });
      await expect(
        zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION })
      ).to.not.be.reverted;
    });
  });

  // ─── T3: distributeFunds non-admin reverts ─────────────────────────────────
  describe("T3 – distributeFunds reverts for non-admin", function () {
    it("reverts when called by a plain donor", async function () {
      await seedApprovedBeneficiary(beneficiary1.address);
      await zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION });

      const ADMIN_ROLE = await zakatFitrah.ADMIN_ROLE();
      await expect(
        zakatFitrah
          .connect(donor1)
          .distributeFunds([beneficiary1.address], [MIN_DONATION])
      ).to.be.revertedWithCustomError(zakatFitrah, "AccessControlUnauthorizedAccount")
       .withArgs(donor1.address, ADMIN_ROLE);
    });

    it("reverts when called by a beneficiary", async function () {
      await seedApprovedBeneficiary(beneficiary1.address);
      await zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION });

      const ADMIN_ROLE = await zakatFitrah.ADMIN_ROLE();
      await expect(
        zakatFitrah
          .connect(beneficiary1)
          .distributeFunds([beneficiary1.address], [MIN_DONATION])
      ).to.be.revertedWithCustomError(zakatFitrah, "AccessControlUnauthorizedAccount")
       .withArgs(beneficiary1.address, ADMIN_ROLE);
    });
  });

  // ─── T4: distributeFunds – insufficient balance ────────────────────────────
  describe("T4 – distributeFunds reverts when total exceeds balance", function () {
    it("reverts when requesting more than the contract holds", async function () {
      await seedApprovedBeneficiary(beneficiary1.address);
      await zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION });

      const tooMuch = MIN_DONATION + ethers.parseEther("1");
      await expect(
        zakatFitrah
          .connect(owner)
          .distributeFunds([beneficiary1.address], [tooMuch])
      ).to.be.revertedWith("Insufficient contract balance");
    });
  });

  // ─── T5: distributeFunds – non-approved beneficiary ───────────────────────
  describe("T5 – distributeFunds reverts for non-approved beneficiary", function () {
    it("reverts for an address that was never approved", async function () {
      await zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION });
      await expect(
        zakatFitrah
          .connect(owner)
          .distributeFunds([attacker.address], [MIN_DONATION])
      ).to.be.revertedWith("Beneficiary not approved");
    });

    it("reverts for an address that is pending but not yet approved", async function () {
      await zakatFitrah.submitBeneficiaryForReview(beneficiary1.address);
      await zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION });
      await expect(
        zakatFitrah
          .connect(owner)
          .distributeFunds([beneficiary1.address], [MIN_DONATION])
      ).to.be.revertedWith("Beneficiary not approved");
    });
  });

  // ─── T6: approveBeneficiary requires pending ──────────────────────────────
  describe("T6 – approveBeneficiary requires address to be pending first", function () {
    it("reverts when the address was never submitted", async function () {
      await expect(
        zakatFitrah.approveBeneficiary(beneficiary1.address)
      ).to.be.revertedWith("Not pending");
    });

    it("succeeds after submitBeneficiaryForReview", async function () {
      await zakatFitrah.submitBeneficiaryForReview(beneficiary1.address);
      await expect(zakatFitrah.approveBeneficiary(beneficiary1.address))
        .to.emit(zakatFitrah, "BeneficiaryApproved")
        .withArgs(beneficiary1.address, owner.address);
      expect(await zakatFitrah.approvedBeneficiaries(beneficiary1.address)).to.be.true;
    });

    it("reverts if approval attempted a second time (no longer pending)", async function () {
      await zakatFitrah.submitBeneficiaryForReview(beneficiary1.address);
      await zakatFitrah.approveBeneficiary(beneficiary1.address);
      await expect(
        zakatFitrah.approveBeneficiary(beneficiary1.address)
      ).to.be.revertedWith("Not pending");
    });
  });

  // ─── T7: revokeBeneficiary removes role ───────────────────────────────────
  describe("T7 – revokeBeneficiary removes BENEFICIARY_ROLE", function () {
    it("removes the role and the approved mapping flag", async function () {
      await seedApprovedBeneficiary(beneficiary1.address);
      const BENEFICIARY_ROLE = await zakatFitrah.BENEFICIARY_ROLE();
      expect(await zakatFitrah.hasRole(BENEFICIARY_ROLE, beneficiary1.address)).to.be.true;

      await expect(zakatFitrah.revokeBeneficiary(beneficiary1.address))
        .to.emit(zakatFitrah, "BeneficiaryRevoked")
        .withArgs(beneficiary1.address, owner.address);

      expect(await zakatFitrah.hasRole(BENEFICIARY_ROLE, beneficiary1.address)).to.be.false;
      expect(await zakatFitrah.approvedBeneficiaries(beneficiary1.address)).to.be.false;
    });
  });

  // ─── T8: getDonationsByDonor ──────────────────────────────────────────────
  describe("T8 – getDonationsByDonor returns correct donations", function () {
    it("returns only the donations belonging to the queried donor", async function () {
      const amount1 = MIN_DONATION;
      const amount2 = ethers.parseEther("0.001");

      await zakatFitrah.connect(donor1).donateZakat({ value: amount1 });
      await zakatFitrah.connect(donor2).donateZakat({ value: amount2 });
      await zakatFitrah.connect(donor1).donateZakat({ value: amount1 });

      const donor1Donations = await zakatFitrah.getDonationsByDonor(donor1.address);
      expect(donor1Donations.length).to.equal(2);
      expect(donor1Donations[0].donor).to.equal(donor1.address);
      expect(donor1Donations[1].donor).to.equal(donor1.address);

      const donor2Donations = await zakatFitrah.getDonationsByDonor(donor2.address);
      expect(donor2Donations.length).to.equal(1);
      expect(donor2Donations[0].amount).to.equal(amount2);
    });

    it("returns empty array for address with no donations", async function () {
      const result = await zakatFitrah.getDonationsByDonor(attacker.address);
      expect(result.length).to.equal(0);
    });
  });

  // ─── T9: Pause blocks donateZakat and distributeFunds ─────────────────────
  describe("T9 – Pausing blocks donateZakat and distributeFunds", function () {
    it("donateZakat reverts when paused", async function () {
      await zakatFitrah.pause();
      await expect(
        zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION })
      ).to.be.revertedWithCustomError(zakatFitrah, "EnforcedPause");
    });

    it("distributeFunds reverts when paused", async function () {
      // Donate and approve before pausing so balance/approval are not the issue.
      await zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION });
      await seedApprovedBeneficiary(beneficiary1.address);
      await zakatFitrah.pause();

      await expect(
        zakatFitrah
          .connect(owner)
          .distributeFunds([beneficiary1.address], [MIN_DONATION])
      ).to.be.revertedWithCustomError(zakatFitrah, "EnforcedPause");
    });

    it("works again after unpause", async function () {
      await zakatFitrah.pause();
      await zakatFitrah.unpause();
      await expect(
        zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION })
      ).to.not.be.reverted;
    });
  });

  // ─── T10: Reentrancy protection ───────────────────────────────────────────
  describe("T10 – Reentrancy attack on distributeFunds is blocked", function () {
    it("deploys a malicious contract that attempts reentrancy and reverts", async function () {
      // Deploy the malicious receiver inline via bytecode.
      // The attacker contract's receive() tries to call distributeFunds again.
      const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
      const attackerContract = await AttackerFactory.deploy(
        await zakatFitrah.getAddress()
      );
      await attackerContract.waitForDeployment();

      // Fund the zakat contract via a legitimate donation.
      await zakatFitrah.connect(donor1).donateZakat({ value: ethers.parseEther("0.01") });

      // Approve the attacker contract as beneficiary.
      await zakatFitrah.submitBeneficiaryForReview(await attackerContract.getAddress());
      await zakatFitrah.approveBeneficiary(await attackerContract.getAddress());

      // Attempt distribution to the malicious contract — should fail.
      await expect(
        zakatFitrah
          .connect(owner)
          .distributeFunds(
            [await attackerContract.getAddress()],
            [ethers.parseEther("0.001")]
          )
      ).to.be.reverted;
    });
  });

  // ─── Additional coverage ──────────────────────────────────────────────────
  describe("getUserRole – role precedence", function () {
    it("returns ADMIN for the deployer", async function () {
      expect(await zakatFitrah.getUserRole(owner.address)).to.equal("ADMIN");
    });

    it("returns DONOR after donation", async function () {
      await zakatFitrah.connect(donor1).donateZakat({ value: MIN_DONATION });
      expect(await zakatFitrah.getUserRole(donor1.address)).to.equal("DONOR");
    });

    it("returns BENEFICIARY after approval", async function () {
      await seedApprovedBeneficiary(beneficiary1.address);
      expect(await zakatFitrah.getUserRole(beneficiary1.address)).to.equal("BENEFICIARY");
    });

    it("returns NONE for unknown address", async function () {
      expect(await zakatFitrah.getUserRole(attacker.address)).to.equal("NONE");
    });
  });

  describe("distributeFunds – happy path", function () {
    it("transfers ETH and emits FundsDistributed", async function () {
      const donationAmt = ethers.parseEther("0.01");
      const distAmt     = ethers.parseEther("0.005");

      await zakatFitrah.connect(donor1).donateZakat({ value: donationAmt });
      await seedApprovedBeneficiary(beneficiary1.address);

      const before = await ethers.provider.getBalance(beneficiary1.address);

      await expect(
        zakatFitrah.connect(owner).distributeFunds([beneficiary1.address], [distAmt])
      )
        .to.emit(zakatFitrah, "FundsDistributed")
        .withArgs(0n, beneficiary1.address, distAmt, owner.address);

      const after = await ethers.provider.getBalance(beneficiary1.address);
      expect(after - before).to.equal(distAmt);
      expect(await zakatFitrah.totalDistributed()).to.equal(distAmt);
    });
  });

  describe("addAdmin", function () {
    it("grants ADMIN_ROLE and emits AdminAdded", async function () {
      await expect(zakatFitrah.addAdmin(admin2.address))
        .to.emit(zakatFitrah, "AdminAdded")
        .withArgs(admin2.address, owner.address);

      const ADMIN_ROLE = await zakatFitrah.ADMIN_ROLE();
      expect(await zakatFitrah.hasRole(ADMIN_ROLE, admin2.address)).to.be.true;
    });

    it("reverts when called by a non-DEFAULT_ADMIN", async function () {
      const DEFAULT_ADMIN_ROLE = await zakatFitrah.DEFAULT_ADMIN_ROLE();
      await expect(
        zakatFitrah.connect(attacker).addAdmin(attacker.address)
      ).to.be.revertedWithCustomError(zakatFitrah, "AccessControlUnauthorizedAccount")
       .withArgs(attacker.address, DEFAULT_ADMIN_ROLE);
    });
  });

  describe("direct ETH send", function () {
    it("reverts with 'Use donateZakat()'", async function () {
      await expect(
        donor1.sendTransaction({ to: await zakatFitrah.getAddress(), value: MIN_DONATION })
      ).to.be.revertedWith("Use donateZakat()");
    });
  });
});
