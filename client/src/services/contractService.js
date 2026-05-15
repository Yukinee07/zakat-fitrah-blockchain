import { ethers } from "ethers";

export function makeContractService(contract) {
  return {
    async donate(amountEth) {
      const value = ethers.parseEther(String(amountEth));
      const tx    = await contract.donateZakat({ value });
      return tx.wait();
    },

    async schedulePayment(amountEth, releaseTime) {
      const value = ethers.parseEther(String(amountEth));
      const tx    = await contract.schedulePayment(releaseTime, { value });
      return tx.wait();
    },

    async cancelScheduledPayment(paymentId) {
      const tx = await contract.cancelScheduledPayment(paymentId);
      return tx.wait();
    },

    async getMyScheduledPayments(address) {
      const [ids, pmts] = await contract.getScheduledPaymentsByDonor(address);
      return ids.map((id, i) => ({
        paymentId:   Number(id),
        donor:       pmts[i].donor,
        amount:      pmts[i].amount.toString(),
        releaseTime: Number(pmts[i].releaseTime),
        executed:    pmts[i].executed,
      }));
    },

    async distributeEqually() {
      const tx = await contract.distributeEqually();
      return tx.wait();
    },

    async distribute(addresses, amountsEthArray) {
      const amounts = amountsEthArray.map((a) => ethers.parseEther(String(a)));
      const tx      = await contract.distributeFunds(addresses, amounts);
      return tx.wait();
    },

    async submitBeneficiary(address) {
      const tx = await contract.submitBeneficiaryForReview(address);
      return tx.wait();
    },

    async approveBeneficiary(address) {
      const tx = await contract.approveBeneficiary(address);
      return tx.wait();
    },

    async revokeBeneficiary(address) {
      const tx = await contract.revokeBeneficiary(address);
      return tx.wait();
    },

    async getPoolStats() {
      const [totalPool, totalDistributed, balance] = await Promise.all([
        contract.totalPool(),
        contract.totalDistributed(),
        contract.getContractBalance(),
      ]);
      return {
        totalPool:        ethers.formatEther(totalPool),
        totalDistributed: ethers.formatEther(totalDistributed),
        balance:          ethers.formatEther(balance),
      };
    },

    async getUserRole(address) {
      return contract.getUserRole(address);
    },
  };
}
