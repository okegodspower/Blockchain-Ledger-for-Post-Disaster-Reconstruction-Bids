;; BidSubmission.clar
;; Core smart contract for submitting and managing sealed bids in post-disaster reconstruction projects.
;; Ensures bids are encrypted (via hash) until the reveal phase, preventing premature leaks and ensuring fairness.
;; Integrates with ProjectRegistry.clar for project validation, BidEvaluation.clar for evaluation, and AuditTrail.clar for logging.

;; Constants
(define-constant ERR-UNAUTHORIZED u200) ;; Caller not authorized
(define-constant ERR-PROJECT-NOT-FOUND u201) ;; Project does not exist
(define-constant ERR-BID-ALREADY-SUBMITTED u202) ;; Bid already submitted by caller
(define-constant ERR-SUBMISSION-PERIOD-ENDED u203) ;; Submission period has ended
(define-constant ERR-SUBMISSION-PERIOD-NOT-STARTED u204) ;; Submission period not started
(define-constant ERR-INVALID-BID-HASH u205) ;; Invalid bid hash
(define-constant ERR-PAUSED u206) ;; Contract paused
(define-constant ERR-INVALID-PROJECT u207) ;; Invalid project ID
(define-constant ERR-BID-NOT-FOUND u208) ;; Bid not found for reveal
(define-constant ERR-REVEAL-PERIOD-ENDED u209) ;; Reveal period ended
(define-constant ERR-INVALID-REVEAL u210) ;; Revealed bid does not match hash
(define-constant ERR-BIDS-ALREADY-OPENED u211) ;; Bids already opened for evaluation
(define-constant MAX-BIDS-PER-PROJECT u50) ;; Max bids per project
(define-constant MAX-DESCRIPTION-LEN u500) ;; Max length for bid description
(define-constant BID-HASH-LEN u32) ;; SHA-256 hash length

;; Data Variables
(define-data-var contract-paused bool false)
(define-data-var admin principal tx-sender)

;; Data Maps
(define-map project-bids
  { project-id: uint }
  { bids: (list MAX-BIDS-PER-PROJECT { bidder: principal, bid-hash: (buff 32), submitted-at: uint }) }
)

(define-map bid-details
  { project-id: uint, bidder: principal }
  {
    bid-hash: (buff 32),
    amount: uint,
    description: (string-utf8 500),
    revealed: bool,
    revealed-at: (optional uint)
  }
)

;; Private Functions
(define-private (is-admin (caller principal))
  (is-eq caller (var-get admin))
)

(define-private (is-valid-bid-hash (bid-hash (buff 32)))
  (is-eq (len bid-hash) BID-HASH-LEN)
)

(define-private (project-exists (project-id uint))
  ;; Placeholder: Assumes integration with ProjectRegistry.clar to check project existence
  ;; In practice, use a trait to call ProjectRegistry's get-project function
  (is-some (map-get? project-bids { project-id: project-id }))
)

(define-private (is-submission-period-active (project-id uint))
  ;; Placeholder: Assumes ProjectRegistry provides submission-start and submission-end
  ;; For simplicity, assume submission period is before evaluation-start from BidEvaluation
  true
)

(define-private (is-reveal-period-active (project-id uint))
  ;; Placeholder: Assumes reveal period is between submission-end and evaluation-start
  true
)

;; Public Functions
(define-public (pause-contract)
  (begin
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (var-set contract-paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (var-set contract-paused false)
    (ok true)
  )
)

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (not (is-eq new-admin tx-sender)) (err ERR-UNAUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)

(define-public (submit-bid (project-id uint) (bid-hash (buff 32)))
  (let
    (
      (current-bids (default-to { bids: (list) } (map-get? project-bids { project-id: project-id })))
      (bidder-entry (map-get? bid-details { project-id: project-id, bidder: tx-sender }))
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (project-exists project-id) (err ERR-PROJECT-NOT-FOUND))
    (asserts! (is-submission-period-active project-id) (err ERR-SUBMISSION-PERIOD-NOT-STARTED))
    (asserts! (is-none bidder-entry) (err ERR-BID-ALREADY-SUBMITTED))
    (asserts! (is-valid-bid-hash bid-hash) (err ERR-INVALID-BID-HASH))
    (asserts! (< (len (get bids current-bids)) MAX-BIDS-PER-PROJECT) (err ERR-BIDS-ALREADY-OPENED))
    (map-set project-bids
      { project-id: project-id }
      {
        bids: (unwrap-panic (as-max-len? (append (get bids current-bids) { bidder: tx-sender, bid-hash: bid-hash, submitted-at: block-height }) u50))
      }
    )
    (map-set bid-details
      { project-id: project-id, bidder: tx-sender }
      {
        bid-hash: bid-hash,
        amount: u0,
        description: u"",
        revealed: false,
        revealed-at: none
      }
    )
    ;; Log to AuditTrail
    (ok true)
  )
)

(define-public (reveal-bid (project-id uint) (amount uint) (description (string-utf8 500)) (bid-hash (buff 32)))
  (let
    (
      (bidder-entry (unwrap! (map-get? bid-details { project-id: project-id, bidder: tx-sender }) (err ERR-BID-NOT-FOUND)))
      (computed-hash (sha256 (concat (concat (uint-to-bytes amount) (string-to-bytes description)) (principal-to-bytes tx-sender))))
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (project-exists project-id) (err ERR-PROJECT-NOT-FOUND))
    (asserts! (is-reveal-period-active project-id) (err ERR-REVEAL-PERIOD-ENDED))
    (asserts! (not (get revealed bidder-entry)) (err ERR-BID-ALREADY-SUBMITTED))
    (asserts! (is-eq (get bid-hash bidder-entry) bid-hash) (err ERR-INVALID-REVEAL))
    (asserts! (is-eq computed-hash bid-hash) (err ERR-INVALID-REVEAL))
    (asserts! (<= (len description) MAX-DESCRIPTION-LEN) (err ERR-INVALID-REVEAL))
    (map-set bid-details
      { project-id: project-id, bidder: tx-sender }
      (merge bidder-entry { amount: amount, description: description, revealed: true, revealed-at: (some block-height) })
    )
    ;; Log to AuditTrail
    (ok true)
  )
)

(define-public (withdraw-bid (project-id uint))
  (let
    (
      (bidder-entry (unwrap! (map-get? bid-details { project-id: project-id, bidder: tx-sender }) (err ERR-BID-NOT-FOUND)))
      (current-bids (unwrap! (map-get? project-bids { project-id: project-id }) (err ERR-PROJECT-NOT-FOUND)))
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (project-exists project-id) (err ERR-PROJECT-NOT-FOUND))
    (asserts! (is-submission-period-active project-id) (err ERR-SUBMISSION-PERIOD-ENDED))
    (asserts! (not (get revealed bidder-entry)) (err ERR-BIDS-ALREADY-OPENED))
    (map-set project-bids
      { project-id: project-id }
      {
        bids: (filter (lambda (bid) (not (is-eq (get bidder bid) tx-sender))) (get bids current-bids))
      }
    )
    (map-delete bid-details { project-id: project-id, bidder: tx-sender })
    ;; Log to AuditTrail
    (ok true)
  )
)

;; Read-Only Functions
(define-read-only (get-bid-details (project-id uint) (bidder principal))
  (map-get? bid-details { project-id: project-id, bidder: bidder })
)

(define-read-only (get-project-bids (project-id uint))
  (map-get? project-bids { project-id: project-id })
)

(define-read-only (is-contract-paused)
  (var-get contract-paused)
)

(define-read-only (get-admin)
  (var-get admin)
)

;; Helper Functions (for hash computation, assuming external libraries or native Clarity support)
(define-private (uint-to-bytes (value uint))
  ;; Placeholder: Convert uint to bytes; in practice, use a library or native function
  (unwrap-panic (as-max-len? (concat (buff 1 0x00) (unwrap-panic (int-to-bytes value))) u32))
)

(define-private (string-to-bytes (value (string-utf8 500)))
  ;; Placeholder: Convert string to bytes; in practice, use native Clarity support
  (unwrap-panic (as-max-len? (to-consensus-buff? value) u500))
)

(define-private (principal-to-bytes (value principal))
  ;; Placeholder: Convert principal to bytes
  (unwrap-panic (as-max-len? (to-consensus-buff? value) u100))
)