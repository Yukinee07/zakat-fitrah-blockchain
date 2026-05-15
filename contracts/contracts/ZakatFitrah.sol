// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract ZakatFitrah is AccessControl, ReentrancyGuard, Pausable {
    // ─── Roles ────────────────────────────────────────────────────────────────
    bytes32 public constant ADMIN_ROLE       = keccak256("ADMIN_ROLE");
    bytes32 public constant BENEFICIARY_ROLE = keccak256("BENEFICIARY_ROLE");
    bytes32 public constant DONOR_ROLE       = keccak256("DONOR_ROLE");

    // ─── R1: Minimum donation (≈ RM 1.00) ────────────────────────────────────
    uint256 public constant MIN_DONATION_WEI = 0.0003 ether;

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Donation {
        uint256 id;
        address donor;
        uint256 amount;
        uint256 timestamp;
        bool distributed;
    }

    struct Distribution {
        uint256 id;
        address beneficiary;
        uint256 amount;
        uint256 timestamp;
        uint256[] sourceDonationIds;
    }

    struct ScheduledPayment {
        address donor;
        uint256 amount;
        uint256 releaseTime;
        bool    executed;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    Donation[]     public donations;
    Distribution[] public distributions;

    uint256 public scheduledPaymentCount;
    uint256 public totalEscrowed;
    mapping(uint256 => ScheduledPayment) public scheduledPayments;

    mapping(address => uint256[]) public donationsByDonor;
    mapping(address => uint256[]) public distributionsByBeneficiary;
    mapping(address => bool)      public approvedBeneficiaries;
    mapping(address => bool)      public pendingBeneficiaries;

    // Ordered list of all ever-approved Mustahiq addresses (used for equal distribution).
    address[] public mustahiqList;
    mapping(address => bool) private _inMustahiqList;

    uint256 public totalPool;
    uint256 public totalDistributed;

    // ─── Events ───────────────────────────────────────────────────────────────
    event DonationReceived(
        uint256 indexed id,
        address indexed donor,
        uint256 amount,
        uint256 timestamp
    );
    event BeneficiarySubmitted(address indexed beneficiary);
    event BeneficiaryApproved(address indexed beneficiary, address indexed admin);
    event BeneficiaryRevoked(address indexed beneficiary, address indexed admin);
    event FundsDistributed(
        uint256 indexed distributionId,
        address indexed beneficiary,
        uint256 amount,
        address indexed admin
    );
    event AdminAdded(address indexed admin, address indexed grantedBy);
    event EqualDistribution(uint256 totalAmount, uint256 mustahiqCount, uint256 amountEach);
    event PaymentScheduled(
        uint256 indexed paymentId,
        address indexed donor,
        uint256 amount,
        uint256 releaseTime
    );
    event ScheduledPaymentExecuted(
        uint256 indexed paymentId,
        address indexed donor,
        uint256 amount
    );
    event ScheduledPaymentCancelled(
        uint256 indexed paymentId,
        address indexed donor,
        uint256 refundAmount
    );

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ─── Donor Functions ──────────────────────────────────────────────────────

    /// @notice Pay Zakat Fitrah immediately. Minimum 0.0003 ETH (R1).
    function donateZakat()
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(msg.value >= MIN_DONATION_WEI, "Below minimum threshold");

        uint256 donationId = donations.length;

        donations.push(Donation({
            id:          donationId,
            donor:       msg.sender,
            amount:      msg.value,
            timestamp:   block.timestamp,
            distributed: false
        }));

        donationsByDonor[msg.sender].push(donationId);
        totalPool += msg.value;

        if (!hasRole(DONOR_ROLE, msg.sender)) {
            _grantRole(DONOR_ROLE, msg.sender);
        }

        emit DonationReceived(donationId, msg.sender, msg.value, block.timestamp);
    }

    // ─── Scheduled Payments ───────────────────────────────────────────────────

    /// @notice Lock ETH now to be recorded as a donation at a future time.
    ///         The server's operator wallet calls executeScheduledPayment() when due.
    function schedulePayment(uint256 releaseTime)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(msg.value >= MIN_DONATION_WEI, "Below minimum threshold");
        require(releaseTime > block.timestamp, "Release time must be in the future");

        uint256 paymentId = scheduledPaymentCount;
        scheduledPaymentCount++;

        scheduledPayments[paymentId] = ScheduledPayment({
            donor:       msg.sender,
            amount:      msg.value,
            releaseTime: releaseTime,
            executed:    false
        });
        totalEscrowed += msg.value;

        emit PaymentScheduled(paymentId, msg.sender, msg.value, releaseTime);
    }

    /// @notice Anyone can call this once releaseTime has passed.
    ///         Normally the server's cron job calls it automatically.
    function executeScheduledPayment(uint256 paymentId)
        external
        whenNotPaused
        nonReentrant
    {
        ScheduledPayment storage payment = scheduledPayments[paymentId];
        require(!payment.executed,                      "Already executed");
        require(block.timestamp >= payment.releaseTime, "Not yet due");
        require(payment.amount > 0,                     "Invalid payment");

        payment.executed = true;
        totalEscrowed   -= payment.amount;

        uint256 donationId = donations.length;
        donations.push(Donation({
            id:          donationId,
            donor:       payment.donor,
            amount:      payment.amount,
            timestamp:   block.timestamp,
            distributed: false
        }));
        donationsByDonor[payment.donor].push(donationId);
        totalPool += payment.amount;

        if (!hasRole(DONOR_ROLE, payment.donor)) {
            _grantRole(DONOR_ROLE, payment.donor);
        }

        emit DonationReceived(donationId, payment.donor, payment.amount, block.timestamp);
        emit ScheduledPaymentExecuted(paymentId, payment.donor, payment.amount);
    }

    /// @notice Donor can cancel their own scheduled payment before it is due.
    ///         ETH is refunded; no refund if already past releaseTime.
    function cancelScheduledPayment(uint256 paymentId) external nonReentrant {
        ScheduledPayment storage payment = scheduledPayments[paymentId];
        require(payment.donor == msg.sender,            "Not the donor");
        require(!payment.executed,                      "Already executed");
        require(block.timestamp < payment.releaseTime,  "Payment already due");

        uint256 refundAmount = payment.amount;
        payment.executed     = true;
        payment.amount       = 0;
        totalEscrowed       -= refundAmount;

        (bool ok, ) = payment.donor.call{value: refundAmount}("");
        require(ok, "Refund failed");

        emit ScheduledPaymentCancelled(paymentId, payment.donor, refundAmount);
    }

    // ─── Beneficiary Management (Admin) ───────────────────────────────────────

    function submitBeneficiaryForReview(address beneficiary)
        external
        onlyRole(ADMIN_ROLE)
    {
        pendingBeneficiaries[beneficiary] = true;
        emit BeneficiarySubmitted(beneficiary);
    }

    function approveBeneficiary(address beneficiary)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(pendingBeneficiaries[beneficiary], "Not pending");
        pendingBeneficiaries[beneficiary] = false;
        approvedBeneficiaries[beneficiary] = true;
        _grantRole(BENEFICIARY_ROLE, beneficiary);

        // Track in mustahiqList for equal distribution
        if (!_inMustahiqList[beneficiary]) {
            mustahiqList.push(beneficiary);
            _inMustahiqList[beneficiary] = true;
        }

        emit BeneficiaryApproved(beneficiary, msg.sender);
    }

    function revokeBeneficiary(address beneficiary)
        external
        onlyRole(ADMIN_ROLE)
    {
        approvedBeneficiaries[beneficiary] = false;
        _revokeRole(BENEFICIARY_ROLE, beneficiary);
        emit BeneficiaryRevoked(beneficiary, msg.sender);
    }

    /// @notice Distribute the entire available pool equally among all approved Mustahiq.
    ///         Called automatically by the server scheduler on the Zakat date,
    ///         or manually by admin at any time.
    function distributeEqually()
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
        nonReentrant
    {
        // Build active Mustahiq list
        uint256 count = 0;
        for (uint256 i = 0; i < mustahiqList.length; i++) {
            if (approvedBeneficiaries[mustahiqList[i]]) count++;
        }
        require(count > 0, "No approved Mustahiq");

        uint256 available = address(this).balance - totalEscrowed;
        require(available > 0, "No funds to distribute");

        uint256 amountEach = available / count;
        require(amountEach > 0, "Amount per Mustahiq too small");

        uint256[] memory emptyIds = new uint256[](0);

        // EFFECTS
        for (uint256 i = 0; i < mustahiqList.length; i++) {
            address mustahiq = mustahiqList[i];
            if (!approvedBeneficiaries[mustahiq]) continue;

            uint256 distId = distributions.length;
            distributions.push(Distribution({
                id:                distId,
                beneficiary:       mustahiq,
                amount:            amountEach,
                timestamp:         block.timestamp,
                sourceDonationIds: emptyIds
            }));
            distributionsByBeneficiary[mustahiq].push(distId);
            totalDistributed += amountEach;
            emit FundsDistributed(distId, mustahiq, amountEach, msg.sender);
        }

        emit EqualDistribution(available, count, amountEach);

        // INTERACTIONS
        for (uint256 i = 0; i < mustahiqList.length; i++) {
            address mustahiq = mustahiqList[i];
            if (!approvedBeneficiaries[mustahiq]) continue;
            (bool ok, ) = mustahiq.call{value: amountEach}("");
            require(ok, "ETH transfer to Mustahiq failed");
        }
    }

    function getApprovedMustahiq() external view returns (address[] memory list) {
        uint256 count = 0;
        for (uint256 i = 0; i < mustahiqList.length; i++) {
            if (approvedBeneficiaries[mustahiqList[i]]) count++;
        }
        list = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < mustahiqList.length; i++) {
            if (approvedBeneficiaries[mustahiqList[i]]) list[idx++] = mustahiqList[i];
        }
    }

    // ─── Distribution (Admin) ─────────────────────────────────────────────────

    function distributeFunds(
        address[] calldata beneficiaries,
        uint256[] calldata amounts
    )
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(beneficiaries.length > 0, "Empty arrays");
        require(beneficiaries.length == amounts.length, "Array length mismatch");

        uint256 total = 0;
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            require(approvedBeneficiaries[beneficiaries[i]], "Beneficiary not approved");
            total += amounts[i];
        }
        // Only distributable balance = balance minus escrowed scheduled payments
        require(total <= address(this).balance - totalEscrowed, "Insufficient distributable balance");

        uint256[] memory emptyIds = new uint256[](0);

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            uint256 distId = distributions.length;
            distributions.push(Distribution({
                id:               distId,
                beneficiary:      beneficiaries[i],
                amount:           amounts[i],
                timestamp:        block.timestamp,
                sourceDonationIds: emptyIds
            }));
            distributionsByBeneficiary[beneficiaries[i]].push(distId);
            totalDistributed += amounts[i];
            emit FundsDistributed(distId, beneficiaries[i], amounts[i], msg.sender);
        }

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            (bool success, ) = beneficiaries[i].call{value: amounts[i]}("");
            require(success, "ETH transfer failed");
        }
    }

    // ─── Admin Management ─────────────────────────────────────────────────────

    function addAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ADMIN_ROLE, newAdmin);
        emit AdminAdded(newAdmin, msg.sender);
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getDonationsByDonor(address donor)
        external
        view
        returns (Donation[] memory)
    {
        uint256[] storage ids = donationsByDonor[donor];
        Donation[] memory result = new Donation[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = donations[ids[i]];
        }
        return result;
    }

    function getDistributionsByBeneficiary(address beneficiary)
        external
        view
        returns (Distribution[] memory)
    {
        uint256[] storage ids = distributionsByBeneficiary[beneficiary];
        Distribution[] memory result = new Distribution[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = distributions[ids[i]];
        }
        return result;
    }

    function getScheduledPaymentsByDonor(address donor)
        external
        view
        returns (uint256[] memory ids, ScheduledPayment[] memory pmts)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < scheduledPaymentCount; i++) {
            if (scheduledPayments[i].donor == donor) count++;
        }
        ids  = new uint256[](count);
        pmts = new ScheduledPayment[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < scheduledPaymentCount; i++) {
            if (scheduledPayments[i].donor == donor) {
                ids[idx]  = i;
                pmts[idx] = scheduledPayments[i];
                idx++;
            }
        }
    }

    function getPendingScheduledPayments()
        external
        view
        returns (uint256[] memory ids, ScheduledPayment[] memory pmts)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < scheduledPaymentCount; i++) {
            if (!scheduledPayments[i].executed) count++;
        }
        ids  = new uint256[](count);
        pmts = new ScheduledPayment[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < scheduledPaymentCount; i++) {
            if (!scheduledPayments[i].executed) {
                ids[idx]  = i;
                pmts[idx] = scheduledPayments[i];
                idx++;
            }
        }
    }

    function getDonationCount()     external view returns (uint256) { return donations.length; }
    function getDistributionCount() external view returns (uint256) { return distributions.length; }
    function getContractBalance()   external view returns (uint256) { return address(this).balance; }

    function getUserRole(address user) external view returns (string memory) {
        if (hasRole(ADMIN_ROLE, user))       return "ADMIN";
        if (hasRole(BENEFICIARY_ROLE, user)) return "BENEFICIARY";
        if (hasRole(DONOR_ROLE, user))       return "DONOR";
        return "NONE";
    }

    receive() external payable {
        revert("Use donateZakat() or schedulePayment()");
    }
}
