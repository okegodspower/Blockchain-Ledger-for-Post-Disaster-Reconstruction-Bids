// BidSubmission.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Bid {
  bidder: string;
  bidHash: Uint8Array;
  submittedAt: number;
}

interface BidDetails {
  bidHash: Uint8Array;
  amount: number;
  description: string;
  revealed: boolean;
  revealedAt: number | null;
}

interface ProjectBids {
  bids: Bid[];
}

interface ContractState {
  paused: boolean;
  admin: string;
  projectBids: Map<number, ProjectBids>;
  bidDetails: Map<string, BidDetails>; // Key: `${projectId}-${bidder}`
}

// Mock contract implementation
class BidSubmissionMock {
  private state: ContractState = {
    paused: false,
    admin: "deployer",
    projectBids: new Map(),
    bidDetails: new Map(),
  };

  private readonly ERR_UNAUTHORIZED = 200;
  private readonly ERR_PROJECT_NOT_FOUND = 201;
  private readonly ERR_BID_ALREADY_SUBMITTED = 202;
  private readonly ERR_INVALID_BID_HASH = 205;
  private readonly ERR_PAUSED = 206;
  private readonly ERR_BID_NOT_FOUND = 208;
  private readonly ERR_INVALID_REVEAL = 210;
  private readonly ERR_BIDS_ALREADY_OPENED = 211;
  private readonly MAX_BIDS_PER_PROJECT = 50;
  private readonly MAX_DESCRIPTION_LEN = 500;
  private readonly BID_HASH_LEN = 32;

  private currentBlock = 100; // Mock block height

  // For testing: Allow setting mock block height
  public setMockBlock(block: number) {
    this.currentBlock = block;
  }

  // Initialize a project for testing
  public initializeProject(projectId: number) {
    this.state.projectBids.set(projectId, { bids: [] });
  }

  // Mock hash function
  public sha256(input: Uint8Array): Uint8Array {
    return new Uint8Array(createHash("sha256").update(input).digest());
  }

  // Mock conversion functions
  public uintToBytes(value: number): Uint8Array {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigUint64(0, BigInt(value));
    return new Uint8Array(buffer);
  }

  public stringToBytes(value: string): Uint8Array {
    return new globalThis.TextEncoder().encode(value);
  }

  public principalToBytes(value: string): Uint8Array {
    return new globalThis.TextEncoder().encode(value);
  }

  public pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  public unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  public setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (caller === newAdmin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  public submitBid(caller: string, projectId: number, bidHash: Uint8Array): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.state.projectBids.has(projectId)) {
      return { ok: false, value: this.ERR_PROJECT_NOT_FOUND };
    }
    const bidKey = `${projectId}-${caller}`;
    if (this.state.bidDetails.has(bidKey)) {
      return { ok: false, value: this.ERR_BID_ALREADY_SUBMITTED };
    }
    if (bidHash.length !== this.BID_HASH_LEN) {
      return { ok: false, value: this.ERR_INVALID_BID_HASH };
    }
    const currentBids = this.state.projectBids.get(projectId) || { bids: [] };
    if (currentBids.bids.length >= this.MAX_BIDS_PER_PROJECT) {
      return { ok: false, value: this.ERR_BIDS_ALREADY_OPENED };
    }
    currentBids.bids.push({ bidder: caller, bidHash, submittedAt: this.currentBlock });
    this.state.projectBids.set(projectId, { bids: currentBids.bids });
    this.state.bidDetails.set(bidKey, {
      bidHash,
      amount: 0,
      description: "",
      revealed: false,
      revealedAt: null,
    });
    return { ok: true, value: true };
  }

  public revealBid(caller: string, projectId: number, amount: number, description: string, bidHash: Uint8Array): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.state.projectBids.has(projectId)) {
      return { ok: false, value: this.ERR_PROJECT_NOT_FOUND };
    }
    const bidKey = `${projectId}-${caller}`;
    const bidderEntry = this.state.bidDetails.get(bidKey);
    if (!bidderEntry) {
      return { ok: false, value: this.ERR_BID_NOT_FOUND };
    }
    if (bidderEntry.revealed) {
      return { ok: false, value: this.ERR_BID_ALREADY_SUBMITTED };
    }
    const computedHash = this.sha256(
      new Uint8Array([...this.uintToBytes(amount), ...this.stringToBytes(description), ...this.principalToBytes(caller)])
    );
    if (!bidderEntry.bidHash.every((b, i) => b === bidHash[i]) || !bidHash.every((b, i) => b === computedHash[i])) {
      return { ok: false, value: this.ERR_INVALID_REVEAL };
    }
    if (description.length > this.MAX_DESCRIPTION_LEN) {
      return { ok: false, value: this.ERR_INVALID_REVEAL };
    }
    this.state.bidDetails.set(bidKey, {
      ...bidderEntry,
      amount,
      description,
      revealed: true,
      revealedAt: this.currentBlock,
    });
    return { ok: true, value: true };
  }

  public withdrawBid(caller: string, projectId: number): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.state.projectBids.has(projectId)) {
      return { ok: false, value: this.ERR_PROJECT_NOT_FOUND };
    }
    const bidKey = `${projectId}-${caller}`;
    const bidderEntry = this.state.bidDetails.get(bidKey);
    if (!bidderEntry) {
      return { ok: false, value: this.ERR_BID_NOT_FOUND };
    }
    if (bidderEntry.revealed) {
      return { ok: false, value: this.ERR_BIDS_ALREADY_OPENED };
    }
    const currentBids = this.state.projectBids.get(projectId)!;
    this.state.projectBids.set(projectId, {
      bids: currentBids.bids.filter(bid => bid.bidder !== caller),
    });
    this.state.bidDetails.delete(bidKey);
    return { ok: true, value: true };
  }

  public getBidDetails(projectId: number, bidder: string): ClarityResponse<BidDetails | null> {
    return { ok: true, value: this.state.bidDetails.get(`${projectId}-${bidder}`) ?? null };
  }

  public getProjectBids(projectId: number): ClarityResponse<ProjectBids | null> {
    return { ok: true, value: this.state.projectBids.get(projectId) ?? null };
  }

  public isContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  public getAdmin(): ClarityResponse<string> {
    return { ok: true, value: this.state.admin };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  bidder1: "bidder1",
  bidder2: "bidder2",
  agency: "agency",
};

describe("BidSubmission Contract", () => {
  let contract: BidSubmissionMock;

  beforeEach(() => {
    contract = new BidSubmissionMock();
    vi.resetAllMocks();
    contract.setMockBlock(100);
    // Initialize a project for testing
    contract.initializeProject(1); // Ensure project exists in projectBids map
  });

  it("should initialize with correct defaults", () => {
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
    expect(contract.getAdmin()).toEqual({ ok: true, value: "deployer" });
  });

  it("should allow admin to pause and unpause", () => {
    const pause = contract.pauseContract(accounts.deployer);
    expect(pause).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: true });

    const unpause = contract.unpauseContract(accounts.deployer);
    expect(unpause).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
  });

  it("should prevent non-admin from pausing", () => {
    const pause = contract.pauseContract(accounts.bidder1);
    expect(pause).toEqual({ ok: false, value: 200 });
  });

  it("should allow admin to change admin", () => {
    const setAdmin = contract.setAdmin(accounts.deployer, accounts.agency);
    expect(setAdmin).toEqual({ ok: true, value: true });
    expect(contract.getAdmin()).toEqual({ ok: true, value: accounts.agency });
  });

  it("should prevent setting same admin", () => {
    const setAdmin = contract.setAdmin(accounts.deployer, accounts.deployer);
    expect(setAdmin).toEqual({ ok: false, value: 200 });
  });

  it("should allow bidder to submit a bid", () => {
    const bidHash = new Uint8Array(32).fill(1);
    const submit = contract.submitBid(accounts.bidder1, 1, bidHash);
    expect(submit).toEqual({ ok: true, value: true });

    const bidDetails = contract.getBidDetails(1, accounts.bidder1);
    expect(bidDetails).toEqual({
      ok: true,
      value: expect.objectContaining({
        bidHash,
        amount: 0,
        description: "",
        revealed: false,
        revealedAt: null,
      }),
    });

    const projectBids = contract.getProjectBids(1);
    expect(projectBids).toEqual({
      ok: true,
      value: expect.objectContaining({
        bids: expect.arrayContaining([
          expect.objectContaining({ bidder: accounts.bidder1, bidHash, submittedAt: 100 }),
        ]),
      }),
    });
  });

  it("should prevent duplicate bid submission", () => {
    const bidHash = new Uint8Array(32).fill(1);
    contract.submitBid(accounts.bidder1, 1, bidHash);
    const secondSubmit = contract.submitBid(accounts.bidder1, 1, bidHash);
    expect(secondSubmit).toEqual({ ok: false, value: 202 });
  });

  it("should prevent submission with invalid hash", () => {
    const invalidHash = new Uint8Array(31);
    const submit = contract.submitBid(accounts.bidder1, 1, invalidHash);
    expect(submit).toEqual({ ok: false, value: 205 });
  });

  it("should allow bidder to reveal bid", () => {
    const amount = 1000;
    const description = "Rebuild school";
    const bidder = accounts.bidder1;
    const bidHash = contract.sha256(
      new Uint8Array([...contract.uintToBytes(amount), ...contract.stringToBytes(description), ...contract.principalToBytes(bidder)])
    );
    contract.submitBid(accounts.bidder1, 1, bidHash);
    const reveal = contract.revealBid(accounts.bidder1, 1, amount, description, bidHash);
    expect(reveal).toEqual({ ok: true, value: true });

    const bidDetails = contract.getBidDetails(1, accounts.bidder1);
    expect(bidDetails).toEqual({
      ok: true,
      value: expect.objectContaining({
        amount: 1000,
        description: "Rebuild school",
        revealed: true,
        revealedAt: 100,
      }),
    });
  });

  it("should prevent reveal with incorrect hash", () => {
    const bidHash = new Uint8Array(32).fill(1);
    contract.submitBid(accounts.bidder1, 1, bidHash);
    const wrongHash = new Uint8Array(32).fill(2);
    const reveal = contract.revealBid(accounts.bidder1, 1, 1000, "Rebuild school", wrongHash);
    expect(reveal).toEqual({ ok: false, value: 210 });
  });

  it("should prevent reveal for non-existent bid", () => {
    const bidHash = new Uint8Array(32).fill(1);
    const reveal = contract.revealBid(accounts.bidder1, 1, 1000, "Rebuild school", bidHash);
    expect(reveal).toEqual({ ok: false, value: 208 });
  });

  it("should allow bidder to withdraw unrevealed bid", () => {
    const bidHash = new Uint8Array(32).fill(1);
    contract.submitBid(accounts.bidder1, 1, bidHash);
    const withdraw = contract.withdrawBid(accounts.bidder1, 1);
    expect(withdraw).toEqual({ ok: true, value: true });

    const bidDetails = contract.getBidDetails(1, accounts.bidder1);
    expect(bidDetails).toEqual({ ok: true, value: null });

    const projectBids = contract.getProjectBids(1);
    expect(projectBids).toEqual({ ok: true, value: { bids: [] } });
  });

  it("should prevent withdrawal of revealed bid", () => {
    const amount = 1000;
    const description = "Rebuild school";
    const bidder = accounts.bidder1;
    const bidHash = contract.sha256(
      new Uint8Array([...contract.uintToBytes(amount), ...contract.stringToBytes(description), ...contract.principalToBytes(bidder)])
    );
    contract.submitBid(accounts.bidder1, 1, bidHash);
    contract.revealBid(accounts.bidder1, 1, amount, description, bidHash);
    const withdraw = contract.withdrawBid(accounts.bidder1, 1);
    expect(withdraw).toEqual({ ok: false, value: 211 });
  });

  it("should prevent operations when paused", () => {
    contract.pauseContract(accounts.deployer);
    const bidHash = new Uint8Array(32).fill(1);
    const submit = contract.submitBid(accounts.bidder1, 1, bidHash);
    expect(submit).toEqual({ ok: false, value: 206 });

    const reveal = contract.revealBid(accounts.bidder1, 1, 1000, "Rebuild school", bidHash);
    expect(reveal).toEqual({ ok: false, value: 206 });

    const withdraw = contract.withdrawBid(accounts.bidder1, 1);
    expect(withdraw).toEqual({ ok: false, value: 206 });
  });
});