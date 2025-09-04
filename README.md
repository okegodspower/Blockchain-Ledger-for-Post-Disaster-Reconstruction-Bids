# 🌪️ Blockchain Ledger for Post-Disaster Reconstruction Bids

Welcome to a transparent and corruption-resistant system for managing reconstruction bids after natural disasters! This Web3 project uses the Stacks blockchain and Clarity smart contracts to create an immutable ledger for project bids, ensuring fair contract awards, preventing bribery, and enabling public oversight in high-stakes recovery efforts.

## ✨ Features

🔒 Immutable bid submissions and evaluations to eliminate tampering  
📈 Transparent project registry for disaster-affected areas  
🗳️ Decentralized voting for bid selection by verified stakeholders  
💰 Escrow mechanisms for secure fund releases tied to milestones  
🕵️‍♂️ Audit trails for full traceability and anti-corruption compliance  
📊 Public dashboards for real-time monitoring by donors, governments, and citizens  
🚫 Automated checks to prevent duplicate or fraudulent bids  
🔍 Dispute resolution with on-chain evidence  

## 🛠 How It Works

This project addresses real-world corruption in post-disaster reconstruction (e.g., after hurricanes, earthquakes, or floods) by leveraging blockchain's transparency. Agencies post projects, contractors submit sealed bids, evaluators score them openly, and funds are released only upon verified progress—all recorded immutably to deter kickbacks and favoritism.

**For Disaster Agencies/Governments**  
- Register a new reconstruction project (e.g., rebuilding schools or roads) with details like scope, budget, and timeline.  
- Invite bids and set evaluation criteria.  
- Oversee automated bid opening and selection via decentralized voting.  

**For Contractors/Bidders**  
- Register as a verified participant.  
- Submit encrypted bids with cost breakdowns and qualifications.  
- Track bid status and participate in milestone verifications for payments.  

**For Evaluators/Stakeholders**  
- Vote on bid selections using governance tokens or roles.  
- Review all bids transparently post-submission deadline.  
- Initiate disputes with on-chain evidence if irregularities are suspected.  

**For Donors and the Public**  
- View real-time project status, bid details, and fund usage via public queries.  
- Audit historical data to ensure accountability.  

Boom! Reconstruction funds are allocated fairly, with every step verifiable on the blockchain—reducing corruption that plagues disaster recovery worldwide.

## 📜 Smart Contracts (Clarity Implementation)

This project involves 8 interconnected Clarity smart contracts for modularity, security, and scalability on the Stacks blockchain:

1. **ProjectRegistry.clar**: Handles registration of new reconstruction projects, storing details like location, budget, and deadlines. Ensures only authorized agencies can create projects.  
2. **UserRegistry.clar**: Manages participant registration (agencies, contractors, evaluators) with KYC-like verification hashes to prevent anonymous fraud.  
3. **BidSubmission.clar**: Allows sealed bid submissions with hashes for confidentiality until the reveal phase, preventing early leaks.  
4. **BidEvaluation.clar**: Automates bid opening, scoring based on predefined criteria, and tallies evaluator votes for winner selection.  
5. **Governance.clar**: Enables decentralized voting among stakeholders using STX or custom tokens for decisions like bid approvals or extensions.  
6. **PaymentEscrow.clar**: Holds funds in escrow, releasing them in tranches upon milestone verifications confirmed on-chain.  
7. **DisputeResolution.clar**: Facilitates on-chain disputes with evidence submission, voting, and potential fund clawbacks.  
8. **AuditTrail.clar**: Logs all actions across contracts immutably, allowing queries for transparency reports and compliance audits.  

These contracts interact via traits and cross-calls, ensuring a robust system where data flows securely between modules.